import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { getSceneClockSync } from '../api/scenes';

export interface SceneClockSyncState {
  clockOffsetMs: number;
  lastSyncAtMs: number | null;
  lastRoundTripMs: number | null;
  syncError: boolean;
  consecutiveFailures: number;
  retryDelayMs: number;
}

interface UseSceneClockSyncOptions {
  enabled?: boolean;
  pollMs?: number;
  maxRetryDelayMs?: number;
}

/**
 * Keeps a periodically refreshed estimate of the backend clock offset.
 *
 * @param options - Optional polling settings.
 * @returns The estimated server clock offset and sync health.
 */
export function useSceneClockSync(options?: UseSceneClockSyncOptions): SceneClockSyncState {
  const enabled = options?.enabled ?? true;
  const pollMs = options?.pollMs ?? 60000;
  const maxRetryDelayMs = options?.maxRetryDelayMs ?? 60000;
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [lastSyncAtMs, setLastSyncAtMs] = useState<number | null>(null);
  const [lastRoundTripMs, setLastRoundTripMs] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<boolean>(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [retryDelayMs, setRetryDelayMs] = useState<number>(pollMs);
  const offsetRef = useRef<number>(0);
  const syncTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const failureRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(false);

  const clearTimer = (timerRef: MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearAllTimers = () => {
    clearTimer(syncTimerRef);
    clearTimer(retryTimerRef);
  };

  const scheduleNextSync = (delayMs: number) => {
    clearAllTimers();
    syncTimerRef.current = window.setTimeout(() => {
      void syncClock();
    }, Math.max(1000, delayMs));
  };

  const scheduleRetry = (failureCount: number) => {
    const computedDelayMs = Math.min(maxRetryDelayMs, Math.max(2000, Math.round(pollMs * (2 ** Math.max(0, failureCount - 1)))));
    setRetryDelayMs(computedDelayMs);
    clearAllTimers();
    retryTimerRef.current = window.setTimeout(() => {
      void syncClock();
    }, computedDelayMs);
  };

  async function syncClock(): Promise<void> {
    if (!enabled || inFlightRef.current || !mountedRef.current) {
      return;
    }

    inFlightRef.current = true;
    const sentAtMs = Date.now();
    try {
      const sample = await getSceneClockSync();
      const receivedAtMs = Date.now();
      if (!mountedRef.current) return;

      const midpointMs = (sentAtMs + receivedAtMs) / 2;
      const measuredOffsetMs = Number(sample.serverNowMs) - midpointMs;
      const currentOffsetMs = offsetRef.current;
      const nextOffsetMs = Number.isFinite(currentOffsetMs)
        ? (currentOffsetMs * 0.7) + (measuredOffsetMs * 0.3)
        : measuredOffsetMs;

      offsetRef.current = nextOffsetMs;
      setClockOffsetMs(nextOffsetMs);
      setLastSyncAtMs(receivedAtMs);
      setLastRoundTripMs(receivedAtMs - sentAtMs);
      failureRef.current = 0;
      setConsecutiveFailures(0);
      setSyncError(false);
      setRetryDelayMs(pollMs);
      scheduleNextSync(pollMs);
    } catch {
      failureRef.current += 1;
      setConsecutiveFailures(failureRef.current);
      setSyncError(true);
      scheduleRetry(failureRef.current);
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

    mountedRef.current = true;
    clearAllTimers();
    void syncClock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncClock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearAllTimers();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, pollMs, maxRetryDelayMs]);

  return {
    clockOffsetMs,
    lastSyncAtMs,
    lastRoundTripMs,
    syncError,
    consecutiveFailures,
    retryDelayMs,
  };
}
