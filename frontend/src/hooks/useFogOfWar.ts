import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridSettings } from '../components/Map/MapGridOverlay';
import { api } from '../apiBase';

/**
 * useFogOfWar
 * Manages Fog of War cells per campaign+map, synchronized via localStorage and BroadcastChannel.
 * Stores as a set of cell keys (e.g., "c:r" for square; hex uses same indexing by column/row).
 */
/**
 * useFogOfWar
 * Now persists to backend for cross-device sync while retaining localStorage + BroadcastChannel for low-latency.
 * Server endpoints:
 * - GET /maps/:mapId/fog?campaignId=... -> { cells: string[] }
 * - PATCH /maps/:mapId/fog { campaignId, cells }
 */
export function useFogOfWar(campaignId?: string, mapId?: string, grid?: GridSettings) {
  const keyId = useMemo(() => (campaignId && mapId ? `${campaignId}:${mapId}` : null), [campaignId, mapId]);
  const STORAGE_KEY = 'app.map.fog.cells';
  const [cells, setCells] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>('');
  const hasPendingPushRef = useRef<boolean>(false);
  const lastLocalChangeTsRef = useRef<number>(0);

  // Load cells from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setCells(new Set()); return; }
      const obj = JSON.parse(raw) as Record<string, string[]>;
      const arr = (keyId && obj[keyId]) || [];
      setCells(new Set(arr));
    } catch {
      setCells(new Set());
    }
  }, [keyId]);

  // Fetch from server and reconcile with local on mount/change
  useEffect(() => {
    let cancelled = false;
    const fetchServer = async () => {
      if (!campaignId || !mapId) return;
      try {
        const startedAt = Date.now();
        const res = await api.get(`/maps/${mapId}/fog`, { params: { campaignId } });
        const serverCells: string[] = Array.isArray(res?.data?.cells) ? res.data.cells : [];
        if (cancelled) return;
        // Prefer server state and persist locally (even if empty) for consistency across devices,
        // but do NOT override if a local change happened while fetching or is pending push.
        if (hasPendingPushRef.current || lastLocalChangeTsRef.current > startedAt) {
          return;
        }
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const localObj = localRaw ? (JSON.parse(localRaw) as Record<string, string[]>) : {};
        const next = new Set(serverCells);
        localObj[keyId as string] = Array.from(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localObj));
        setCells(new Set(next));
        lastPushedRef.current = JSON.stringify(localObj[keyId as string]);
      } catch {
        // Ignore network errors; remain local-only
      }
    };
    fetchServer();
    return () => { cancelled = true; };
  }, [campaignId, mapId, keyId]);

  // Listen to BroadcastChannel updates
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      const onMsg = (ev: MessageEvent) => {
        const data = (ev.data || {}) as any;
        if (data.type === 'map-fog-updated' && data.mapId === mapId && (!data.campaignId || data.campaignId === campaignId)) {
          if (Array.isArray(data.cells)) {
            setCells(new Set(data.cells));
          } else {
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              const obj = raw ? JSON.parse(raw) as Record<string, string[]> : {};
              const arr = (keyId && obj[keyId]) || [];
              setCells(new Set(arr));
            } catch {}
          }
        }
      };
      bc.addEventListener('message', onMsg);
      return () => { bc?.removeEventListener('message', onMsg); bc?.close(); };
    } catch {
      return () => {};
    }
  }, [campaignId, mapId, keyId]);

  // Listen to localStorage changes across tabs/windows (web)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === 'app.lastFogUpdate') {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const obj = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
          const arr = (keyId && obj[keyId]) || [];
          setCells(new Set(arr));
        } catch {}
      }
    };
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined' && 'removeEventListener' in window) {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [keyId]);

  // Re-fetch from server on window focus to catch external changes
  useEffect(() => {
    const onFocus = async () => {
      if (!campaignId || !mapId) return;
      try {
        const res = await api.get(`/maps/${mapId}/fog`, { params: { campaignId } });
        const serverCells: string[] = Array.isArray(res?.data?.cells) ? res.data.cells : [];
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        const localArr = (keyId && obj[keyId]) || [];
        const serverJson = JSON.stringify(serverCells);
        const localJson = JSON.stringify(localArr);
        // If a local change is pending push, prefer local and skip server apply to avoid flicker/overwrite
        if (serverJson !== localJson && !hasPendingPushRef.current) {
          obj[keyId as string] = serverCells;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
          setCells(new Set(serverCells));
          lastPushedRef.current = serverJson;
        }
      } catch {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [campaignId, mapId, keyId]);

  // Electron: on projection poke, reload fog from localStorage to avoid clobbering fresh edits with server latency
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
        const arr = (keyId && obj[keyId]) || [];
        setCells(new Set(arr));
      } catch {}
    };
    try {
      const dispose = (window as any)?.electronAPI?.onProjectionPoke?.(handler);
      return () => { if (typeof dispose === 'function') dispose(); };
    } catch {
      return () => {};
    }
  }, [keyId]);

  const persist = useCallback((next: Set<string>) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) as Record<string, string[]> : {};
      if (keyId) obj[keyId] = Array.from(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      // Ping to wake other contexts (Electron projection, some browsers)
      try { localStorage.setItem('app.lastFogUpdate', String(Date.now())); } catch {}
      try { window.electronAPI?.projectionPoke?.({ reason: 'map-fog-updated' }); } catch {}
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-fog-updated', campaignId, mapId, cells: Array.from(next), at: Date.now() });
        bc.close();
      } catch {}
    } catch {}
    setCells(new Set(next));
    lastLocalChangeTsRef.current = Date.now();

    // Debounced server push
    if (campaignId && mapId) {
      if (saveTimerRef.current) {
        // window.clearTimeout for numeric timers
        try { window.clearTimeout(saveTimerRef.current); } catch {}
      }
      const payloadJson = JSON.stringify(Array.from(next));
      // Avoid duplicate pushes when no changes
      if (payloadJson === lastPushedRef.current) return;
      hasPendingPushRef.current = true;
      try { localStorage.setItem('app.fog.pendingPush', '1'); } catch {}
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          await api.patch(`/maps/${mapId}/fog`, { campaignId, cells: Array.from(next) });
          lastPushedRef.current = payloadJson;
        } catch {
          // Silent failure; keep local state and retry on next change/focus
        } finally {
          hasPendingPushRef.current = false;
          saveTimerRef.current = null;
          try { localStorage.setItem('app.fog.pendingPush', '0'); } catch {}
        }
      }, 300);
    }
  }, [keyId, campaignId, mapId]);

  const addCell = useCallback((cellKey: string) => {
    setCells(prev => {
      const next = new Set(prev);
      next.add(cellKey);
      persist(next);
      return next;
    });
  }, [persist]);

  const removeCell = useCallback((cellKey: string) => {
    setCells(prev => {
      const next = new Set(prev);
      next.delete(cellKey);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    persist(new Set());
  }, [persist]);

  /**
   * Replace the current fog set with a new one (bulk operation).
   * Useful for actions like "poner niebla en todo el mapa".
   */
  const setAll = useCallback((next: Set<string>) => {
    persist(new Set(next));
  }, [persist]);

  return { cells, addCell, removeCell, clearAll, setAll };
}
