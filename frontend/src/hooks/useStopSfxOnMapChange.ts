import { useState, useCallback } from 'react';

const STORAGE_KEY = 'app.soundtrack.stopSfxOnMapChange';

/**
 * Persists the user preference to automatically stop all active SFX when
 * switching to a map that has no SFX preset configured for the current
 * time-of-day/situation. Music playback is unaffected by this setting.
 *
 * @returns `stopSfxOnMapChange` – current preference value.
 * @returns `setStopSfxOnMapChange` – setter that also persists to localStorage.
 */
export function useStopSfxOnMapChange() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const setEnabled = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch { /* ignore storage errors */ }
    setEnabledState(value);
  }, []);

  return { stopSfxOnMapChange: enabled, setStopSfxOnMapChange: setEnabled };
}
