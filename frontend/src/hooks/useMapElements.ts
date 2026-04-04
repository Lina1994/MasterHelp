import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../apiBase';
import type { MapElement } from '../api/mapElements';

const STORAGE_KEY = 'app.map.elements';

/**
 * useMapElements
 * Manages structural map elements (walls, doors, windows, lights) per campaign+map.
 * Synchronised via localStorage + BroadcastChannel + server (same pattern as useOrganicFog).
 *
 * @param campaignId Active campaign UUID.
 * @param mapId Active map UUID.
 * @returns Elements state and mutation helpers.
 */
export function useMapElements(campaignId?: string, mapId?: string) {
  const keyId = useMemo(() => (campaignId && mapId ? `${campaignId}:${mapId}` : null), [campaignId, mapId]);
  const [elements, setElements] = useState<MapElement[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>('');
  const hasPendingPushRef = useRef<boolean>(false);
  const lastLocalChangeTsRef = useRef<number>(0);

  // --- Load from localStorage ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setElements([]); return; }
      const obj = JSON.parse(raw) as Record<string, MapElement[]>;
      setElements((keyId && obj[keyId]) || []);
    } catch {
      setElements([]);
    }
  }, [keyId]);

  // --- Fetch from server on mount ---
  useEffect(() => {
    let cancelled = false;
    const fetchServer = async () => {
      if (!campaignId || !mapId) return;
      try {
        const startedAt = Date.now();
        const res = await api.get(`/maps/${mapId}/elements`, { params: { campaignId } });
        const serverEls: MapElement[] = Array.isArray(res?.data?.elements) ? res.data.elements : [];
        if (cancelled) return;
        if (hasPendingPushRef.current || lastLocalChangeTsRef.current > startedAt) return;
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const localObj = localRaw ? (JSON.parse(localRaw) as Record<string, MapElement[]>) : {};
        localObj[keyId as string] = serverEls;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localObj));
        setElements(serverEls);
        lastPushedRef.current = JSON.stringify(serverEls);
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
        if (data.type === 'map-elements-updated' && data.mapId === mapId && (!data.campaignId || data.campaignId === campaignId)) {
          if (Array.isArray(data.elements)) {
            setElements(data.elements);
          } else {
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              const obj = raw ? JSON.parse(raw) as Record<string, MapElement[]> : {};
              setElements((keyId && obj[keyId]) || []);
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
      if (e.key === STORAGE_KEY || e.key === 'app.lastElementsUpdate') {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const obj = raw ? (JSON.parse(raw) as Record<string, MapElement[]>) : {};
          setElements((keyId && obj[keyId]) || []);
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
        const res = await api.get(`/maps/${mapId}/elements`, { params: { campaignId } });
        const serverEls: MapElement[] = Array.isArray(res?.data?.elements) ? res.data.elements : [];
        if (hasPendingPushRef.current) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, MapElement[]>) : {};
        obj[keyId as string] = serverEls;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        setElements(serverEls);
        lastPushedRef.current = JSON.stringify(serverEls);
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
        const obj = raw ? (JSON.parse(raw) as Record<string, MapElement[]>) : {};
        setElements((keyId && obj[keyId]) || []);
      } catch {}
    };
    try {
      const dispose = (window as any)?.electronAPI?.onProjectionPoke?.(handler);
      return () => { if (typeof dispose === 'function') dispose(); };
    } catch { return () => {}; }
  }, [keyId]);

  // --- Persist helper (localStorage + BC + debounced server push) ---
  const persist = useCallback((next: MapElement[]) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) as Record<string, MapElement[]> : {};
      if (keyId) obj[keyId] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      try { localStorage.setItem('app.lastElementsUpdate', String(Date.now())); } catch {}
      try { window.electronAPI?.projectionPoke?.({ reason: 'map-elements-updated' }); } catch {}
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-elements-updated', campaignId, mapId, elements: next, at: Date.now() });
        bc.close();
      } catch {}
    } catch {}
    setElements(next);
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
          await api.patch(`/maps/${mapId}/elements`, { campaignId, elements: next });
          lastPushedRef.current = payloadJson;
        } catch { /* silent */ } finally {
          hasPendingPushRef.current = false;
          saveTimerRef.current = null;
        }
      }, 300);
    }
  }, [keyId, campaignId, mapId]);

  /**
   * Replace the full elements array.
   */
  const setAll = useCallback((next: MapElement[]) => {
    persist(next);
  }, [persist]);

  /**
   * Add a single element.
   */
  const addElement = useCallback((el: MapElement) => {
    setElements(prev => {
      const next = [...prev, el];
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Update a single element by ID (shallow merge).
   */
  const updateElement = useCallback((id: string, patch: Partial<MapElement>) => {
    setElements(prev => {
      const next = prev.map(el => el.id === id ? { ...el, ...patch } as MapElement : el);
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Remove an element by ID.
   */
  const removeElement = useCallback((id: string) => {
    setElements(prev => {
      const next = prev.filter(el => el.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Clear all elements.
   */
  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  return { elements, setAll, addElement, updateElement, removeElement, clearAll };
}
