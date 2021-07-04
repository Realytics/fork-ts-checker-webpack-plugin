import { join } from 'path';
import { createSandbox, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';
import { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Plugin';

describe('TypeScript Vue Extension', () => {
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
    {
      async: false,
      typescript: '^3.8.0',
      tsloader: '^7.0.0',
      vueloader: '^15.8.3',
      vue: '^2.6.11',
      compiler: 'vue-template-compiler',
    },
    {
      async: true,
      typescript: '^3.8.0',
      tsloader: '^7.0.0',
      vueloader: 'v16.0.0-beta.3',
      vue: '^3.0.0-beta.14',
      compiler: '@vue/compiler-sfc',
    },
  ])(
    'reports semantic error for %p',
    async ({ async, typescript, tsloader, vueloader, vue, compiler }) => {
      await sandbox.load([
        await readFixture(join(__dirname, 'fixtures/environment/typescript-vue.fixture'), {
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
            FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
          ),
          TS_LOADER_VERSION: JSON.stringify(tsloader),
          TYPESCRIPT_VERSION: JSON.stringify(typescript),
          WEBPACK_VERSION: JSON.stringify('^5.11.0'),
          WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
          WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
          VUE_LOADER_VERSION: JSON.stringify(vueloader),
          VUE_VERSION: JSON.stringify(vue),
          VUE_COMPILER: JSON.stringify(compiler),
          ASYNC: JSON.stringify(async),
        }),
        await readFixture(join(__dirname, 'fixtures/implementation/typescript-vue.fixture')),
      ]);

      if (vue === '^2.6.11') {
        await sandbox.write(
          'src/vue-shim.d.ts',
          [
            'declare module "*.vue" {',
            '  import Vue from "vue";',
            '  export default Vue;',
            '}',
          ].join('\n')
        );
      } else {
        await sandbox.write('src/vue-shim.d.ts', 'declare module "*.vue";');
      }

      const driver = createWebpackDevServerDriver(
        sandbox.spawn('npm run webpack-dev-server'),
        async
      );
      let errors: string[] = [];

      // first compilation is successful
      await driver.waitForNoErrors();

      // modify user model file
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "import User, { getUserName } from '@/model/User';",
        "import User from '@/model/User';"
      );

      // next compilation should have missing  function error
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue:27:21',
          "TS2304: Cannot find name 'getUserName'.",
          '    25 |       const user: User = this.user;',
          '    26 |',
          "  > 27 |       return user ? getUserName(user) : '';",
          '       |                     ^^^^^^^^^^^',
          '    28 |     }',
          '    29 |   },',
          '    30 |   async logout() {',
        ].join('\n'),
      ]);

      // fix it
      await sandbox.patch(
        'src/component/LoggedIn.vue',
        "return user ? getUserName(user) : '';",
        "return user ? `${user.firstName} ${user.lastName}` : '';"
      );

      await driver.waitForNoErrors();

      // modify user model file again
      await sandbox.patch('src/model/User.ts', '  firstName?: string;\n', '');

      // not we should have an error about missing firstName property
      errors = await driver.waitForErrors();
      expect(errors).toEqual([
        [
          'ERROR in src/component/LoggedIn.vue:27:29',
          "TS2339: Property 'firstName' does not exist on type 'User'.",
          '    25 |       const user: User = this.user;',
          '    26 |',
          "  > 27 |       return user ? `${user.firstName} ${user.lastName}` : '';",
          '       |                             ^^^^^^^^^',
          '    28 |     }',
          '    29 |   },',
          '    30 |   async logout() {',
        ].join('\n'),
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
      ]);
    }
  );
});
