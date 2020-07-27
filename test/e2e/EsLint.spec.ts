import { join } from 'path';
import { readFixture } from './sandbox/Fixture';
import { Sandbox, createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';

describe('EsLint', () => {
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
    { async: false, webpack: '4.0.0', absolute: false },
    { async: true, webpack: '^4.0.0', absolute: true },
    { async: false, webpack: '^5.0.0-beta.16', absolute: true },
    { async: true, webpack: '^5.0.0-beta.16', absolute: false },
  ])('reports lint error for %p', async ({ async, webpack, absolute }) => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/eslint-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
        TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
        WEBPACK_VERSION: JSON.stringify(webpack),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(async),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    if (absolute) {
      // test case for providing absolute path to files
      await sandbox.patch(
        'webpack.config.js',
        "files: './src/**/*'",
        "files: path.resolve(__dirname, './src/**/*')"
      );
    }

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // first compilation contains 2 warnings
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'WARNING in src/authenticate.ts:14:34',
        '@typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.',
        '    12 | }',
        '    13 | ',
        '  > 14 | async function logout(): Promise<any> {',
        '       |                                  ^^^',
        '    15 |   const response = await fetch(',
        "    16 |     '/logout',",
        '    17 |     {',
      ].join('\n'),
      [
        'WARNING in src/index.ts:31:44',
        "@typescript-eslint/no-unused-vars: 'event' is defined but never used.",
        '    29 |   }',
        '    30 | });',
        "  > 31 | loginForm.addEventListener('submit', async event => {",
        '       |                                            ^^^^^',
        '    32 |   const user = await login(email, password);',
        '    33 | ',
        "    34 |   if (user.role === 'admin') {",
      ].join('\n'),
    ]);

    // fix these issues
    await Promise.all([
      sandbox.patch(
        'src/authenticate.ts',
        'async function logout(): Promise<any> {',
        'async function logout(): Promise<unknown> {'
      ),
      sandbox.patch(
        'src/index.ts',
        "loginForm.addEventListener('submit', async event => {",
        "loginForm.addEventListener('submit', async () => {"
      ),
    ]);

    // next iteration should have no errors
    await driver.waitForNoErrors();

    // add a file that shouldn't be linted
    await sandbox.write('src/style.css', 'body { background: red; }');
    await sandbox.patch(
      'src/index.ts',
      "import { getUserName } from './model/User';",
      "import { getUserName } from './model/User';\nimport './style.css';"
    );

    // next iteration should have no errors
    await driver.waitForNoErrors();

    // modify the css again
    await sandbox.patch('src/style.css', 'body { background: red; }', 'body { background: blue; }');

    // next iteration should have no errors
    await driver.waitForNoErrors();

    // add a new error
    await sandbox.patch(
      'src/model/User.ts',
      ['  lastName?: string;', '}'].join('\n'),
      ['  lastName?: string;', '}', '', 'let temporary: any;', ''].join('\n')
    );

    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'WARNING in src/model/User.ts:11:5',
        "@typescript-eslint/no-unused-vars: 'temporary' is defined but never used.",
        '     9 | }',
        '    10 | ',
        '  > 11 | let temporary: any;',
        '       |     ^^^^^^^^^^^^^^',
        '    12 | ',
        '    13 | ',
        '    14 | function getUserName(user: User): string {',
      ].join('\n'),
      [
        'WARNING in src/model/User.ts:11:16',
        '@typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.',
        '     9 | }',
        '    10 | ',
        '  > 11 | let temporary: any;',
        '       |                ^^^',
        '    12 | ',
        '    13 | ',
        '    14 | function getUserName(user: User): string {',
      ].join('\n'),
    ]);
  });

  it('fixes errors with `fix: true` option', async () => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/eslint-basic.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^5.0.0'),
        TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
        WEBPACK_VERSION: JSON.stringify('^4.0.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(false),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    // fix initial issues
    await sandbox.patch(
      'src/authenticate.ts',
      'async function logout(): Promise<any> {',
      'async function logout(): Promise<unknown> {'
    );
    await sandbox.patch(
      'src/index.ts',
      "loginForm.addEventListener('submit', async event => {",
      "loginForm.addEventListener('submit', async () => {"
    );

    // set fix option for the eslint
    await sandbox.write(
      'fork-ts-checker.config.js',
      'module.exports = { eslint: { enabled: true, options: { fix: true } } };'
    );

    // add fixable issue
    await sandbox.patch(
      'src/authenticate.ts',
      'const response = await fetch(',
      'let response = await fetch('
    );

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), false);

    // it should be automatically fixed
    await driver.waitForNoErrors();

    // check if issue has been fixed
    const content = await sandbox.read('src/authenticate.ts');
    expect(content).not.toContain('let response = await fetch(');
  });
});
