import * as webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { RpcIpcMessagePortClosedError } from '../rpc/rpc-ipc/error/RpcIpcMessagePortClosedError';
import chalk from 'chalk';

function tapErrorToLogMessage(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  hooks.error.tap('ForkTsCheckerWebpackPlugin', (error) => {
    configuration.logger.issues.error(String(error));

    if (error instanceof RpcIpcMessagePortClosedError) {
      if (error.signal === 'SIGINT') {
        configuration.logger.issues.error(
          chalk.red(
            'Issues checking service interrupted - If running in a docker container, this may be caused ' +
              "by the container running out of memory. If so, try increasing the container's memory limit " +
              'or lowering the `memoryLimit` value in the ForkTsCheckerWebpackPlugin configuration.'
          )
        );
      } else {
        configuration.logger.issues.error(
          chalk.red(
            'Issues checking service aborted - probably out of memory. ' +
              'Check the `memoryLimit` option in the ForkTsCheckerWebpackPlugin configuration.\n' +
              "If increasing the memory doesn't solve the issue, it's most probably a bug in the TypeScript or EsLint."
          )
        );
      }
    }
  });
}

export { tapErrorToLogMessage };
