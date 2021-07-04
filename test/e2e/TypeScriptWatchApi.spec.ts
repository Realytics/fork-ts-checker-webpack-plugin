import { join } from 'path';
import { readFixture } from './sandbox/Fixture';
import { Sandbox, createSandbox } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Watch API', () => {
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
  ])('reports semantic error for %p with ts-loader', async ({ async, webpack }) => {
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
        ASYNC: JSON.stringify(async),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "admin" role
    await sandbox.patch(
      'src/model/Role.ts',
      'type Role = "admin" | "client" | "provider";',
      'type Role = "client" | "provider";'
    );

    // we should receive only one semantic error
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/index.ts:34:7',
        `TS2367: This condition will always return 'false' since the types 'Role' and '"admin"' have no overlap.`,
        '    32 |   const user = await login(email, password);',
        '    33 |',
        `  > 34 |   if (user.role === 'admin') {`,
        '       |       ^^^^^^^^^^^^^^^^^^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
    ]);

    // fix the semantic error by changing condition branch related to the "admin" role
    await sandbox.patch(
      'src/index.ts',
      [
        "  if (user.role === 'admin') {",
        '    console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '  } else {',
        '    console.log(`Logged in as ${getUserName(user)}`);',
        '  }',
      ].join('\n'),
      [
        "  if (user.role === 'provider') {",
        '    console.log(`Logged in as ${getUserName(user)} [provider].`);',
        '  } else {',
        '    console.log(`Logged in as ${getUserName(user)}`);',
        '  }',
      ].join('\n')
    );

    await driver.waitForNoErrors();

    // delete module to trigger another error
    await sandbox.remove('src/model/Role.ts');

    // filter-out ts-loader related errors
    errors = (await driver.waitForErrors()).filter(
      (error) => !error.includes('Module build failed') && !error.includes('Module not found')
    );
    expect(errors).toEqual([
      [
        'ERROR in src/model/User.ts:1:22',
        "TS2307: Cannot find module './Role'.",
        "  > 1 | import { Role } from './Role';",
        '      |                      ^^^^^^^^',
        '    2 |',
        '    3 | type User = {',
        '    4 |   id: string;',
      ].join('\n'),
    ]);

    // re-create deleted module
    await sandbox.write(
      'src/model/Role.ts',
      ['type Role = "admin" | "client";', '', 'export { Role };'].join('\n')
    );

    // we should receive again the one semantic error but now for "provider" role
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/index.ts:34:7',
        "TS2367: This condition will always return 'false' since the types 'Role' and '\"provider\"' have no overlap.",
        '    32 |   const user = await login(email, password);',
        '    33 |',
        "  > 34 |   if (user.role === 'provider') {",
        '       |       ^^^^^^^^^^^^^^^^^^^^^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [provider].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
    ]);
  });

  it.each([
    { async: false, webpack: '^5.11.0' },
    { async: true, webpack: '^5.11.0' },
  ])('reports semantic error for %p with babel-loader', async ({ async, webpack }) => {
    await sandbox.load([
      await readFixture(
        join(__dirname, 'fixtures/environment/typescript-basic-babel-loader.fixture'),
        {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TYPESCRIPT_VERSION: JSON.stringify('~3.8.0'),
          WEBPACK_VERSION: JSON.stringify(webpack),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          ASYNC: JSON.stringify(async),
        }
      ),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "admin" role
    await sandbox.patch(
      'src/model/Role.ts',
      'type Role = "admin" | "client" | "provider";',
      'type Role = "client" | "provider";'
    );

    // we should receive only one semantic error
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/index.ts:34:7',
        `TS2367: This condition will always return 'false' since the types 'Role' and '"admin"' have no overlap.`,
        '    32 |   const user = await login(email, password);',
        '    33 |',
        `  > 34 |   if (user.role === 'admin') {`,
        '       |       ^^^^^^^^^^^^^^^^^^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
    ]);

    // fix the semantic error by changing condition branch related to the "admin" role
    await sandbox.patch(
      'src/index.ts',
      [
        "  if (user.role === 'admin') {",
        '    console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '  } else {',
        '    console.log(`Logged in as ${getUserName(user)}`);',
        '  }',
      ].join('\n'),
      [
        "  if (user.role === 'provider') {",
        '    console.log(`Logged in as ${getUserName(user)} [provider].`);',
        '  } else {',
        '    console.log(`Logged in as ${getUserName(user)}`);',
        '  }',
      ].join('\n')
    );

    await driver.waitForNoErrors();

    // delete module to trigger another error
    await sandbox.remove('src/model/Role.ts');

    // filter-out ts-loader related errors
    errors = (await driver.waitForErrors()).filter(
      (error) => !error.includes('Module build failed') && !error.includes('Module not found')
    );
    expect(errors).toEqual([
      [
        'ERROR in src/model/User.ts:1:22',
        "TS2307: Cannot find module './Role'.",
        "  > 1 | import { Role } from './Role';",
        '      |                      ^^^^^^^^',
        '    2 |',
        '    3 | type User = {',
        '    4 |   id: string;',
      ].join('\n'),
    ]);

    // re-create deleted module
    await sandbox.write(
      'src/model/Role.ts',
      ['type Role = "admin" | "client";', '', 'export { Role };'].join('\n')
    );

    // we should receive again the one semantic error but now for "provider" role
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/index.ts:34:7',
        "TS2367: This condition will always return 'false' since the types 'Role' and '\"provider\"' have no overlap.",
        '    32 |   const user = await login(email, password);',
        '    33 |',
        "  > 34 |   if (user.role === 'provider') {",
        '       |       ^^^^^^^^^^^^^^^^^^^^^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [provider].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
    ]);
  });

  it.each([
    { async: true, webpack: '^5.11.0', typescript: '2.7.1', tsloader: '^5.0.0' },
    { async: false, webpack: '^5.11.0', typescript: '~3.0.0', tsloader: '^6.0.0' },
    { async: true, webpack: '^5.11.0', typescript: '~3.6.0', tsloader: '^7.0.0' },
    { async: false, webpack: '^5.11.0', typescript: '~3.8.0', tsloader: '^6.0.0' },
  ])('reports semantic error for %p', async ({ async, webpack, typescript, tsloader }) => {
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

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "firstName" and "lastName" from the User model
    await sandbox.patch(
      'src/model/User.ts',
      ['  firstName?: string;', '  lastName?: string;'].join('\n'),
      ''
    );

    // we should receive 2 semantic errors
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/model/User.ts:11:16',
        "TS2339: Property 'firstName' does not exist on type 'User'.",
        '     9 |',
        '    10 | function getUserName(user: User): string {',
        '  > 11 |   return [user.firstName, user.lastName]',
        '       |                ^^^^^^^^^',
        '    12 |     .filter(name => name !== undefined)',
        "    13 |     .join(' ');",
        '    14 | }',
      ].join('\n'),
      [
        'ERROR in src/model/User.ts:11:32',
        "TS2339: Property 'lastName' does not exist on type 'User'.",
        '     9 |',
        '    10 | function getUserName(user: User): string {',
        '  > 11 |   return [user.firstName, user.lastName]',
        '       |                                ^^^^^^^^',
        '    12 |     .filter(name => name !== undefined)',
        "    13 |     .join(' ');",
        '    14 | }',
      ].join('\n'),
    ]);

    // fix the semantic error
    await sandbox.patch(
      'src/model/User.ts',
      [
        '  return [user.firstName, user.lastName]',
        '    .filter(name => name !== undefined)',
        "    .join(' ');",
      ].join('\n'),
      `  return user.email;`
    );

    await driver.waitForNoErrors();

    // delete module to trigger another error
    await sandbox.remove('src/authenticate.ts');

    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      // First error is from webpack compilation
      expect.stringContaining(
        [
          'ERROR in ./src/index.ts 39:21-46',
          "Module not found: Error: Can't resolve './authenticate'",
        ].join('\n')
      ),
      [
        'ERROR in src/index.ts:1:23',
        "TS2307: Cannot find module './authenticate'.",
        "  > 1 | import { login } from './authenticate';",
        '      |                       ^^^^^^^^^^^^^^^^',
        "    2 | import { getUserName } from './model/User';",
        '    3 |',
        "    4 | const emailInput = document.getElementById('email');",
      ].join('\n'),
    ]);

    // re-create deleted module
    await sandbox.write(
      'src/authenticate.ts',
      [
        "import { User } from './model/User';",
        '',
        'async function login(email: string, password: string): Promise<void> {',
        '  await fetch(',
        "    '/login',",
        '    {',
        "      method: 'POST',",
        '      body: JSON.stringify({ email, password })',
        '    }',
        '  );',
        '}',
        '',
        'async function logout(): Promise<any> {',
        '  const response = await fetch(',
        "    '/logout',",
        '    {',
        "      method: 'POST'",
        '    }',
        '  );',
        '  return response.json();',
        '}',
        '',
        'export { login, logout };',
      ].join('\n')
    );

    // we should receive again 3 semantic errors
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in src/index.ts:34:12',
        "TS2339: Property 'role' does not exist on type 'void'.",
        '    32 |   const user = await login(email, password);',
        '    33 |',
        "  > 34 |   if (user.role === 'admin') {",
        '       |            ^^^^',
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
      ].join('\n'),
      [
        'ERROR in src/index.ts:35:45',
        "TS2345: Argument of type 'void' is not assignable to parameter of type 'User'.",
        '    33 |',
        "    34 |   if (user.role === 'admin') {",
        '  > 35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '       |                                             ^^^^',
        '    36 |   } else {',
        '    37 |     console.log(`Logged in as ${getUserName(user)}`);',
        '    38 |   }',
      ].join('\n'),
      [
        'ERROR in src/index.ts:37:45',
        "TS2345: Argument of type 'void' is not assignable to parameter of type 'User'.",
        '    35 |     console.log(`Logged in as ${getUserName(user)} [admin].`);',
        '    36 |   } else {',
        '  > 37 |     console.log(`Logged in as ${getUserName(user)}`);',
        '       |                                             ^^^^',
        '    38 |   }',
        '    39 | });',
        '    40 |',
      ].join('\n'),
    ]);
  });

  it.each([
    { webpack: '5.11.0', async: false, ignored: '[path.resolve(__dirname, "src/model/**")]' },
    { webpack: '^5.11.0', async: true, ignored: '"**/src/model/**"' },
    { webpack: '^5.11.0', async: false, ignored: '/src\\/model/' },
  ])('ignores directories from watch with %p', async ({ webpack, async, ignored }) => {
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
        ASYNC: JSON.stringify(async),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-basic.fixture')),
    ]);

    await sandbox.patch(
      'webpack.config.js',
      "  entry: './src/index.ts',",
      ["  entry: './src/index.ts',", '  watchOptions: {', `    ignored: ${ignored}`, '  },'].join(
        '\n'
      )
    );

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);

    // first compilation is successful
    await driver.waitForNoErrors();

    // then we introduce semantic error by removing "firstName" and "lastName" from the User model
    await sandbox.patch(
      'src/model/User.ts',
      ['  firstName?: string;', '  lastName?: string;'].join('\n'),
      ''
    );
    // then we add a new file in this directory
    await sandbox.write('src/model/Group.ts', '// TODO: to implement');

    // there should be no re-build
    await expect(driver.waitForNoErrors(3000)).rejects.toEqual(
      new Error('Exceeded time on waiting for no errors message to appear.')
    );
    await expect(driver.waitForErrors(3000)).rejects.toEqual(
      new Error('Exceeded time on waiting for errors to appear.')
    );
  });
});
