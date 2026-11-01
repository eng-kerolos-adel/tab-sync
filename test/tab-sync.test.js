import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTabSync, createSyncedState } from '../src/tab-sync.js';

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
let counter = 0;
const channel = () => `test-channel-${++counter}-${Date.now()}`;

test('delivers a message to other tabs but not to the sender', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  const received = { a: [], b: [] };
  a.on('PING', (p) => received.a.push(p));
  b.on('PING', (p) => received.b.push(p));

  a.emit('PING', { n: 1 });
  await wait();

  assert.deepEqual(received.b, [{ n: 1 }]);
  assert.deepEqual(received.a, []);
  a.close();
  b.close();
});

test('routes messages by type', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  const seen = [];
  b.on('LOGOUT', () => seen.push('logout'));
  b.on('THEME', () => seen.push('theme'));

  a.emit('LOGOUT');
  await wait();

  assert.deepEqual(seen, ['logout']);
  a.close();
  b.close();
});

test('unsubscribe stops further deliveries', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  let count = 0;
  const off = b.on('X', () => count++);

  a.emit('X');
  await wait();
  off();
  a.emit('X');
  await wait();

  assert.equal(count, 1);
  a.close();
  b.close();
});

test('a throwing handler does not break other handlers', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  const originalError = console.error;
  console.error = () => {};
  let ok = false;
  b.on('X', () => {
    throw new Error('boom');
  });
  b.on('X', () => {
    ok = true;
  });

  a.emit('X');
  await wait();
  console.error = originalError;

  assert.equal(ok, true);
  a.close();
  b.close();
});

test('emit validates the message type', () => {
  const a = createTabSync(channel());
  assert.throws(() => a.emit(''), TypeError);
  assert.throws(() => a.emit(42), TypeError);
  a.close();
});

test('closed channels stop receiving', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  let count = 0;
  b.on('X', () => count++);
  b.close();

  a.emit('X');
  await wait();

  assert.equal(count, 0);
  a.close();
});

test('synced state propagates changes to other tabs', async () => {
  const name = channel();
  const a = createTabSync(name);
  const b = createTabSync(name);
  const stateA = createSyncedState(a, 'theme', 'light');
  const stateB = createSyncedState(b, 'theme', 'light');
  const changes = [];
  stateB.subscribe((v) => changes.push(v));

  stateA.set('dark');
  await wait();

  assert.equal(stateB.get(), 'dark');
  assert.deepEqual(changes, ['dark']);
  a.close();
  b.close();
});

test('a tab opened later receives the current state', async () => {
  const name = channel();
  const a = createTabSync(name);
  const stateA = createSyncedState(a, 'cart', []);
  stateA.set((items) => [...items, 'keyboard']);
  await wait();

  const late = createTabSync(name);
  const stateLate = createSyncedState(late, 'cart', []);
  await wait();

  assert.deepEqual(stateLate.get(), ['keyboard']);
  a.close();
  late.close();
});

test('a fresh tab with the default value never overwrites newer state', async () => {
  const name = channel();
  const a = createTabSync(name);
  const stateA = createSyncedState(a, 'session', null);
  stateA.set({ user: 'kero' });
  await wait();

  const b = createTabSync(name);
  createSyncedState(b, 'session', null);
  await wait();

  assert.deepEqual(stateA.get(), { user: 'kero' });
  a.close();
  b.close();
});

test('onSend and onAny expose traffic for debugging', async () => {
  const name = channel();
  const sent = [];
  const a = createTabSync(name, { onSend: (m) => sent.push(m.type) });
  const b = createTabSync(name);
  const all = [];
  b.onAny((m) => all.push(m.type));

  a.emit('HELLO');
  await wait();

  assert.deepEqual(sent, ['HELLO']);
  assert.deepEqual(all, ['HELLO']);
  a.close();
  b.close();
});
