import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../apiBase';

/**
 * Represents a single organic fog brush stroke.
 * Points are normalised (0–1) relative to the map's natural dimensions.
 */
export interface OrganicFogStroke {
  points: { x: number; y: number }[];
  radius: number;
  mode: 'reveal' | 'fog';
  /** When true the renderer draws a filled polygon instead of a thick stroke line. */
  fill?: boolean;
}

const STORAGE_KEY = 'app.map.organicFog.strokes';

/**
 * useOrganicFog
 * Manages organic (brush-based) Fog of War strokes per campaign+map.
 * Synchronised via localStorage + BroadcastChannel + server (same pattern as useFogOfWar).
 *
 * @param campaignId Active campaign UUID
 * @param mapId Active map UUID
 * @returns Strokes state and mutation helpers
 */
export function useOrganicFog(campaignId?: string, mapId?: string) {
  const keyId = useMemo(() => (campaignId && mapId ? `${campaignId}:${mapId}` : null), [campaignId, mapId]);
  const [strokes, setStrokes] = useState<OrganicFogStroke[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>('');
  const hasPendingPushRef = useRef<boolean>(false);
  const lastLocalChangeTsRef = useRef<number>(0);

  // --- Load from localStorage ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setStrokes([]); return; }
      const obj = JSON.parse(raw) as Record<string, OrganicFogStroke[]>;
      setStrokes((keyId && obj[keyId]) || []);
    } catch {
      setStrokes([]);
    }
  }, [keyId]);

  // --- Fetch from server on mount ---
  useEffect(() => {
    let cancelled = false;
    const fetchServer = async () => {
      if (!campaignId || !mapId) return;
      try {
        const startedAt = Date.now();
        const res = await api.get(`/maps/${mapId}/organic-fog`, { params: { campaignId } });
        const serverStrokes: OrganicFogStroke[] = Array.isArray(res?.data?.strokes) ? res.data.strokes : [];
        if (cancelled) return;
        if (hasPendingPushRef.current || lastLocalChangeTsRef.current > startedAt) return;
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const localObj = localRaw ? (JSON.parse(localRaw) as Record<string, OrganicFogStroke[]>) : {};
        localObj[keyId as string] = serverStrokes;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localObj));
        setStrokes(serverStrokes);
        lastPushedRef.current = JSON.stringify(serverStrokes);
      } catch { /* remain local-only */ }
    };
    fetchServer();
    return () => { cancelled = true; };
  }, [campaignId, mapId, keyId]);

  // --- BroadcastChannel listener ---
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      const onMsg = (ev: MessageEvent) => {
        const data = (ev.data || {}) as any;
        if (data.type === 'map-organic-fog-updated' && data.mapId === mapId && (!data.campaignId || data.campaignId === campaignId)) {
          if (Array.isArray(data.strokes)) {
            setStrokes(data.strokes);
          } else {
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              const obj = raw ? JSON.parse(raw) as Record<string, OrganicFogStroke[]> : {};
              setStrokes((keyId && obj[keyId]) || []);
            } catch {}
          }
        }
      };
      bc.addEventListener('message', onMsg);
      return () => { bc?.removeEventListener('message', onMsg); bc?.close(); };
    } catch { return () => {}; }
  }, [campaignId, mapId, keyId]);

  // --- localStorage cross-tab listener ---
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === 'app.lastOrganicFogUpdate') {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const obj = raw ? (JSON.parse(raw) as Record<string, OrganicFogStroke[]>) : {};
          setStrokes((keyId && obj[keyId]) || []);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, [keyId]);

  // --- Re-fetch on focus ---
  useEffect(() => {
    const onFocus = async () => {
      if (!campaignId || !mapId) return;
      try {
        const res = await api.get(`/maps/${mapId}/organic-fog`, { params: { campaignId } });
        const serverStrokes: OrganicFogStroke[] = Array.isArray(res?.data?.strokes) ? res.data.strokes : [];
        if (hasPendingPushRef.current) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, OrganicFogStroke[]>) : {};
        obj[keyId as string] = serverStrokes;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        setStrokes(serverStrokes);
        lastPushedRef.current = JSON.stringify(serverStrokes);
      } catch {}
    };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [campaignId, mapId, keyId]);

  // --- Electron projection poke ---
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, OrganicFogStroke[]>) : {};
        setStrokes((keyId && obj[keyId]) || []);
      } catch {}
    };
    try {
      const dispose = (window as any)?.electronAPI?.onProjectionPoke?.(handler);
      return () => { if (typeof dispose === 'function') dispose(); };
    } catch { return () => {}; }
  }, [keyId]);

  // --- Persist helper ---
  const persist = useCallback((next: OrganicFogStroke[]) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) as Record<string, OrganicFogStroke[]> : {};
      if (keyId) obj[keyId] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      try { localStorage.setItem('app.lastOrganicFogUpdate', String(Date.now())); } catch {}
      try { window.electronAPI?.projectionPoke?.({ reason: 'map-organic-fog-updated' }); } catch {}
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-organic-fog-updated', campaignId, mapId, strokes: next, at: Date.now() });
        bc.close();
      } catch {}
    } catch {}
    setStrokes(next);
    lastLocalChangeTsRef.current = Date.now();

    // Debounced server push
    if (campaignId && mapId) {
      if (saveTimerRef.current) {
        try { window.clearTimeout(saveTimerRef.current); } catch {}
      }
      const payloadJson = JSON.stringify(next);
      if (payloadJson === lastPushedRef.current) return;
      hasPendingPushRef.current = true;
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          await api.patch(`/maps/${mapId}/organic-fog`, { campaignId, strokes: next });
          lastPushedRef.current = payloadJson;
        } catch { /* silent */ } finally {
          hasPendingPushRef.current = false;
          saveTimerRef.current = null;
        }
      }, 300);
    }
  }, [keyId, campaignId, mapId]);

  /**
   * Append a new stroke to the list.
   */
  const addStroke = useCallback((stroke: OrganicFogStroke) => {
    setStrokes(prev => {
      const next = [...prev, stroke];
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Replace the entire strokes list (bulk operation).
   */
  const setAllStrokes = useCallback((next: OrganicFogStroke[]) => {
    persist(next);
  }, [persist]);

  /**
   * Clear all organic fog strokes.
   */
  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  return { strokes, addStroke, setAllStrokes, clearAll };
}
