import { EventEmitter } from 'events';

interface WatchFileSystemOptions {
  aggregateTimeout: number;
  poll: number | boolean;
  followSymlinks: boolean;
  ignored: string | RegExp | Function | (string | RegExp | Function)[];
}

// watchpack v1 and v2 internal interface
interface Watchpack extends EventEmitter {
  _onChange(item: string, mtime: number, file: string, type?: string): void;
  _onRemove(item: string, file: string, type?: string): void;
}

// webpack 4 interface
interface WatcherV4 {
  close(): void;
  pause(): void;
  getFileTimestamps(): Map<string, number>;
  getContextTimestamps(): Map<string, number>;
}

interface TimeInfoEntry {
  safeTime: number;
  timestamp?: number;
  timestampHash?: string;
}

// webpack 5 interface
interface WatcherV5 {
  close(): void;
  pause(): void;
  getFileTimeInfoEntries(): Map<string, TimeInfoEntry>;
  getContextTimeInfoEntries(): Map<string, TimeInfoEntry>;
}

type Watcher = WatcherV4 & WatcherV5;

interface WatchFileSystem {
  watcher: Watchpack;
  wfs?: {
    watcher: Watchpack;
  };
  watch(
    files: Iterable<string>,
    dirs: Iterable<string>,
    missing: Iterable<string>,
    startTime: number,
    options?: Partial<WatchFileSystemOptions>,
    callback?: Function,
    callbackUndelayed?: Function
  ): Watcher;
}

export { WatchFileSystem, WatchFileSystemOptions, Watchpack, WatcherV4, WatcherV5, Watcher };
