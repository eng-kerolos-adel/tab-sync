import { useSyncedState } from './useSyncedState.js';

export default function App() {
  const [theme, setTheme] = useSyncedState('theme', 'light', { persist: true });
  const [cart, setCart] = useSyncedState('cart', [], { persist: true });

  return (
    <div data-theme={theme}>
      <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
        Theme: {theme}
      </button>
      <button onClick={() => setCart((items) => [...items, 'Keyboard'])}>
        Cart ({cart.length})
      </button>
    </div>
  );
}
