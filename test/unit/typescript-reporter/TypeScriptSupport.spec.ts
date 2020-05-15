import { TypeScriptReporterConfiguration } from 'lib/typescript-reporter/TypeScriptReporterConfiguration';
import os from 'os';

describe('typescript-reporter/TypeScriptSupport', () => {
  let configuration: TypeScriptReporterConfiguration;

  beforeEach(() => {
    jest.resetModules();

    configuration = {
      tsconfig: './tsconfig.json',
      compilerOptions: {},
      build: false,
      diagnosticOptions: {
        declaration: false,
        global: true,
        semantic: true,
        syntactic: false,
      },
      enabled: true,
      extensions: {
        pnp: {
          enabled: false,
        },
        vue: {
          enabled: false,
          compiler: 'vue-template-compiler',
        },
      },
      memoryLimit: 2048,
    };
  });

  it('throws error if typescript is not installed', async () => {
    jest.setMock('typescript', undefined);

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      'When you use ForkTsCheckerWebpackPlugin with typescript reporter enabled, you must install `typescript` package.'
    );
  });

  it('throws error if typescript version is lower then 2.7.0', async () => {
    jest.setMock('typescript', { version: '2.6.9' });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of 2.6.9.`,
        'The minimum required version is 2.7.0.',
      ].join(os.EOL)
    );
  });

  it("doesn't throw error if typescript version is greater or equal 2.7.0", async () => {
    jest.setMock('typescript', { version: '2.7.0' });
    jest.setMock('fs-extra', { existsSync: () => true });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport(configuration)).not.toThrowError();
  });

  it('throws error if typescript version is lower then 3.6.0 and configuration has enabled build option', async () => {
    jest.setMock('typescript', { version: '3.5.9' });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport({ ...configuration, build: true })).toThrowError(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of 3.5.9 because of the "build" option enabled.`,
        'The minimum version that supports "build" option is 3.6.0.',
        'Consider upgrading `typescript` or disabling "build" option.',
      ].join(os.EOL)
    );
  });

  it("doesn't throw error if typescript version is greater or equal 3.6.0 and configuration has enabled build option", async () => {
    jest.setMock('typescript', { version: '3.6.0' });
    jest.setMock('fs-extra', { existsSync: () => true });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport(configuration)).not.toThrowError();
  });

  it('throws error if there is no tsconfig.json file', async () => {
    jest.setMock('typescript', { version: '3.8.0' });
    jest.setMock('fs-extra', { existsSync: () => false });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    expect(() => assertTypeScriptSupport(configuration)).toThrowError(
      [
        `Cannot find the "./tsconfig.json" file.`,
        `Please check webpack and ForkTsCheckerWebpackPlugin configuration.`,
        `Possible errors:`,
        '  - wrong `context` directory in webpack configuration (if `tsconfig` is not set or is a relative path in the fork plugin configuration)',
        '  - wrong `typescript.tsconfig` path in the plugin configuration (should be a relative or absolute path)',
      ].join(os.EOL)
    );
  });

  it('checks for pnp support if pnp extension is enabled', async () => {
    jest.setMock('typescript', { version: '3.8.0' });
    jest.setMock('fs-extra', { existsSync: () => true });
    jest.setMock('lib/typescript-reporter/extension/pnp/TypeScriptPnpExtensionSupport', {
      assertTypeScriptPnpExtensionSupport: () => {
        throw new Error('Error from PnP Extension.');
      },
    });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    configuration.extensions.pnp.enabled = true;

    expect(() => assertTypeScriptSupport(configuration)).toThrowError('Error from PnP Extension.');
  });

  it('checks for pnp support if vue extension is enabled', async () => {
    jest.setMock('typescript', { version: '3.8.0' });
    jest.setMock('fs-extra', { existsSync: () => true });
    jest.setMock('lib/typescript-reporter/extension/vue/TypeScriptVueExtensionSupport', {
      assertTypeScriptVueExtensionSupport: () => {
        throw new Error('Error from Vue Extension.');
      },
    });

    const { assertTypeScriptSupport } = await import('lib/typescript-reporter/TypeScriptSupport');

    configuration.extensions.vue.enabled = true;

    expect(() => assertTypeScriptSupport(configuration)).toThrowError('Error from Vue Extension.');
  });
});
