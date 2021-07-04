import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Configuration Change', () => {
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

  it.each([
    { async: true, webpack: '~5.11.0', typescript: '2.7.1', tsloader: '^5.0.0' },
    { async: false, webpack: '^5.11.0', typescript: '~3.0.0', tsloader: '^6.0.0' },
    { async: true, webpack: '^5.11.0', typescript: '~3.7.0', tsloader: '^7.0.0' },
    { async: false, webpack: '^5.11.0', typescript: '~3.8.0', tsloader: '^6.0.0' },
  ])(
    'change in the tsconfig.json affects compilation for %p',
    async ({ async, webpack, typescript, tsloader }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify(tsloader),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify(webpack),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
      ]);

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm run webpack-dev-server'),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // change available libraries
      await sandbox.patch('tsconfig.json', '"lib": ["ES6", "DOM"]', '"lib": ["ES6"],');

      const errors = await driver.waitForErrors();
      expect(errors.length).toBeGreaterThan(0);

      // revert the change
      await sandbox.patch('tsconfig.json', '"lib": ["ES6"],', '"lib": ["DOM", "ES6"]');

      await driver.waitForNoErrors();
    }
  );
});
