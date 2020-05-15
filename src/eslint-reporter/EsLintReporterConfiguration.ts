import webpack from 'webpack';
import { EsLintReporterOptions } from './EsLintReporterOptions';

interface EsLintReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  options: object;
  files: string[];
}

function castToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  } else if (!Array.isArray(value)) {
    return [value];
  } else {
    return value;
  }
}

function createEsLintReporterConfiguration(
  compiler: webpack.Compiler,
  options: EsLintReporterOptions | undefined
): EsLintReporterConfiguration {
  return {
    enabled: !!(options && options.enabled === true),
    memoryLimit: 2048,
    ...(typeof options === 'object' ? options : {}),
    files: typeof options === 'object' ? castToArray(options.files) : [],
    options: {
      cwd: compiler.options.context || process.cwd(),
      extensions: ['.js', '.ts', '.tsx'],
      ...(typeof options === 'object' ? options.options || {} : {}),
    },
  };
}

export { EsLintReporterConfiguration, createEsLintReporterConfiguration };
