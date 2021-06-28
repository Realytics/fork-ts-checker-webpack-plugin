import * as webpack from 'webpack';
import { isAbsolute, join } from 'path';
import { EsLintReporterOptions } from './EsLintReporterOptions';
import { CLIEngineOptions } from './types/eslint';

interface EsLintReporterConfiguration {
  enabled: boolean;
  memoryLimit: number;
  options: CLIEngineOptions;
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
  const filesPatterns = (typeof options === 'object' ? castToArray(options.files) : []).map(
    (filesPattern) =>
      // ensure that `filesPattern` is an absolute path
      isAbsolute(filesPattern)
        ? filesPattern
        : join(compiler.options.context || process.cwd(), filesPattern)
  );

  return {
    enabled:
      !!options &&
      typeof options !== 'boolean' &&
      filesPatterns.length > 0 && // enable by default if files are provided
      options.enabled !== false,
    memoryLimit: 2048,
    ...(typeof options === 'object' ? options : {}),
    files: filesPatterns,
    options: {
      cwd: compiler.options.context || process.cwd(),
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      ...(typeof options === 'object' ? options.options || {} : {}),
    },
  };
}

export { EsLintReporterConfiguration, createEsLintReporterConfiguration };
