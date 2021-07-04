import * as webpack from 'webpack';
import { SyncHook, SyncWaterfallHook, AsyncSeriesWaterfallHook } from 'tapable';
import { FilesChange } from '../reporter';
import { Issue } from '../issue';

const compilerHookMap = new WeakMap<
  webpack.Compiler | webpack.MultiCompiler,
  ForkTsCheckerWebpackPluginHooks
>();

function createForkTsCheckerWebpackPluginHooks() {
  return {
    start: new AsyncSeriesWaterfallHook<[FilesChange, webpack.Compilation]>([
      'change',
      'compilation',
    ]),
    waiting: new SyncHook<webpack.Compilation>(['compilation']),
    canceled: new SyncHook<webpack.Compilation>(['compilation']),
    error: new SyncHook<[Error, webpack.Compilation]>(['error', 'compilation']),
    issues: new SyncWaterfallHook<[Issue[], webpack.Compilation | undefined]>([
      'issues',
      'compilation',
    ]),
  };
}

type ForkTsCheckerWebpackPluginHooks = ReturnType<typeof createForkTsCheckerWebpackPluginHooks>;

function forwardForkTsCheckerWebpackPluginHooks(
  source: ForkTsCheckerWebpackPluginHooks,
  target: ForkTsCheckerWebpackPluginHooks
) {
  source.start.tapPromise('ForkTsCheckerWebpackPlugin', target.start.promise);
  source.waiting.tap('ForkTsCheckerWebpackPlugin', target.waiting.call);
  source.canceled.tap('ForkTsCheckerWebpackPlugin', target.canceled.call);
  source.error.tap('ForkTsCheckerWebpackPlugin', target.error.call);
  source.issues.tap('ForkTsCheckerWebpackPlugin', target.issues.call);
}

function getForkTsCheckerWebpackPluginHooks(compiler: webpack.Compiler | webpack.MultiCompiler) {
  let hooks = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    hooks = createForkTsCheckerWebpackPluginHooks();
    compilerHookMap.set(compiler, hooks);

    // proxy hooks for multi-compiler
    if ('compilers' in compiler) {
      compiler.compilers.forEach((childCompiler) => {
        const childHooks = getForkTsCheckerWebpackPluginHooks(childCompiler);

        if (hooks) {
          forwardForkTsCheckerWebpackPluginHooks(childHooks, hooks);
        }
      });
    }
  }
  return hooks;
}

export { getForkTsCheckerWebpackPluginHooks, ForkTsCheckerWebpackPluginHooks };
