export interface TabSyncMessage<T = unknown> {
  v: 1;
  id: string;
  tabId: string;
  type: string;
  payload: T;
  ts: number;
}

export interface TabSyncOptions {
  /** Use the localStorage "storage" event when BroadcastChannel is missing. Default: true */
  fallback?: boolean;
  /** Called for every outgoing message (handy for debugging). */
  onSend?: (message: TabSyncMessage) => void;
}

export interface TabSync {
  readonly tabId: string;
  readonly supported: boolean;
  emit<T = unknown>(type: string, payload?: T): void;
  on<T = unknown>(type: string, handler: (payload: T, message: TabSyncMessage<T>) => void): () => void;
  onAny(handler: (message: TabSyncMessage) => void): () => void;
  close(): void;
}

export function isBroadcastChannelSupported(): boolean;
export function createTabSync(channelName?: string, options?: TabSyncOptions): TabSync;

export interface SyncedState<T> {
  get(): T;
  set(next: T | ((current: T) => T)): void;
  subscribe(listener: (value: T) => void): () => void;
  destroy(): void;
}

export function createSyncedState<T>(
  sync: TabSync,
  key: string,
  initial: T,
  options?: { persist?: boolean }
): SyncedState<T>;
