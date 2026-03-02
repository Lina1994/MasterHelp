import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getActiveMapId as apiGetActiveMapId, setActiveMapId as apiSetActiveMapId } from '../../api/campaigns/activeMap';

type Ctx = {
  activeMapId: string | null;
  setActiveMapId: (id: string | null) => void;
  refreshFromServer: () => Promise<void>;
};

const LEGACY_KEY = 'app.activeMapId';

const ActiveMapContext = createContext<Ctx | undefined>(undefined);

export const ActiveMapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMapId, setActiveMapIdState] = useState<string | null>(null);
  const { activeCampaign, activeCampaignId } = useActiveCampaign();
  const pendingTargetIdRef = useRef<string | null>(null);
  const pendingUntilRef = useRef<number>(0);
  const recentChangeRef = useRef<{ from: string | null; to: string | null; until: number } | null>(null);

  /**
   * Returns the localStorage key scoped to the active campaign.
   * Uses activeCampaignId (available immediately from localStorage) as primary source,
   * falling back to activeCampaign?.id (requires campaigns list to load).
   */
  const getKey = () => {
    const cid = activeCampaignId || activeCampaign?.id;
    return cid ? `app.activeMapId:${cid}` : LEGACY_KEY;
  };

  // Restore persisted selection when campaign changes (scoped key)
  // Uses activeCampaignId (immediately from localStorage) so projection windows
  // don't need to wait for the full campaign list to load.
  useEffect(() => {
    try {
      const key = getKey();
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line no-console
      console.log('[ActiveMap] restore localStorage', { key, raw });
      setActiveMapIdState(raw ? raw : null);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId]);

  // Listen to storage events from other windows to sync (scoped to current campaign)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const key = getKey();
      if (e.key === key) {
        const now = Date.now();
        const pendingId = pendingTargetIdRef.current;
        const pendingUntil = pendingUntilRef.current || 0;
        // If we have a pending local change, ignore external writes that do not match our target during the pending window.
        if (now < pendingUntil && pendingId && e.newValue !== pendingId) {
          return;
        }
        setActiveMapIdState(e.newValue || null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId]);

  // Fetch active map from server when campaign changes.
  // Uses activeCampaignId (available immediately from localStorage) so projection
  // windows start fetching without waiting for the full campaign list to resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = activeCampaignId || activeCampaign?.id;
      // eslint-disable-next-line no-console
      console.log('[ActiveMap] campaign changed, fetching from server', { cid });
      if (!cid) return;
      try {
        const serverId = await apiGetActiveMapId(cid);
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.log('[ActiveMap] fetched from server', { cid, serverId });
          setActiveMapIdState(serverId);
          try {
            const key = getKey();
            if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key);
          } catch {}
        }
      } catch {
        // ignore errors silently
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId]);

  const refreshFromServer = useCallback(async () => {
    const cid = activeCampaignId || activeCampaign?.id;
    if (!cid) return;
    try {
      const serverId = await apiGetActiveMapId(cid);
      setActiveMapIdState(prev => {
        const now = Date.now();
        const rc = recentChangeRef.current;
        if (rc && now < rc.until && serverId === rc.from && prev === rc.to) {
          return prev;
        }
        if (prev !== serverId) {
          const key = cid ? `app.activeMapId:${cid}` : LEGACY_KEY;
          try { if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key); } catch {}
          recentChangeRef.current = { from: prev, to: serverId, until: Date.now() + 1500 };
          return serverId;
        }
        return prev;
      });
    } catch {}
  }, [activeCampaignId, activeCampaign?.id]);

  // Poll server periodically to reflect remote changes (multi-device control).
  // Uses activeCampaignId (immediately from localStorage) as the dependency so
  // projection windows start polling without waiting for the campaign list.
  useEffect(() => {
    const cid = activeCampaignId || activeCampaign?.id;
    if (!cid) return;
    let disposed = false;
    const isProjectionRoute = () => {
      try {
        const p = window.location.pathname || '';
        const h = window.location.hash || '';
        return p.startsWith('/projection') || h.includes('/projection');
      } catch {
        return false;
      }
    };
    const intervalMs = isProjectionRoute() ? 1000 : 5000;
    const interval = setInterval(async () => {
      if (disposed) return;
      try {
        const serverId = await apiGetActiveMapId(cid);
        setActiveMapIdState(prev => {
          const now = Date.now();
          const pendingId = pendingTargetIdRef.current;
          const pendingUntil = pendingUntilRef.current || 0;
          // If we recently set a new id locally and the server still returns the old one, do not revert.
          if (now < pendingUntil && pendingId && serverId !== pendingId) {
            return prev;
          }
          const rc = recentChangeRef.current;
          if (rc && now < rc.until && serverId === rc.from && prev === rc.to) {
            return prev;
          }
          if (prev !== serverId) {
            // eslint-disable-next-line no-console
            console.log('[ActiveMap] polling update', { cid, prev, serverId });
            try {
              const key = getKey();
              if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key);
            } catch {}
            recentChangeRef.current = { from: prev, to: serverId, until: Date.now() + 1500 };
            return serverId;
          }
          return prev;
        });
      } catch {}
    }, intervalMs);
    return () => { disposed = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId]);

  const setActiveMapId = useCallback((id: string | null) => {
    const cid = activeCampaignId || activeCampaign?.id;
    // eslint-disable-next-line no-console
    console.log('[ActiveMap] setActiveMapId called', { id, campaignId: cid });
    setActiveMapIdState(prev => {
      recentChangeRef.current = { from: prev, to: id, until: Date.now() + 1500 };
      return id;
    });
    const key = cid ? `app.activeMapId:${cid}` : LEGACY_KEY;
    try {
      if (id) localStorage.setItem(key, id); else localStorage.removeItem(key);
    } catch {}
    // Persist to server if we have an active campaign (best-effort)
    if (cid) {
      // Mark a pending local change to avoid poll reverting to old server value.
      pendingTargetIdRef.current = id;
      pendingUntilRef.current = Date.now() + 4000; // allow up to 4s for server to persist
      // eslint-disable-next-line no-console
      console.log('[ActiveMap] persisting to server', { cid, id });
      apiSetActiveMapId(cid, id)
        .then(() => {
          // Reduce pending window and notify other contexts only after server accepted the change.
          pendingUntilRef.current = Date.now() + 1000;
          try {
            const bc = 'BroadcastChannel' in window ? new BroadcastChannel('campaign-sync') : null;
            bc?.postMessage({ type: 'activeMapChanged', campaignId: cid });
            bc?.close();
          } catch {}
          try { window.electronAPI?.projectionPoke?.({ kind: 'activeMapChanged', campaignId: cid }); } catch {}
        })
        .catch(() => {
          // On failure, clear pending and refresh from server to reconcile.
          pendingTargetIdRef.current = null;
          pendingUntilRef.current = 0;
          refreshFromServer();
        });
    }
  }, [activeCampaignId, activeCampaign?.id, refreshFromServer]);

  // Listen for fast-sync hints via BroadcastChannel and refresh immediately when matching campaign
  useEffect(() => {
    const cid = activeCampaignId || activeCampaign?.id;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (data?.type === 'activeMapChanged' && data?.campaignId === cid) {
            refreshFromServer();
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId]);

  const value = useMemo(() => ({ activeMapId, setActiveMapId, refreshFromServer }), [activeMapId, setActiveMapId, refreshFromServer]);
  return <ActiveMapContext.Provider value={value}>{children}</ActiveMapContext.Provider>;
};

export const useActiveMap = () => {
  const ctx = useContext(ActiveMapContext);
  if (!ctx) throw new Error('useActiveMap must be used within ActiveMapProvider');
  return ctx;
};
