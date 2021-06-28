import * as webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { FilesMatch, FilesChange, getFilesChange, ReporterRpcClient } from '../reporter';
import { OperationCanceledError } from '../error/OperationCanceledError';
import { tapDoneToAsyncGetIssues } from './tapDoneToAsyncGetIssues';
import { tapAfterCompileToGetIssues } from './tapAfterCompileToGetIssues';
import { interceptDoneToGetWebpackDevServerTap } from './interceptDoneToGetWebpackDevServerTap';
import { Issue } from '../issue';
import { ForkTsCheckerWebpackPlugin } from '../ForkTsCheckerWebpackPlugin';

function tapStartToConnectAndRunReporter(
  compiler: webpack.Compiler,
  reporter: ReporterRpcClient,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.run.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = false;
      tapAfterCompileToGetIssues(compiler, configuration, state);
    }
  });

  compiler.hooks.watchRun.tap('ForkTsCheckerWebpackPlugin', async () => {
    if (!state.initialized) {
      state.initialized = true;

      state.watching = true;
      if (configuration.async) {
        tapDoneToAsyncGetIssues(compiler, configuration, state);
        interceptDoneToGetWebpackDevServerTap(compiler, configuration, state);
      } else {
        tapAfterCompileToGetIssues(compiler, configuration, state);
      }
    }
  });

  compiler.hooks.compilation.tap('ForkTsCheckerWebpackPlugin', async (compilation) => {
    if (compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    let change: FilesChange = {};

    if (state.watching) {
      change = getFilesChange(compiler);

      configuration.logger.infrastructure.info(
        [
          'Calling reporter service for incremental check.',
          `  Changed files: ${JSON.stringify(change.changedFiles)}`,
          `  Deleted files: ${JSON.stringify(change.deletedFiles)}`,
        ].join('\n')
      );
    } else {
      configuration.logger.infrastructure.info('Calling reporter service for single check.');
    }

    let resolveDependencies: (dependencies: FilesMatch | undefined) => void;
    let rejectedDependencies: (error: Error) => void;
    let resolveIssues: (issues: Issue[] | undefined) => void;
    let rejectIssues: (error: Error) => void;

    state.dependenciesPromise = new Promise((resolve, reject) => {
      resolveDependencies = resolve;
      rejectedDependencies = reject;
    });
    state.issuesPromise = new Promise((resolve, reject) => {
      resolveIssues = resolve;
      rejectIssues = reject;
    });
    const previousReportPromise = state.reportPromise;
    state.reportPromise = ForkTsCheckerWebpackPlugin.pool.submit(
      (done) =>
        new Promise(async (resolve) => {
          change = await hooks.start.promise(change, compilation);

          try {
            await reporter.connect();

            const previousReport = await previousReportPromise;
            if (previousReport) {
              await previousReport.close();
            }

            const report = await reporter.getReport(change);
            resolve(report);

            report
              .getDependencies()
              .then(resolveDependencies)
              .catch(rejectedDependencies)
              .finally(() => {
                // get issues after dependencies are resolved as it can be blocking
                report.getIssues().then(resolveIssues).catch(rejectIssues).finally(done);
              });
          } catch (error) {
            if (error instanceof OperationCanceledError) {
              hooks.canceled.call(compilation);
            } else {
              hooks.error.call(error, compilation);
            }

            resolve(undefined);
            resolveDependencies(undefined);
            resolveIssues(undefined);
            done();
          }
        })
    );
  });
}

export { tapStartToConnectAndRunReporter };
