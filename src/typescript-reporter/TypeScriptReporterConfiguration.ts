import * as webpack from 'webpack';
import path from 'path';
import semver from 'semver';
import { TypeScriptDiagnosticsOptions } from './TypeScriptDiagnosticsOptions';
import { TypeScriptReporterOptions } from './TypeScriptReporterOptions';
import {
  createTypeScriptVueExtensionConfiguration,
  TypeScriptVueExtensionConfiguration,
} from './extension/vue/TypeScriptVueExtensionConfiguration';
import { TypeScriptConfigurationOverwrite } from './TypeScriptConfigurationOverwrite';

interface TypeScriptReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  configFile: string;
  configOverwrite: TypeScriptConfigurationOverwrite;
  build: boolean;
  context: string;
  mode: 'readonly' | 'write-tsbuildinfo' | 'write-references';
  diagnosticOptions: TypeScriptDiagnosticsOptions;
  extensions: {
    vue: TypeScriptVueExtensionConfiguration;
  };
  profile: boolean;
  typescriptPath: string;
}

function createTypeScriptReporterConfiguration(
  compiler: webpack.Compiler,
  options: TypeScriptReporterOptions | undefined
): TypeScriptReporterConfiguration {
  let configFile =
    typeof options === 'object' ? options.configFile || 'tsconfig.json' : 'tsconfig.json';

  // ensure that `configFile` is an absolute normalized path
  configFile = path.normalize(
    path.isAbsolute(configFile)
      ? configFile
      : path.resolve(compiler.options.context || process.cwd(), configFile)
  );

  const optionsAsObject: Exclude<TypeScriptReporterOptions, boolean> =
    typeof options === 'object' ? options : {};

  const typescriptPath = optionsAsObject.typescriptPath || require.resolve('typescript');

  const defaultCompilerOptions: Record<string, unknown> = {
    skipLibCheck: true,
    sourceMap: false,
    inlineSourceMap: false,
  };
  if (semver.gte(require(typescriptPath).version, '2.9.0')) {
    defaultCompilerOptions.declarationMap = false;
  }

  return {
    enabled: options !== false,
    memoryLimit: 2048,
    build: false,
    mode: 'write-tsbuildinfo',
    profile: false,
    ...optionsAsObject,
    configFile: configFile,
    configOverwrite: {
      ...(optionsAsObject.configOverwrite || {}),
      compilerOptions: {
        ...defaultCompilerOptions,
        ...((optionsAsObject.configOverwrite || {}).compilerOptions || {}),
      },
    },
    context: optionsAsObject.context || path.dirname(configFile),
    extensions: {
      vue: createTypeScriptVueExtensionConfiguration(
        optionsAsObject.extensions ? optionsAsObject.extensions.vue : undefined
      ),
    },
    diagnosticOptions: {
      syntactic: false, // by default they are reported by the loader
      semantic: true,
      declaration: false,
      global: false,
      ...(optionsAsObject.diagnosticOptions || {}),
    },
    typescriptPath: typescriptPath,
  };
}

export { createTypeScriptReporterConfiguration, TypeScriptReporterConfiguration };
