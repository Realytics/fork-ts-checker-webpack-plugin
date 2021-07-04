import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
  WebpackDevServerDriver,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Compiler Options parsing', () => {
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
    { typescript: '2.7.1' },
    { typescript: '~3.0.0' },
    { typescript: '~3.6.0' },
    { typescript: '^3.8.0' },
  ])('reports errors because of the misconfiguration', async ({ typescript }) => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
        TYPESCRIPT_VERSION: JSON.stringify(typescript),
        WEBPACK_VERSION: JSON.stringify('^5.11.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(false),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    let driver: WebpackDevServerDriver;
    let errors: string[];

    await sandbox.write(
      'fork-ts-checker.config.js',
      'module.exports = { typescript: { configOverwrite: { compilerOptions: { target: "ES3", lib: ["ES3"] } } } };'
    );

    driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), false);
    errors = await driver.waitForErrors();
    expect(errors.length).toBeGreaterThan(0);
    await sandbox.kill(driver.process);

    await sandbox.write(
      'fork-ts-checker.config.js',
      'module.exports = { typescript: { configOverwrite: { include: [] } } };'
    );

    driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), false);
    errors = await driver.waitForErrors();
    expect(errors.length).toBeGreaterThan(0);
    await sandbox.kill(driver.process);
  });
});
