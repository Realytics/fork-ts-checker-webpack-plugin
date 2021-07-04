import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { createGenericProcessDriver } from './sandbox/GenericProcessDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('ForkTsCheckerWebpackPlugin Out Of Memory and Cosmiconfig', () => {
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
    { async: false, webpack: '^5.11.0' },
    { async: true, webpack: '^5.11.0' },
  ])('handles out of memory for %p', async ({ async, webpack }) => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
        TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
        WEBPACK_VERSION: JSON.stringify(webpack),
        WEBPACK_CLI_VERSION: JSON.stringify('^3.3.11'),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify('^3.10.3'),
        ASYNC: JSON.stringify(async),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    await sandbox.write(
      'fork-ts-checker.config.js',
      `module.exports = { typescript: { memoryLimit: 10 } };`
    );

    const driver = createGenericProcessDriver(sandbox.spawn('npm run webpack-dev-server'));

    // we should see an error message about out of memory
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript or EsLint."
    );

    // let's modify one file to check if plugin will try to restart the service
    await sandbox.patch(
      'src/index.ts',
      "import { getUserName } from './model/User';",
      "import { getUserName } from './model/User';\n"
    );

    // we should see an error message about out of memory again
    await driver.waitForStderrIncludes(
      'Issues checking service aborted - probably out of memory. Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
        "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript or EsLint."
    );
  });
});
