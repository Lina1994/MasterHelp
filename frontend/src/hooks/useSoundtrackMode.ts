import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSoundtrackSettings, setSoundtrackSettings, type SoundtrackMode } from '../api/campaigns/soundtrackSettings';

const bcName = 'campaign-sync';

function storageKey(campaignId: string) {
  return `campaign.${campaignId}.soundtrack.mode`;
}

function readCachedMode(campaignId: string): SoundtrackMode | null {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (raw === 'manual' || raw === 'automatic') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeCachedMode(campaignId: string, mode: SoundtrackMode) {
  try {
    localStorage.setItem(storageKey(campaignId), mode);
  } catch {
    // ignore
  }
}

function broadcastMode(campaignId: string, mode: SoundtrackMode) {
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(bcName);
      bc.postMessage({ type: 'soundtrackModeChanged', campaignId, mode, at: Date.now() });
      bc.close();
    }
  } catch {
    // ignore
  }
}

export type UseSoundtrackModeResult = {
  mode: SoundtrackMode;
  isLoading: boolean;
  error: string | null;
  setMode: (mode: SoundtrackMode) => Promise<void>;
};

/**
 * Reads and updates the persisted soundtrack mode for a campaign.
 *
 * - Persists on backend so it survives app restarts.
 * - Caches in `localStorage` for fast initial render.
 * - Broadcasts changes across windows/tabs via `BroadcastChannel`.
 */
export function useSoundtrackMode(campaignId: string | null | undefined): UseSoundtrackModeResult {
  const [mode, setModeState] = useState<SoundtrackMode>(() => {
    if (!campaignId) return 'automatic';
    return readCachedMode(campaignId) ?? 'automatic';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep state in sync when campaign changes.
  useEffect(() => {
    if (!campaignId) {
      setModeState('automatic');
      setError(null);
      setIsLoading(false);
      return;
    }
    setModeState(readCachedMode(campaignId) ?? 'automatic');
  }, [campaignId]);

  // Load from API.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) return;
      setIsLoading(true);
      setError(null);
      try {
        const settings = await getSoundtrackSettings(campaignId);
        if (cancelled) return;
        setModeState(settings.mode);
        writeCachedMode(campaignId, settings.mode);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.message || 'No se pudo cargar el modo de soundtrack');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Subscribe to cross-window changes.
  useEffect(() => {
    if (!campaignId) return;

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== storageKey(campaignId)) return;
      const next = ev.newValue;
      if (next === 'manual' || next === 'automatic') setModeState(next);
    };

    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(bcName);
        bc.onmessage = (ev) => {
          const msg = ev?.data;
          if (!msg || msg.type !== 'soundtrackModeChanged') return;
          if (msg.campaignId !== campaignId) return;
          if (msg.mode === 'manual' || msg.mode === 'automatic') {
            setModeState(msg.mode);
            writeCachedMode(campaignId, msg.mode);
          }
        };
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, [campaignId]);

  const setMode = useCallback(async (nextMode: SoundtrackMode) => {
    if (!campaignId) return;
    // Optimistic update.
    setModeState(nextMode);
    writeCachedMode(campaignId, nextMode);
    broadcastMode(campaignId, nextMode);

    try {
      await setSoundtrackSettings(campaignId, { mode: nextMode });
      setError(null);
    } catch (e: any) {
      // Rollback from server (try reload), but keep UI responsive.
      setError(e?.response?.data?.message || 'No se pudo guardar el modo de soundtrack');
      try {
        const settings = await getSoundtrackSettings(campaignId);
        setModeState(settings.mode);
        writeCachedMode(campaignId, settings.mode);
        broadcastMode(campaignId, settings.mode);
      } catch {
        // ignore
      }
    }
  }, [campaignId]);

  return useMemo(() => ({ mode, isLoading, error, setMode }), [mode, isLoading, error, setMode]);
}
