import { useSyncExternalStore } from 'react';
import { createTabSync, createSyncedState } from 'tab-sync'; // or '../../src/tab-sync.js'

// One channel for the whole app, one store per key (safe under React StrictMode).
let sync;
const stores = new Map();

function getStore(key, initial, persist) {
  sync ??= createTabSync('app-sync');
  if (!stores.has(key)) stores.set(key, createSyncedState(sync, key, initial, { persist }));
  return stores.get(key);
}

/**
 * const [theme, setTheme] = useSyncedState('theme', 'dark', { persist: true });
 */
export function useSyncedState(key, initial, { persist = false } = {}) {
  const store = getStore(key, initial, persist);
  const value = useSyncExternalStore(store.subscribe, store.get, () => initial);
  return [value, store.set];
}
