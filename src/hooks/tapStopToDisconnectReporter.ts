import * as webpack from 'webpack';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { ReporterRpcClient } from '../reporter';

function tapStopToDisconnectReporter(
  compiler: webpack.Compiler,
  reporter: ReporterRpcClient,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.watchClose.tap('ForkTsCheckerWebpackPlugin', () => {
    reporter.disconnect();
  });

  compiler.hooks.done.tap('ForkTsCheckerWebpackPlugin', async () => {
    if (!state.watching) {
      await reporter.disconnect();
    }
  });

  compiler.hooks.failed.tap('ForkTsCheckerWebpackPlugin', () => {
    if (!state.watching) {
      reporter.disconnect();
    }
  });
}

export { tapStopToDisconnectReporter };
