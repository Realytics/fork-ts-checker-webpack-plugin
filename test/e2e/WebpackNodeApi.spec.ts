import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { WEBPACK_CLI_VERSION, WEBPACK_DEV_SERVER_VERSION } from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('Webpack Node Api', () => {
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

  it.each([{ webpack: '^5.11.0' }])(
    'compiles the project successfully with %p',
    async ({ webpack }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
          TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
          WEBPACK_VERSION: JSON.stringify(webpack),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(false),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
        await readFixture(join(__dirname, 'fixtures/implementation/webpack-node-api.fixture')),
      ]);

      const result = await sandbox.exec('node ./webpack-node-api.js');
      expect(result).toContain('Compiled successfully twice.');
    }
  );
});
