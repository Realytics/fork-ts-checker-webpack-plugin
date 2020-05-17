import webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { getDeletedFiles } from './getDeletedFiles';
import { FilesChange, ReporterRpcClient } from '../reporter';
import { getChangedFiles } from './getChangedFiles';
import { OperationCancelledError } from '../error/OperationCancelledError';

function tapStartToConnectAndRunReporter(
  compiler: webpack.Compiler,
  reporter: ReporterRpcClient,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', (compiler) => {
    state.isWatching = false;

    configuration.logger.infrastructure.info('Calling reporter service for single check.');

    hooks.run.call(compiler);

    state.report = reporter
      .connect()
      .then(() => reporter.getReport({}))
      .catch((error) => {
        hooks.error.call(error, compiler);
        return undefined;
      });
  });

  compiler.hooks.watchRun.tap('ForkTsCheckerWebpackPlugin', async (compiler) => {
    state.isWatching = true;

    let change: FilesChange = {
      changedFiles: getChangedFiles(compiler),
      deletedFiles: getDeletedFiles(compiler, state),
    };

    change = hooks.runWatch.call(change, compiler);

    configuration.logger.infrastructure.info(
      [
        'Calling reporter service for incremental check.',
        `  Changed files: ${JSON.stringify(change.changedFiles)}`,
        `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
      ].join('\n')
    );

    state.report = reporter
      .connect()
      .then(() => reporter.getReport(change))
      .catch((error) => {
        if (error instanceof OperationCancelledError) {
          hooks.cancelled.call(compiler);
        } else {
          hooks.error.call(error, compiler);
        }

        return undefined;
      });
  });
}

export { tapStartToConnectAndRunReporter };
