import { readFixture } from './sandbox/Fixture';
import { join } from 'path';
import os from 'os';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Context Option', () => {
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
    { async: true, typescript: '2.7.1' },
    { async: false, typescript: '~3.0.0' },
    { async: true, typescript: '~3.6.0' },
    { async: false, typescript: '~3.8.0' },
  ])(
    'uses the custom formatter to format the error message for %p',
    async ({ async, typescript }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-basic.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify('^7.0.0'),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify('^5.11.0'),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
      ]);

      // update sandbox to use context option
      await sandbox.remove('tsconfig.json');
      await sandbox.write(
        'build/tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            target: 'es5',
            module: 'commonjs',
            lib: ['ES6', 'DOM'],
            moduleResolution: 'node',
            esModuleInterop: true,
            skipLibCheck: true,
            skipDefaultLibCheck: true,
            strict: true,
            baseUrl: './src',
            outDir: './dist',
          },
          include: ['./src'],
          exclude: ['node_modules'],
        })
      );
      await sandbox.patch(
        'webpack.config.js',
        "entry: './src/index.ts',",
        ["entry: './src/index.ts',", 'context: path.resolve(__dirname),'].join('\n')
      );
      await sandbox.patch(
        'webpack.config.js',
        '      logger: {',
        [
          '      typescript: {',
          '        enabled: true,',
          '        configFile: path.resolve(__dirname, "build/tsconfig.json"),',
          '        context: __dirname,',
          '      },',
          '      logger: {',
        ].join('\n')
      );
      await sandbox.patch(
        'webpack.config.js',
        '      logger: {',
        [
          '      formatter: (issue) => {',
          '        return `It is the custom issue statement - ${issue.code}: ${issue.message}`',
          '      },',
          '      logger: {',
        ].join('\n')
      );
      await sandbox.patch(
        'webpack.config.js',
        '          transpileOnly: true',
        [
          '          transpileOnly: true,',
          '          configFile: path.resolve(__dirname, "build/tsconfig.json"),',
          '          context: __dirname,',
        ].join('\n')
      );
      // create additional directory for cwd test
      await sandbox.write('foo/.gitignore', '');

      const driver = createWebpackDevServerDriver(
        sandbox.spawn(
          `../node_modules/.bin/webpack-dev-server${os.platform() === 'win32' ? '.cmd' : ''}`,
          {},
          join(sandbox.context, 'foo')
        ),
        async
      );

      // first compilation is successful
      await driver.waitForNoErrors();

      // then we introduce semantic error by removing "firstName" and "lastName" from the User model
      await sandbox.patch(
        'src/model/User.ts',
        ['  firstName?: string;', '  lastName?: string;'].join('\n'),
        ''
      );

      // we should receive 2 semantic errors
      const errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in ../src/model/User.ts:11:16',
          "It is the custom issue statement - TS2339: Property 'firstName' does not exist on type 'User'.",
        ].join('\n'),
        [
          'ERROR in ../src/model/User.ts:11:32',
          "It is the custom issue statement - TS2339: Property 'lastName' does not exist on type 'User'.",
        ].join('\n'),
      ]);
    }
  );
});
