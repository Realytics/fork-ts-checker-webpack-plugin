import { readFixture } from './sandbox/Fixture';
import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Generate Trace', () => {
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

  it('generates trace for typescript 4.1.0-beta in watch mode', async () => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^7.0.0'),
        TYPESCRIPT_VERSION: JSON.stringify('4.1.0-beta'),
        WEBPACK_VERSION: JSON.stringify('^5.11.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(true),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    // update sandbox to generate trace
    await sandbox.patch(
      'tsconfig.json',
      '    "outDir": "./dist"',
      ['    "outDir": "./dist",', '    "generateTrace": "./traces"'].join('\n')
    );

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), true);

    // first compilation is successful
    await driver.waitForNoErrors();

    expect(await sandbox.exists('traces/trace.json')).toBe(true);
    expect(await sandbox.exists('traces/types.json')).toBe(true);
  });

  it('generates trace for typescript 4.1.0-beta in build mode', async () => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-monorepo.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TYPESCRIPT_VERSION: JSON.stringify('4.1.0-beta'),
        WEBPACK_VERSION: JSON.stringify('^5.11.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(true),
        MODE: JSON.stringify('readonly'),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-monorepo.fixture')),
    ]);

    // update sandbox to generate trace
    await sandbox.patch(
      'tsconfig.json',
      '    "rootDir": "./packages"',
      ['    "rootDir": "./packages",', '    "generateTrace": "./traces"'].join('\n')
    );

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), true);

    // first compilation is successful
    await driver.waitForNoErrors();

    expect(await sandbox.exists('traces/trace.1.json')).toBe(true);
    expect(await sandbox.exists('traces/types.1.json')).toBe(true);
    expect(await sandbox.exists('traces/trace.2.json')).toBe(true);
    expect(await sandbox.exists('traces/types.2.json')).toBe(true);
    expect(await sandbox.exists('traces/legend.json')).toBe(true);
  });
});
