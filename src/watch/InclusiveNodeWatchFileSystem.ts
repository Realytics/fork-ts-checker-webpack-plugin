import { ForkTsCheckerWebpackPluginState } from '../ForkTsCheckerWebpackPluginState';
import chokidar, { FSWatcher } from 'chokidar';
import { extname } from 'path';
import { Watcher, WatchFileSystem, WatchFileSystemOptions } from './WatchFileSystem';
import { Compiler } from 'webpack';
import { clearFilesChange, updateFilesChange } from '../reporter';
import minimatch from 'minimatch';

const BUILTIN_IGNORED_DIRS = ['node_modules', '.git', '.yarn', '.pnp'];

function createIsIgnored(
  ignored: WatchFileSystemOptions['ignored'] | undefined,
  excluded: string[]
): (path: string) => boolean {
  const ignoredPatterns = ignored ? (Array.isArray(ignored) ? ignored : [ignored]) : [];
  const ignoredFunctions = ignoredPatterns.map((pattern) => {
    // ensure patterns are valid - see https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/594
    if (typeof pattern === 'string') {
      return (path: string) => minimatch(path, pattern);
    } else if (typeof pattern === 'function') {
      return pattern;
    } else if (pattern instanceof RegExp) {
      return (path: string) => pattern.test(path);
    } else {
      // fallback to no-ignore function
      return () => false;
    }
  });
  ignoredFunctions.push((path: string) =>
    excluded.some((excludedPath) => path.startsWith(excludedPath))
  );
  ignoredFunctions.push((path: string) =>
    BUILTIN_IGNORED_DIRS.some((ignoredDir) => path.includes(`/${ignoredDir}/`))
  );

  return function isIgnored(path: string) {
    return ignoredFunctions.some((ignoredFunction) => ignoredFunction(path));
  };
}

class InclusiveNodeWatchFileSystem implements WatchFileSystem {
  get watcher() {
    return this.watchFileSystem.watcher || this.watchFileSystem.wfs?.watcher;
  }
  readonly dirsWatchers: Map<string, FSWatcher | undefined>;

  constructor(
    private watchFileSystem: WatchFileSystem,
    private compiler: Compiler,
    private pluginState: ForkTsCheckerWebpackPluginState
  ) {
    this.dirsWatchers = new Map();
  }

  private paused = true;

  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher {
    clearFilesChange(this.compiler);
    const isIgnored = createIsIgnored(
      options?.ignored,
      this.pluginState.lastDependencies?.excluded || []
    );

    // use standard watch file system for files and missing
    const standardWatcher = this.watchFileSystem.watch(
      files,
      dirs,
      missing,
      startTime,
      options,
      callback,
      callbackUndelayed
    );

    this.watcher?.on('change', (file: string) => {
      if (typeof file === 'string' && !isIgnored(file)) {
        updateFilesChange(this.compiler, { changedFiles: [file] });
      }
    });
    this.watcher?.on('remove', (file: string) => {
      if (typeof file === 'string' && !isIgnored(file)) {
        updateFilesChange(this.compiler, { deletedFiles: [file] });
      }
    });

    // calculate what to change
    const prevDirs = Array.from(this.dirsWatchers.keys());
    const nextDirs = Array.from(this.pluginState.lastDependencies?.dirs || []);
    const dirsToUnwatch = prevDirs.filter((prevDir) => !nextDirs.includes(prevDir));
    const dirsToWatch = nextDirs.filter(
      (nextDir) => !prevDirs.includes(nextDir) && !isIgnored(nextDir)
    );

    // update dirs watcher
    dirsToUnwatch.forEach((dirToUnwatch) => {
      this.dirsWatchers.get(dirToUnwatch)?.close();
      this.dirsWatchers.delete(dirToUnwatch);
    });
    dirsToWatch.forEach((dirToWatch) => {
      const interval = typeof options?.poll === 'number' ? options.poll : undefined;

      const dirWatcher = chokidar.watch(dirToWatch, {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: (path: string) => isIgnored(path),
        usePolling: options?.poll ? true : undefined,
        interval: interval,
        binaryInterval: interval,
        alwaysStat: true,
        atomic: true,
        awaitWriteFinish: true,
      });

      dirWatcher.on('add', (file, stats) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        updateFilesChange(this.compiler, { changedFiles: [file] });

        const mtime = stats?.mtimeMs || stats?.ctimeMs || 1;

        this.watcher?._onChange(dirToWatch, mtime, file, 'rename');
      });
      dirWatcher.on('unlink', (file) => {
        if (this.paused) {
          return;
        }

        const extension = extname(file);
        const supportedExtensions = this.pluginState.lastDependencies?.extensions || [];

        if (!supportedExtensions.includes(extension)) {
          return;
        }

        updateFilesChange(this.compiler, { deletedFiles: [file] });

        this.watcher?._onRemove(dirToWatch, file, 'rename');
      });
      this.dirsWatchers.set(dirToWatch, dirWatcher);
    });

    this.paused = false;

    return {
      ...standardWatcher,
      close: () => {
        clearFilesChange(this.compiler);

        if (standardWatcher) {
          standardWatcher.close();
        }
        this.dirsWatchers.forEach((dirWatcher) => {
          dirWatcher?.close();
        });
        this.dirsWatchers.clear();

        this.paused = true;
      },
      pause: () => {
        if (standardWatcher) {
          standardWatcher.pause();
        }
        this.paused = true;
      },
    };
  }
}

export { InclusiveNodeWatchFileSystem };
