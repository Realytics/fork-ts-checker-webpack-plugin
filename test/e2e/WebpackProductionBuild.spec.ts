import { join } from 'path';
import stripAnsi from 'strip-ansi';
import { readFixture } from './sandbox/Fixture';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { WEBPACK_CLI_VERSION, WEBPACK_DEV_SERVER_VERSION } from './sandbox/WebpackDevServerDriver';
import { extractWebpackErrors } from './sandbox/WebpackErrorsExtractor';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('Webpack Production Build', () => {
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
      ]);

      // lets remove the async option at all as the plugin should now how to set it by default
      await sandbox.patch(
        'webpack.config.js',
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      async: false,',
          '      logger: {',
          '        infrastructure: "console"',
          '      }',
          '    })',
        ].join('\n'),
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      logger: {',
          '        infrastructure: "console"',
          '      }',
          '    })',
        ].join('\n')
      );

      const result = await sandbox.exec('npm run webpack');
      const errors = extractWebpackErrors(result);

      expect(errors).toEqual([]);
    }
  );

  it.each([{ webpack: '^5.11.0' }])(
    'exits with error on the project error with %p',
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
      ]);

      // remove the async option at all as the plugin should now how to set it by default
      await sandbox.patch(
        'webpack.config.js',
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      async: false,',
          '      logger: {',
          '        infrastructure: "console"',
          '      }',
          '    })',
        ].join('\n'),
        [
          '    new ForkTsCheckerWebpackPlugin({',
          '      logger: {',
          '        infrastructure: "console"',
          '      }',
          '    })',
        ].join('\n')
      );

      // introduce an error in the project
      await sandbox.remove('src/model/User.ts');

      try {
        await sandbox.exec('npm run webpack');

        throw new Error('The webpack command should exit with an error code.');
      } catch (error) {
        // remove npm related output
        const output = stripAnsi(String(error)).replace(/npm (ERR!|WARN).*/g, '');
        // extract errors
        const errors = extractWebpackErrors(output);

        expect(errors).toEqual([
          // first error is from the webpack module resolution
          expect.anything(),
          [
            'ERROR in src/authenticate.ts:1:22',
            "TS2307: Cannot find module './model/User'.",
            "  > 1 | import { User } from './model/User';",
            '      |                      ^^^^^^^^^^^^^^',
            '    2 |',
            '    3 | async function login(email: string, password: string): Promise<User> {',
            '    4 |   const response = await fetch(',
          ].join('\n'),
          [
            'ERROR in src/index.ts:2:29',
            "TS2307: Cannot find module './model/User'.",
            "    1 | import { login } from './authenticate';",
            "  > 2 | import { getUserName } from './model/User';",
            '      |                             ^^^^^^^^^^^^^^',
            '    3 |',
            "    4 | const emailInput = document.getElementById('email');",
            "    5 | const passwordInput = document.getElementById('password');",
          ].join('\n'),
        ]);
      }
    }
  );
});
