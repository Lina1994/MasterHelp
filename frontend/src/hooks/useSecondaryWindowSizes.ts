import { useEffect, useState } from 'react';

/**
 * Dimensions for a secondary window (players or skyline).
 */
export interface WindowSize {
  width: number;
  height: number;
  dpr?: number;
}

/**
 * Custom size settings persisted in localStorage.
 * Key: 'app.secondaryWindows.customSizes'
 */
interface CustomSizesStore {
  /** 'dynamic' uses real sizes reported by the secondary windows; 'custom' uses the values below. */
  mode: 'dynamic' | 'custom';
  players: WindowSize;
  skyline: WindowSize;
}

const LS_KEY = 'app.secondaryWindows.customSizes';
const DEFAULT_CUSTOM: CustomSizesStore = {
  mode: 'dynamic',
  players: { width: 1920, height: 1080 },
  skyline: { width: 1920, height: 1080 },
};

function loadStore(): CustomSizesStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CustomSizesStore>;
      return {
        mode: parsed.mode === 'custom' ? 'custom' : 'dynamic',
        players: parsed.players ?? DEFAULT_CUSTOM.players,
        skyline: parsed.skyline ?? DEFAULT_CUSTOM.skyline,
      };
    }
  } catch {}
  return { ...DEFAULT_CUSTOM };
}

function persistStore(store: CustomSizesStore) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
    // Notify other tabs/instances via BroadcastChannel
    const bc = new BroadcastChannel('campaign-sync');
    bc.postMessage({ type: 'secondaryWindowSizesChanged', store });
    bc.close();
  } catch {}
}

/**
 * useSecondaryWindowSizes
 *
 * Manages the mode (dynamic vs. custom) and custom dimension values for the
 * secondary windows (players window + skyline window).
 *
 * Returns:
 * - `mode`: current mode
 * - `customSizes`: the stored custom sizes (always available even in dynamic mode)
 * - `setMode(m)`: switch between dynamic / custom
 * - `setCustomSize(window, size)`: update a custom dimension
 *
 * The actual effective size to use in the preview is derived in `ProjectedMapMirror`
 * by checking the mode: when 'dynamic', use the localStorage-reported sizes from
 * the real secondary windows; when 'custom', use `customSizes`.
 */
export function useSecondaryWindowSizes() {
  const [store, setStore] = useState<CustomSizesStore>(() => loadStore());

  // React to changes from other tabs/windows
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'secondaryWindowSizesChanged' && e.data.store) {
          setStore(e.data.store);
        }
      };
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, []);

  const setMode = (mode: 'dynamic' | 'custom') => {
    setStore((prev) => {
      const next = { ...prev, mode };
      persistStore(next);
      return next;
    });
  };

  const setCustomSize = (
    window: 'players' | 'skyline',
    size: Partial<WindowSize>,
  ) => {
    setStore((prev) => {
      const next: CustomSizesStore = {
        ...prev,
        [window]: { ...prev[window], ...size },
      };
      persistStore(next);
      return next;
    });
  };

  return {
    mode: store.mode,
    customSizes: { players: store.players, skyline: store.skyline },
    setMode,
    setCustomSize,
  };
}
