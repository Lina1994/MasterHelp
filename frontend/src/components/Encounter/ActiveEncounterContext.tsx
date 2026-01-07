import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getActiveEncounterId as apiGetActiveEncounterId, setActiveEncounterId as apiSetActiveEncounterId } from '../../api/campaigns/activeEncounter';

type Ctx = {
  activeEncounterId: string | null;
  setActiveEncounterId: (id: string | null) => void;
  refreshFromServer: () => Promise<void>;
};

const LEGACY_KEY = 'app.activeEncounterId';

const ActiveEncounterContext = createContext<Ctx | undefined>(undefined);

export const ActiveEncounterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeEncounterId, setActiveEncounterIdState] = useState<string | null>(null);
  const { activeCampaign } = useActiveCampaign();
  const pendingTargetIdRef = useRef<string | null>(null);
  const pendingUntilRef = useRef<number>(0);
  const recentChangeRef = useRef<{ from: string | null; to: string | null; until: number } | null>(null);

  const getKey = () => {
    const cid = activeCampaign?.id;
    return cid ? `app.activeEncounterId:${cid}` : LEGACY_KEY;
  };

  useEffect(() => {
    try {
      const key = getKey();
      const raw = localStorage.getItem(key);
      setActiveEncounterIdState(raw ? raw : null);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const key = getKey();
      if (e.key === key) {
        const now = Date.now();
        const pendingId = pendingTargetIdRef.current;
        const pendingUntil = pendingUntilRef.current || 0;
        if (now < pendingUntil && pendingId && e.newValue !== pendingId) return;
        setActiveEncounterIdState(e.newValue || null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = activeCampaign?.id;
      if (!cid) return;
      try {
        const serverId = await apiGetActiveEncounterId(cid);
        if (!cancelled) {
          setActiveEncounterIdState(serverId);
          try {
            const key = getKey();
            if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key);
          } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeCampaign?.id]);

  const refreshFromServer = async () => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    try {
      const serverId = await apiGetActiveEncounterId(cid);
      setActiveEncounterIdState(prev => {
        const now = Date.now();
        const rc = recentChangeRef.current;
        if (rc && now < rc.until && serverId === rc.from && prev === rc.to) return prev;
        if (prev !== serverId) {
          try { const key = getKey(); if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key); } catch {}
          recentChangeRef.current = { from: prev, to: serverId, until: Date.now() + 1500 };
          return serverId;
        }
        return prev;
      });
    } catch {}
  };

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    let disposed = false;
    const interval = setInterval(async () => {
      if (disposed) return;
      try {
        const serverId = await apiGetActiveEncounterId(cid);
        setActiveEncounterIdState(prev => {
          const now = Date.now();
          const pendingId = pendingTargetIdRef.current;
          const pendingUntil = pendingUntilRef.current || 0;
          if (now < pendingUntil && pendingId && serverId !== pendingId) return prev;
          const rc = recentChangeRef.current;
          if (rc && now < rc.until && serverId === rc.from && prev === rc.to) return prev;
          if (prev !== serverId) {
            try { const key = getKey(); if (serverId) localStorage.setItem(key, serverId); else localStorage.removeItem(key); } catch {}
            recentChangeRef.current = { from: prev, to: serverId, until: Date.now() + 1500 };
            return serverId;
          }
          return prev;
        });
      } catch {}
    }, 3000);
    return () => { disposed = true; clearInterval(interval); };
  }, [activeCampaign?.id]);

  const setActiveEncounterId = (id: string | null) => {
    setActiveEncounterIdState(prev => {
      recentChangeRef.current = { from: prev, to: id, until: Date.now() + 1500 };
      return id;
    });
    try { const key = getKey(); if (id) localStorage.setItem(key, id); else localStorage.removeItem(key); } catch {}
    const cid = activeCampaign?.id;
    if (cid) {
      pendingTargetIdRef.current = id;
      pendingUntilRef.current = Date.now() + 4000;
      apiSetActiveEncounterId(cid, id)
        .then(() => {
          pendingUntilRef.current = Date.now() + 1000;
          try {
            const bc = 'BroadcastChannel' in window ? new BroadcastChannel('campaign-sync') : null;
            bc?.postMessage({ type: 'activeEncounterChanged', campaignId: cid });
            bc?.close();
          } catch {}
        })
        .catch(() => {
          pendingTargetIdRef.current = null;
          pendingUntilRef.current = 0;
          refreshFromServer();
        });
    }
  };

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (data?.type === 'activeEncounterChanged' && data?.campaignId === cid) {
            refreshFromServer();
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [activeCampaign?.id]);

  const value = useMemo(() => ({ activeEncounterId, setActiveEncounterId, refreshFromServer }), [activeEncounterId, activeCampaign?.id]);
  return <ActiveEncounterContext.Provider value={value}>{children}</ActiveEncounterContext.Provider>;
};

export const useActiveEncounter = () => {
  const ctx = useContext(ActiveEncounterContext);
  if (!ctx) throw new Error('useActiveEncounter must be used within ActiveEncounterProvider');
  return ctx;
};
