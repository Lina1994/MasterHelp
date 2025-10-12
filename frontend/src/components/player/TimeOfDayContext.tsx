import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getCampaignTimeOfDay, setCampaignTimeOfDay } from '../../api/campaigns/timeOfDay';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'night';

type Ctx = {
  timeOfDay: TimeOfDay;
  setTimeOfDay: (t: TimeOfDay) => void;
};

const KEY = 'app.timeOfDay';

const TimeOfDayContext = createContext<Ctx | undefined>(undefined);

export const TimeOfDayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const { activeCampaign } = useActiveCampaign();
  const pendingRef = useRef<{ value: TimeOfDay | null; until: number }>({ value: null, until: 0 });
  const recentChangeRef = useRef<{ from: TimeOfDay | null; to: TimeOfDay | null; until: number } | null>(null);

  // Restore persisted selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === 'dawn' || raw === 'morning' || raw === 'afternoon' || raw === 'night') {
        setTimeOfDay(raw);
      }
    } catch {}
  }, []);

  // Persist changes
  useEffect(() => {
    try { localStorage.setItem(KEY, timeOfDay); } catch {}
  }, [timeOfDay]);

  // Sync across windows/tabs via storage events so the projection window updates immediately
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const val = e.newValue as any;
        if (val === 'dawn' || val === 'morning' || val === 'afternoon' || val === 'night') {
          // Only update if different to avoid redundant renders
          if (val !== timeOfDay) {
            const now = Date.now();
            const rc = recentChangeRef.current;
            if (rc && now < rc.until && val === rc.from && timeOfDay === rc.to) {
              return; // ignore immediate flip-back
            }
            setTimeOfDay(prev => {
              recentChangeRef.current = { from: prev, to: val, until: Date.now() + 1500 };
              return val;
            });
          }
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [timeOfDay]);

  // Fallback: in projection route, poll localStorage periodically to handle contexts where 'storage' doesn't propagate (e.g., incognito vs normal)
  useEffect(() => {
    const isProjectionRoute = () => {
      try {
        const p = window.location.pathname || '';
        const h = window.location.hash || '';
        return p.startsWith('/projection') || h.includes('/projection');
      } catch {
        return false;
      }
    };
    if (!isProjectionRoute()) return;
    let disposed = false;
    const interval = setInterval(() => {
      if (disposed) return;
      try {
        const raw = localStorage.getItem(KEY) as any;
        if (raw === 'dawn' || raw === 'morning' || raw === 'afternoon' || raw === 'night') {
          if (raw !== timeOfDay) {
            const now = Date.now();
            const rc = recentChangeRef.current;
            if (rc && now < rc.until && raw === rc.from && timeOfDay === rc.to) {
              return; // ignore immediate flip-back
            }
            setTimeOfDay(prev => {
              recentChangeRef.current = { from: prev, to: raw, until: Date.now() + 1500 };
              return raw;
            });
          }
        }
      } catch {}
    }, 1000);
    return () => { disposed = true; clearInterval(interval); };
  }, [timeOfDay]);

  // Fetch campaign time-of-day from server on campaign change
  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    let disposed = false;
    (async () => {
      try {
        const serverTod = await getCampaignTimeOfDay(cid);
        if (!disposed && serverTod && serverTod !== timeOfDay) {
          const now = Date.now();
          const rc = recentChangeRef.current;
          if (rc && now < rc.until && serverTod === rc.from && timeOfDay === rc.to) {
            return; // ignore immediate flip-back
          }
          setTimeOfDay(prev => {
            recentChangeRef.current = { from: prev, to: serverTod, until: Date.now() + 1500 };
            return serverTod;
          });
        }
      } catch {}
    })();
    return () => { disposed = true; };
  }, [activeCampaign?.id]);

  // Poll server for TOD changes to reflect remote updates (fast in projection, slower elsewhere)
  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) return;
    const isProjectionRoute = () => {
      try {
        const p = window.location.pathname || '';
        const h = window.location.hash || '';
        return p.startsWith('/projection') || h.includes('/projection');
      } catch { return false; }
    };
    let disposed = false;
    const interval = setInterval(async () => {
      if (disposed) return;
      try {
        const serverTod = await getCampaignTimeOfDay(cid);
        const now = Date.now();
        if (now < pendingRef.current.until && pendingRef.current.value && serverTod !== pendingRef.current.value) {
          return; // suppress revert while pending
        }
        const rc = recentChangeRef.current;
        if (rc && now < rc.until && serverTod === rc.from && timeOfDay === rc.to) {
          return; // ignore immediate flip-back
        }
        if (serverTod && serverTod !== timeOfDay) {
          setTimeOfDay(prev => {
            recentChangeRef.current = { from: prev, to: serverTod, until: Date.now() + 1500 };
            return serverTod;
          });
        }
      } catch {}
    }, isProjectionRoute() ? 1000 : 5000);
    return () => { disposed = true; clearInterval(interval); };
  }, [activeCampaign?.id, timeOfDay]);

  // When changing locally, persist to server if campaign exists (owner-only endpoint; players will get 403 and we ignore it)
  const setTimeOfDayAndPersist = (t: TimeOfDay) => {
    setTimeOfDay(prev => {
      recentChangeRef.current = { from: prev, to: t, until: Date.now() + 1500 };
      return t;
    });
    const cid = activeCampaign?.id;
    if (cid) {
      pendingRef.current = { value: t, until: Date.now() + 4000 };
      setCampaignTimeOfDay(cid, t)
        .then(() => { pendingRef.current = { value: t, until: Date.now() + 1000 }; })
        .catch(() => { pendingRef.current = { value: null, until: 0 }; });
    }
  };

  const value = useMemo(() => ({ timeOfDay, setTimeOfDay: setTimeOfDayAndPersist }), [timeOfDay, activeCampaign?.id]);
  return <TimeOfDayContext.Provider value={value}>{children}</TimeOfDayContext.Provider>;
};

export const useTimeOfDay = () => {
  const ctx = useContext(TimeOfDayContext);
  if (!ctx) throw new Error('useTimeOfDay must be used within TimeOfDayProvider');
  return ctx;
};
