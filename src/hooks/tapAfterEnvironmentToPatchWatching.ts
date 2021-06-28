import * as webpack from 'webpack';
import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import { InclusiveNodeWatchFileSystem } from '../watch/InclusiveNodeWatchFileSystem';
import { CompilerWithWatchFileSystem } from '../watch/CompilerWithWatchFileSystem';

function tapAfterEnvironmentToPatchWatching(
  compiler: webpack.Compiler,
  state: ForkTsCheckerWebpackPluginState
) {
  compiler.hooks.afterEnvironment.tap('ForkTsCheckerWebpackPlugin', () => {
    const watchFileSystem = (compiler as CompilerWithWatchFileSystem).watchFileSystem;
    if (watchFileSystem) {
      // wrap original watch file system
      (compiler as CompilerWithWatchFileSystem).watchFileSystem = new InclusiveNodeWatchFileSystem(
        watchFileSystem,
        compiler,
        state
      );
    }
  });
}

export { tapAfterEnvironmentToPatchWatching };
