import { join } from 'path';
import { readFixture } from './sandbox/Fixture';
import { Sandbox, createSandbox } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript SolutionBuilder API', () => {
  let sandbox: Sandbox;

  beforeAll(async () => {
    sandbox = await createSandbox();
  });

  beforeEach(async () => {
    await sandbox.reset();
  });

  afterAll(async () => {
    await sandbox.cleanup();
  });

  it.only.each([
    { async: false, typescript: '~3.6.0', mode: 'readonly' },
    // { async: true, typescript: '~3.8.0', mode: 'write-tsbuildinfo' },
    // { async: false, typescript: '~3.8.0', mode: 'write-references' },
  ])('reports semantic error for %p', async ({ async, typescript, mode }) => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-monorepo.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TYPESCRIPT_VERSION: JSON.stringify(typescript),
        WEBPACK_VERSION: JSON.stringify('^5.11.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(async),
        MODE: JSON.stringify(mode),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-monorepo.fixture')),
    ]);

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // initial compilation should be successful
    await driver.waitForNoErrors();
    console.log(1);

    // create semantic error in shared package
    await sandbox.patch('packages/shared/src/intersect.ts', 'arrayB: T[] = []', 'arrayB: T');

    // this compilation should contain semantic error in the shared project
    // (there is also an error in the client project but as its dependency is not built, it will not be processed)
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in packages/shared/src/intersect.ts:2:41',
        "TS2339: Property 'includes' does not exist on type 'T'.",
        '    1 | function intersect<T>(arrayA: T[] = [], arrayB: T): T[] {',
        '  > 2 |   return arrayA.filter((item) => arrayB.includes(item));',
        '      |                                         ^^^^^^^^',
        '    3 | }',
        '    4 | ',
        '    5 | export default intersect;',
      ].join('\n'),
    ]);

    // fix semantic error in the shared package
    await sandbox.patch(
      'packages/shared/src/intersect.ts',
      'return arrayA.filter((item) => arrayB.includes(item));',
      'return arrayA.filter((item) => item && arrayB);'
    );

    // this compilation should contain semantic error in the client project
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in packages/client/src/index.ts:4:42',
        "TS2345: Argument of type 'T[]' is not assignable to parameter of type 'T'.",
        typescript === '~4.0.0'
          ? "  'T' could be instantiated with an arbitrary type which could be unrelated to 'T[]'."
          : "  'T[]' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint '{}'.",
        '    2 | ',
        '    3 | function compute<T>(arrayA: T[], arrayB: T[]) {',
        '  > 4 |   const intersection = intersect(arrayA, arrayB);',
        '      |                                          ^^^^^^',
        '    5 |   const difference = subtract(arrayA, arrayB);',
        '    6 | ',
        '    7 |   return {',
      ].join('\n'),
    ]);

    // fix semantic error in the client package
    await sandbox.patch(
      'packages/client/src/index.ts',
      'const intersection = intersect(arrayA, arrayB);',
      'const intersection = intersect(arrayA, arrayB[0]);'
    );

    // this compilation should be successful
    await driver.waitForNoErrors();
    console.log(2);

    await sandbox.write('packages/client/src/nested/additional.ts', 'export const x = 10;');
    await sandbox.patch(
      'packages/client/src/index.ts',
      'import { intersect, subtract } from "@project-references-fixture/shared";',
      'import { intersect, subtract } from "@project-references-fixture/shared";\nimport { x } from "./nested/additional";'
    );

    // this compilation should be successful
    await driver.waitForNoErrors();
    console.log(3);
    // close webpack-dev-server
    await sandbox.kill(driver.process);

    switch (mode) {
      case 'readonly':
        expect(await sandbox.exists('packages/shared/tsconfig.tsbuildinfo')).toEqual(false);
        expect(await sandbox.exists('packages/client/tsconfig.tsbuildinfo')).toEqual(false);
        expect(await sandbox.exists('packages/shared/lib')).toEqual(false);
        expect(await sandbox.exists('packages/client/lib')).toEqual(false);
        break;

      case 'write-tsbuildinfo':
        expect(await sandbox.exists('packages/shared/tsconfig.tsbuildinfo')).toEqual(true);
        expect(await sandbox.exists('packages/client/tsconfig.tsbuildinfo')).toEqual(true);
        expect(await sandbox.exists('packages/shared/lib')).toEqual(false);
        expect(await sandbox.exists('packages/client/lib')).toEqual(false);

        expect(await sandbox.read('packages/shared/tsconfig.tsbuildinfo')).not.toEqual('');
        expect(await sandbox.read('packages/client/tsconfig.tsbuildinfo')).not.toEqual('');

        await sandbox.remove('packages/shared/tsconfig.tsbuildinfo');
        await sandbox.remove('packages/client/tsconfig.tsbuildinfo');
        break;

      case 'write-references':
        expect(await sandbox.exists('packages/shared/tsconfig.tsbuildinfo')).toEqual(true);
        expect(await sandbox.exists('packages/client/tsconfig.tsbuildinfo')).toEqual(true);
        expect(await sandbox.exists('packages/shared/lib')).toEqual(true);
        expect(await sandbox.exists('packages/client/lib')).toEqual(true);
        expect(await sandbox.exists('packages/shared/lib/index.js')).toEqual(true);
        expect(await sandbox.exists('packages/client/lib/index.js')).toEqual(true);

        expect(await sandbox.read('packages/shared/tsconfig.tsbuildinfo')).not.toEqual('');
        expect(await sandbox.read('packages/client/tsconfig.tsbuildinfo')).not.toEqual('');

        await sandbox.remove('packages/shared/tsconfig.tsbuildinfo');
        await sandbox.remove('packages/client/tsconfig.tsbuildinfo');
        await sandbox.remove('packages/shared/lib');
        await sandbox.remove('packages/client/lib');
        break;
    }
  });
});
