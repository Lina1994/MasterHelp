import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AuthImage from '../components/common/AuthImage';
import { getMapImageUrlSized } from '../api/maps';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';
import { listMaps } from '../api/maps';
import MapGridOverlay, { GridSettings } from '../components/Map/MapGridOverlay';
import { getGridOverlaySettings } from '../api/campaigns/gridOverlay';

const ProjectionMapPage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign } = useActiveCampaign();
  const KEY_SIZE = 'app.projection.size';
  const [activeTransform, setActiveTransform] = useState<{ zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number } | null>(null);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Si viene campaignId en la URL (?campaignId=...), fijarlo en el contexto para que esta ventana use la misma campaña.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get('campaignId');
    // eslint-disable-next-line no-console
    console.log('[Projection] parsed campaignId from URL', { cid, href: window.location.href });
    if (cid) setActiveCampaignId(cid);
  }, [setActiveCampaignId]);

  // Nota: dejamos de usar override por IPC. La proyección sigue el activeMapId sincronizado con servidor.

  // Debug: log changes to diagnose mismatches
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Projection] state', { activeMapId, timeOfDay });
  }, [activeMapId, timeOfDay]);

  // Listen to electron projection-poke to refresh immediately (when available)
  useEffect(() => {
    try {
      const dispose = window.electronAPI?.onProjectionPoke?.(async () => {
        await refreshFromServer();
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    } catch {}
  }, [refreshFromServer]);

  // Load transform for active map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeMapId) { setActiveTransform(null); return; }
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        if (!cancelled) setActiveTransform((m as any)?.transform || null);
      } catch { if (!cancelled) setActiveTransform(null); }
    })();
    return () => { cancelled = true; };
  }, [activeMapId, activeCampaign?.id]);

  // Reset natural size on map change so stale dimensions don't linger
  useEffect(() => { setNaturalSize(null); }, [activeMapId, timeOfDay]);

  // Grid settings: load from server, mirror to localStorage, and react to storage/broadcast updates
  useEffect(() => {
    const KEY = 'app.map.grid.settings';
    let cancelled = false;
    // Load from server for cross-device sync
    (async () => {
      try {
        if (!activeCampaign?.id) return;
        const srv = await getGridOverlaySettings(activeCampaign.id);
        if (cancelled) return;
        setGridSettings(srv);
        try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch {}
      } catch {
        // Fallback to localStorage on error
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        } catch {}
      }
    })();
    // Initial from localStorage if present (helps first paint)
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY && ev.newValue) {
        try { const parsed = JSON.parse(ev.newValue); setGridSettings((prev) => ({ ...prev, ...parsed })); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'map-grid-updated') {
          try {
            const raw = localStorage.getItem(KEY);
            if (raw) setGridSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
          } catch {}
        }
      });
    } catch {}
    return () => { cancelled = true; window.removeEventListener('storage', onStorage); try { bc?.close(); } catch {} };
  }, [activeCampaign?.id]);

  // Periodically refresh from server to catch updates coming from other devices (pure web)
  useEffect(() => {
    let disposed = false;
    const KEY = 'app.map.grid.settings';
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeCampaign?.id) return;
        const srv = await getGridOverlaySettings(activeCampaign.id);
        if (disposed) return;
        setGridSettings((prev) => {
          const changed = JSON.stringify(prev) !== JSON.stringify(srv);
          if (changed) {
            try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch {}
          }
          return changed ? srv : prev;
        });
      } catch {}
    };
    const id = window.setInterval(tick, 2000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeCampaign?.id]);

  // React to external transform updates via BroadcastChannel and electron poke
  useEffect(() => {
    let disposed = false;
    const refreshTransform = async () => {
      if (disposed) return;
      try {
        if (!activeMapId) return;
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        setActiveTransform((m as any)?.transform || null);
      } catch {}
    };
    try {
      const bc = new BroadcastChannel('campaign-sync');
      const onMsg = (e: MessageEvent) => {
        const data = e.data || {};
        if (data?.type === 'map-transform-updated') {
          refreshTransform();
        }
      };
      bc.addEventListener('message', onMsg);
      const cleanup = () => { bc.removeEventListener('message', onMsg); bc.close(); };
      // Also hook into electron poke to refresh
      const disposePoke = window.electronAPI?.onProjectionPoke?.(refreshTransform);
      // Fallback: listen to storage pings
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === 'app.lastMapTransformUpdate') refreshTransform();
      };
      window.addEventListener('storage', onStorage);
      return () => { disposed = true; cleanup(); if (typeof disposePoke === 'function') disposePoke(); window.removeEventListener('storage', onStorage); };
    } catch {
      // Fallback: listen only to electron poke
      const disposePoke = window.electronAPI?.onProjectionPoke?.(refreshTransform);
      return () => { disposed = true; if (typeof disposePoke === 'function') disposePoke(); };
    }
  }, [activeMapId, activeCampaign?.id]);

  // As safety net for cross-device updates in pure web, poll transform every 1s while projection is open
  useEffect(() => {
    let disposed = false;
    const tick = async () => {
      if (disposed) return;
      try {
        if (!activeMapId) return;
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        const next = ((m as any)?.transform || null) as any;
        setActiveTransform(prev => {
          const changed = JSON.stringify(prev) !== JSON.stringify(next);
          return changed ? next : prev;
        });
      } catch {}
    };
    const id = window.setInterval(tick, 1000);
    return () => { disposed = true; window.clearInterval(id); };
  }, [activeMapId, activeCampaign?.id]);

  // Reportar tamaño de la ventana de proyección (Electron) y guardarlo en localStorage (Web también puede leerlo)
  useEffect(() => {
    // Medir el contenedor real de la imagen para mayor precisión
    const el = document.getElementById('projection-root');
    const report = () => {
      const rect = el?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Para representar tamaño “lógico” (CSS px) mantenemos rect.width/height; si se desea absoluto físico, multiplicar por dpr.
      const payload = { width: Math.round(rect?.width || window.innerWidth), height: Math.round(rect?.height || window.innerHeight), dpr };
      try { window.electronAPI?.projectionReportSize?.(payload); } catch {}
      try { localStorage.setItem(KEY_SIZE, JSON.stringify(payload)); } catch {}
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, []);

  return (
    <Box id="projection-root" sx={{ width: '100vw', height: '100vh', bgcolor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {activeMapId ? (
        <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Shared transform layer so image and grid move together */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${activeTransform?.translateXPct ?? 0}%, ${activeTransform?.translateYPct ?? 0}%) rotate(${activeTransform?.rotationDeg ?? 0}deg) scale(${activeTransform?.zoom ?? 1})`,
              transformOrigin: 'center center',
            }}
          >
            <Box sx={{ position: 'relative', width: naturalSize?.w || 'auto', height: naturalSize?.h || 'auto' }}>
              <AuthImage
                src={getMapImageUrlSized(activeMapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
                alt="Mapa proyectado"
                style={{ display: 'block' }}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const w = img.naturalWidth || img.width;
                  const h = img.naturalHeight || img.height;
                  if (w && h) setNaturalSize({ w, h });
                }}
              />
              {gridSettings.enabled && (
                <MapGridOverlay settings={gridSettings} widthPx={naturalSize?.w} heightPx={naturalSize?.h} />
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Typography variant="h4" color="white">Sin mapa activo</Typography>
      )}
    </Box>
  );
};

export default ProjectionMapPage;
