/**
 * tab-sync — cross-tab messaging and state sync on top of the native
 * BroadcastChannel API. Zero dependencies, no backend, no WebSockets.
 *
 * Browsers deliver a message to every *other* tab/window/iframe of the same
 * origin that opened a channel with the same name. A tab never receives its
 * own messages.
 */

const PROTOCOL_VERSION = 1;

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const safe = (fn, ...args) => {
  try {
    fn(...args);
  } catch (error) {
    console.error('[tab-sync] handler error:', error);
  }
};

export const isBroadcastChannelSupported = () =>
  typeof globalThis.BroadcastChannel === 'function';

/**
 * Open a channel shared by every tab of this origin.
 *
 * @param {string} [channelName='app-sync']
 * @param {{ fallback?: boolean, onSend?: (message: object) => void }} [options]
 */
export function createTabSync(channelName = 'app-sync', options = {}) {
  const { fallback = true, onSend } = options;
  const tabId = uid();
  const handlers = new Map(); // type -> Set<fn>
  const anyHandlers = new Set();
  let closed = false;

  const dispatch = (message) => {
    if (
      closed ||
      !message ||
      message.v !== PROTOCOL_VERSION ||
      message.tabId === tabId ||
      typeof message.type !== 'string'
    ) {
      return;
    }
    handlers.get(message.type)?.forEach((fn) => safe(fn, message.payload, message));
    anyHandlers.forEach((fn) => safe(fn, message));
  };

  const transport = openTransport(channelName, fallback, dispatch);

  return {
    tabId,
    supported: transport.supported,

    /** Send a message to all other tabs. */
    emit(type, payload = null) {
      if (closed) return;
      if (typeof type !== 'string' || !type) {
        throw new TypeError('[tab-sync] emit(type): "type" must be a non-empty string');
      }
      const message = { v: PROTOCOL_VERSION, id: uid(), tabId, type, payload, ts: Date.now() };
      transport.send(message);
      if (onSend) safe(onSend, message);
    },

    /** Listen to one message type. Returns an unsubscribe function. */
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
      return () => handlers.get(type)?.delete(handler);
    },

    /** Listen to every message (useful for debugging). Returns an unsubscribe function. */
    onAny(handler) {
      anyHandlers.add(handler);
      return () => anyHandlers.delete(handler);
    },

    /** Close the channel and remove every listener. */
    close() {
      if (closed) return;
      closed = true;
      handlers.clear();
      anyHandlers.clear();
      transport.close();
    },
  };
}

function openTransport(name, allowFallback, dispatch) {
  if (isBroadcastChannelSupported()) {
    const channel = new BroadcastChannel(name);
    channel.onmessage = (event) => dispatch(event.data);
    channel.unref?.(); // Node only: don't keep the process alive
    return {
      supported: true,
      send: (message) => channel.postMessage(message),
      close: () => channel.close(),
    };
  }

  // Legacy fallback (Safari < 15.4): the "storage" event fires in other tabs.
  const canUseStorage = typeof window !== 'undefined' && 'localStorage' in window;
  if (allowFallback && canUseStorage) {
    const key = `tab-sync:${name}`;
    const onStorage = (event) => {
      if (event.key !== key || !event.newValue) return;
      try {
        dispatch(JSON.parse(event.newValue));
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener('storage', onStorage);
    return {
      supported: true,
      send(message) {
        try {
          localStorage.setItem(key, JSON.stringify(message));
          localStorage.removeItem(key);
        } catch {
          /* storage full or blocked */
        }
      },
      close: () => window.removeEventListener('storage', onStorage),
    };
  }

  // SSR / unsupported environments: safe no-op.
  return { supported: false, send() {}, close() {} };
}

/**
 * A small piece of state that stays identical in every open tab.
 *
 * - `set()` updates this tab and broadcasts to the others.
 * - A tab that opens later asks the existing tabs for the current value.
 * - Last write wins (timestamp based, tab id breaks ties).
 * - `persist: true` also keeps the value in localStorage so a full browser
 *   restart (no tabs open) still remembers it. Never persist secrets.
 *
 * @template T
 * @param {ReturnType<typeof createTabSync>} sync
 * @param {string} key
 * @param {T} initial
 * @param {{ persist?: boolean }} [options]
 */
export function createSyncedState(sync, key, initial, options = {}) {
  const { persist = false } = options;
  const storageKey = `tab-sync:state:${key}`;
  const listeners = new Set();
  let value = initial;
  let updatedAt = 0;
  let updatedBy = '';

  if (persist) {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      if (raw) ({ value, updatedAt, updatedBy = '' } = JSON.parse(raw));
    } catch {
      /* ignore corrupted storage */
    }
  }

  const save = () => {
    if (!persist) return;
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify({ value, updatedAt, updatedBy }));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  };
  const notify = () => listeners.forEach((fn) => safe(fn, value));

  const offState = sync.on(`state:${key}`, (incoming) => {
    if (!incoming) return;
    // Last write wins; the tab id breaks ties so every tab converges on the
    // same value, and exact duplicates are ignored (no double notifications).
    const isNewer =
      incoming.updatedAt > updatedAt ||
      (incoming.updatedAt === updatedAt && incoming.by > updatedBy);
    if (!isNewer) return;
    value = incoming.value;
    updatedAt = incoming.updatedAt;
    updatedBy = incoming.by;
    save();
    notify();
  });

  // Answer tabs that just opened and want the current value.
  const offRequest = sync.on(`state-request:${key}`, () => {
    if (updatedAt > 0) sync.emit(`state:${key}`, { value, updatedAt, by: updatedBy });
  });

  sync.emit(`state-request:${key}`);

  return {
    get: () => value,

    set(next) {
      value = typeof next === 'function' ? next(value) : next;
      updatedAt = Date.now();
      updatedBy = sync.tabId;
      save();
      sync.emit(`state:${key}`, { value, updatedAt, by: updatedBy });
      notify();
    },

    /** Called on every change (local or remote). Returns an unsubscribe function. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    destroy() {
      offState();
      offRequest();
      listeners.clear();
    },
  };
}
