import * as webpack from 'webpack';
import { ForkTsCheckerWebpackPluginConfiguration } from '../ForkTsCheckerWebpackPluginConfiguration';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';

function interceptDoneToGetWebpackDevServerTap(
  compiler: webpack.Compiler,
  configuration: ForkTsCheckerWebpackPluginConfiguration,
  state: ForkTsCheckerWebpackPluginState
) {
  // inspired by https://github.com/ypresto/fork-ts-checker-async-overlay-webpack-plugin
  compiler.hooks.done.intercept({
    register: (tap) => {
      if (
        tap.name === 'webpack-dev-server' &&
        tap.type === 'sync' &&
        configuration.logger.devServer
      ) {
        state.webpackDevServerDoneTap = tap;
      }
      return tap;
    },
  });
}

export { interceptDoneToGetWebpackDevServerTap };
