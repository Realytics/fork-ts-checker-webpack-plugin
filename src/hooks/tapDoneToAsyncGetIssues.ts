import * as webpack from 'webpack';
import chalk from 'chalk';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { getForkTsCheckerWebpackPluginHooks } from './pluginHooks';
import { createWebpackFormatter } from '../formatter/WebpackFormatter';
import { Issue } from '../issue';
import { IssueWebpackError } from '../issue/IssueWebpackError';
import isPending from '../utils/async/isPending';
import wait from '../utils/async/wait';

function tapDoneToAsyncGetIssues(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  const hooks = getForkTsCheckerWebpackPluginHooks(compiler);

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', async (stats) => {
    if (stats.compilation.compiler !== compiler) {
      // run only for the compiler that the plugin was registered for
      return;
    }

    const reportPromise = state.reportPromise;
    const issuesPromise = state.issuesPromise;
    let issues: Issue[] | undefined;

    try {
      if (await isPending(issuesPromise)) {
        hooks.waiting.call(stats.compilation);
        configuration.logger.issues.log(chalk.cyan('Issues checking in progress...'));
      } else {
        // wait 10ms to log issues after webpack stats
        await wait(10);
      }

      issues = await issuesPromise;
    } catch (error) {
      hooks.error.call(error, stats.compilation);
      return;
    }

    if (!issues) {
      // some error has been thrown or it was canceled
      return;
    }

    if (reportPromise !== state.reportPromise) {
      // there is a newer report - ignore this one
      return;
    }

    // filter list of issues by provided issue predicate
    issues = issues.filter(configuration.issue.predicate);

    // modify list of issues in the plugin hooks
    issues = hooks.issues.call(issues, stats.compilation);

    const formatter = createWebpackFormatter(configuration.formatter);

    if (issues.length) {
      // follow webpack's approach - one process.write to stderr with all errors and warnings
      configuration.logger.issues.error(issues.map((issue) => formatter(issue)).join('\n'));
    } else {
      configuration.logger.issues.log(chalk.green('No issues found.'));
    }

    // report issues to webpack-dev-server, if it's listening
    // skip reporting if there are no issues, to avoid an extra hot reload
    if (issues.length && state.webpackDevServerDoneTap) {
      issues.forEach((issue) => {
        const error = new IssueWebpackError(configuration.formatter(issue), issue);

        if (issue.severity === 'warning') {
          stats.compilation.warnings.push(error);
        } else {
          stats.compilation.errors.push(error);
        }
      });

      state.webpackDevServerDoneTap.fn(stats);
    }

    if (stats.startTime) {
      configuration.logger.infrastructure.info(
        `Time: ${Math.round(Date.now() - stats.startTime).toString()} ms`
      );
    }
  });
}

export { tapDoneToAsyncGetIssues };
