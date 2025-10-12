import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import AuthImage from '../components/common/AuthImage';
import { getMapSkylineUrlSized, listMaps } from '../api/maps';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';

const ProjectionSkylinePage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign } = useActiveCampaign();
  const [hasSkyline, setHasSkyline] = useState<boolean>(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get('campaignId');
    if (cid) setActiveCampaignId(cid);
  }, [setActiveCampaignId]);

  useEffect(() => { try { const d = (window as any).electronAPI?.onProjectionPoke?.(async () => { await refreshFromServer(); }); return () => { if (typeof d === 'function') d(); }; } catch {} }, [refreshFromServer]);

  // Probe if active map has skyline available to avoid loading spinner forever
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeMapId) { setHasSkyline(false); return; }
        const maps = await listMaps({ campaignId: activeCampaign?.id });
        const m = maps.find(x => x.id === activeMapId);
        if (!cancelled) setHasSkyline(Boolean((m as any)?.skylineAvailable));
      } catch { if (!cancelled) setHasSkyline(false); }
    })();
    return () => { cancelled = true; };
  }, [activeMapId, activeCampaign?.id]);

  // Reportar tamaño de la ventana Skyline (Electron) y guardarlo en localStorage
  useEffect(() => {
    const KEY_SIZE = 'app.projection.skyline.size';
    const el = document.getElementById('projection-skyline-root');
    const report = () => {
      const rect = el?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const payload = { width: Math.round(rect?.width || window.innerWidth), height: Math.round(rect?.height || window.innerHeight), dpr };
      try { (window as any).electronAPI?.skylineProjectionReportSize?.(payload); } catch {}
      try { localStorage.setItem(KEY_SIZE, JSON.stringify(payload)); } catch {}
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, []);

  return (
    <Box id="projection-skyline-root" sx={{ width: '100vw', height: '100vh', bgcolor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {activeMapId ? (
        hasSkyline ? (
          <AuthImage
            src={getMapSkylineUrlSized(activeMapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
            alt="Skyline proyectado"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Typography variant="h4" color="white">Sin skyline para este mapa</Typography>
        )
      ) : (
        <Typography variant="h4" color="white">Sin mapa activo</Typography>
      )}
    </Box>
  );
};

export default ProjectionSkylinePage;