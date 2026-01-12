import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapTokenPayload } from '../api/maps';
import { getMapTokens, setMapTokens } from '../api/maps';

/**
 * useMapTokens
 * Manages map tokens per campaign+map with localStorage + BroadcastChannel for low latency,
 * and persists to backend for cross-device sync.
 * Storage key: app.map.tokens -> Record<`${campaignId}:${mapId}`, MapTokenPayload[]>
 */
export function useMapTokens(campaignId?: string, mapId?: string) {
  const keyId = useMemo(() => (campaignId && mapId ? `${campaignId}:${mapId}` : null), [campaignId, mapId]);
  const STORAGE_KEY = 'app.map.tokens';
  const [tokens, setTokensState] = useState<MapTokenPayload[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>('');
  const hasPendingPushRef = useRef<boolean>(false);
  const lastLocalChangeTsRef = useRef<number>(0);

  const readLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? (JSON.parse(raw) as Record<string, MapTokenPayload[]>) : {};
      const arr = (keyId && obj[keyId]) || [];
      setTokensState(arr);
    } catch {
      setTokensState([]);
    }
  }, [keyId]);

  useEffect(() => { readLocal(); }, [readLocal]);

  // Fetch from server and reconcile on mount/change
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!campaignId || !mapId) return;
      try {
        const startedAt = Date.now();
        const serverTokens = await getMapTokens(mapId, campaignId);
        if (cancelled) return;
        if (hasPendingPushRef.current || lastLocalChangeTsRef.current > startedAt) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, MapTokenPayload[]>) : {};
        obj[keyId as string] = serverTokens;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        setTokensState(serverTokens);
        lastPushedRef.current = JSON.stringify(serverTokens);
      } catch {
        // ignore network errors
      }
    };
    run();
    return () => { cancelled = true; };
  }, [campaignId, mapId, keyId]);

  // BroadcastChannel listener
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      const onMsg = (ev: MessageEvent) => {
        const data = (ev.data || {}) as any;
        if (data.type === 'map-tokens-updated' && data.mapId === mapId && (!data.campaignId || data.campaignId === campaignId)) {
          if (Array.isArray(data.tokens)) setTokensState(data.tokens as MapTokenPayload[]);
          else readLocal();
        }
      };
      bc.addEventListener('message', onMsg);
      return () => { bc?.removeEventListener('message', onMsg); bc?.close(); };
    } catch {
      return () => {};
    }
  }, [campaignId, mapId, readLocal]);

  // localStorage listener
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === 'app.lastTokensUpdate') readLocal();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [readLocal]);

  const persist = useCallback((next: MapTokenPayload[]) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? (JSON.parse(raw) as Record<string, MapTokenPayload[]>) : {};
      if (keyId) obj[keyId] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      try { localStorage.setItem('app.lastTokensUpdate', String(Date.now())); } catch {}
      try { (window as any)?.electronAPI?.projectionPoke?.({ reason: 'map-tokens-updated' }); } catch {}
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-tokens-updated', campaignId, mapId, tokens: next, at: Date.now() });
        bc.close();
      } catch {}
    } catch {}
    setTokensState(next);
    lastLocalChangeTsRef.current = Date.now();

    if (campaignId && mapId) {
      if (saveTimerRef.current) try { window.clearTimeout(saveTimerRef.current); } catch {}
      const json = JSON.stringify(next);
      if (json === lastPushedRef.current) return;
      hasPendingPushRef.current = true;
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          await setMapTokens(mapId, campaignId, next);
          lastPushedRef.current = json;
        } catch {
          // silent failure; retry on next change
        } finally {
          hasPendingPushRef.current = false;
          saveTimerRef.current = null;
        }
      }, 250);
    }
  }, [keyId, campaignId, mapId]);

  const addToken = useCallback((token: MapTokenPayload) => {
    setTokensState(prev => {
      const map = new Map(prev.map(t => [t.id, t] as const));
      map.set(token.id, token);
      const next = Array.from(map.values());
      persist(next);
      return next;
    });
  }, [persist]);

  const updateToken = useCallback((id: string, patch: Partial<MapTokenPayload>) => {
    setTokensState(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...patch } : t));
      persist(next);
      return next;
    });
  }, [persist]);

  const removeToken = useCallback((id: string) => {
    setTokensState(prev => {
      const next = prev.filter(t => t.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const setTokens = useCallback((arr: MapTokenPayload[]) => {
    persist(arr);
  }, [persist]);

  return { tokens, addToken, updateToken, removeToken, setTokens };
}
