import { createTabSync, createSyncedState } from '../src/tab-sync.js';

const $ = (selector) => document.querySelector(selector);

/* ---------- channel + live traffic log ---------- */

const hueOf = (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const logEl = $('#log');

function log(direction, message) {
  const li = document.createElement('li');
  li.className = `${direction} fresh`;

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.setProperty('--h', hueOf(message.tabId));

  const dir = document.createElement('span');
  dir.className = 'dir';
  dir.textContent = direction === 'out' ? 'sent' : 'received';

  const type = document.createElement('span');
  type.className = 'type';
  type.textContent = message.type;

  const payload = document.createElement('span');
  payload.className = 'payload';
  payload.textContent = JSON.stringify(message.payload);

  li.append(dot, dir, type, payload);
  logEl.append(li);
  while (logEl.children.length > 60) logEl.firstChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
}

const sync = createTabSync('kero-demo', { onSend: (message) => log('out', message) });
sync.onAny((message) => log('in', message));

$('#me-id').textContent = sync.tabId.slice(0, 4);
$('#me-dot').style.setProperty('--h', hueOf(sync.tabId));
$('#open-tab').addEventListener('click', () => window.open(location.href, '_blank'));

/* ---------- shared state (persist: demo data only, never secrets) ---------- */

const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
const theme = createSyncedState(sync, 'theme', prefersDark ? 'dark' : 'light', { persist: true });
const cart = createSyncedState(sync, 'cart', [], { persist: true });
const session = createSyncedState(sync, 'session', null, { persist: true });

/* ---------- theme ---------- */

function renderTheme(value) {
  document.documentElement.dataset.theme = value;
  $('#next-theme').textContent = value === 'dark' ? 'light' : 'dark';
}
renderTheme(theme.get());
theme.subscribe(renderTheme);
$('#toggle-theme').addEventListener('click', () =>
  theme.set((current) => (current === 'dark' ? 'light' : 'dark'))
);

/* ---------- cart ---------- */

function renderCart(items) {
  $('#cart-count').textContent = items.length;
  $('#cart-list').replaceChildren(
    ...items.map((name) => Object.assign(document.createElement('li'), { textContent: name }))
  );
}
renderCart(cart.get());
cart.subscribe(renderCart);
document.querySelectorAll('.add').forEach((button) =>
  button.addEventListener('click', () => cart.set((items) => [...items, button.dataset.item]))
);
$('#clear-cart').addEventListener('click', () => cart.set([]));

/* ---------- session ---------- */

function renderSession(user) {
  const signedIn = Boolean(user);
  $('#session-status').textContent = signedIn ? `Signed in as ${user.name}` : 'Signed out';
  $('#signin-row').hidden = signedIn;
  $('#signout').hidden = !signedIn;
}
renderSession(session.get());
session.subscribe(renderSession);
$('#signin').addEventListener('click', () => {
  const name = $('#username').value.trim() || 'Guest';
  session.set({ name });
});
$('#signout').addEventListener('click', () => session.set(null));
