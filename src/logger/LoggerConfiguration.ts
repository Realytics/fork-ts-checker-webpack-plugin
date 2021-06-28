import * as webpack from 'webpack';
import LoggerOptions from './LoggerOptions';
import Logger from './Logger';
import { createLogger } from './LoggerFactory';

interface LoggerConfiguration {
  infrastructure: Logger;
  issues: Logger;
  devServer: boolean;
}

function createLoggerConfiguration(
  compiler: webpack.Compiler,
  options: LoggerOptions | undefined
): LoggerConfiguration {
  return {
    infrastructure: createLogger((options && options.infrastructure) || 'silent', compiler),
    issues: createLogger((options && options.issues) || 'console', compiler),
    devServer: options?.devServer !== false,
  };
}

export { LoggerConfiguration, createLoggerConfiguration };
