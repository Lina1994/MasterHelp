import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import AuthImage from '../components/common/AuthImage';
import { getMapSkylineUrlSized, listMaps } from '../api/maps';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';
import { getCharacter, CharacterPayload } from '../api/characters';
import { getActiveSkylineCharacterId } from '../api/campaigns/activeSkylineCharacter';

const ProjectionSkylinePage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign } = useActiveCampaign();
  const [hasSkyline, setHasSkyline] = useState<boolean>(true);
  const [campaignIdFromQuery, setCampaignIdFromQuery] = useState<string | null>(null);
  const [skylineCharacter, setSkylineCharacter] = useState<CharacterPayload | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get('campaignId');
    if (cid) {
      setCampaignIdFromQuery(cid);
      setActiveCampaignId(cid);
    }
  }, [setActiveCampaignId]);

  useEffect(() => { try { const d = (window as any).electronAPI?.onProjectionPoke?.(async () => { await refreshFromServer(); }); return () => { if (typeof d === 'function') d(); }; } catch {} }, [refreshFromServer]);

  const loadSkylineCharacter = useCallback(async () => {
    let charId = activeCampaign?.activeSkylineCharacter?.id;
    if (!charId && (campaignIdFromQuery || activeCampaign?.id)) {
      try {
        charId = await getActiveSkylineCharacterId(campaignIdFromQuery || activeCampaign?.id || '');
      } catch {
        charId = null;
      }
    }
    if (!charId) { setSkylineCharacter(null); return; }
    try {
      const ch = await getCharacter(charId);
      setSkylineCharacter(ch);
    } catch {
      setSkylineCharacter(null);
    }
  }, [activeCampaign?.activeSkylineCharacter?.id, activeCampaign?.id, campaignIdFromQuery]);

  // Load active skyline character when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineCharacter(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineCharacter]);

  // Listen to storage events (other window toggled skyline) and reload
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.activeCharacterUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        // Only reload if same campaign as this window
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          loadSkylineCharacter();
        }
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery, loadSkylineCharacter]);

  // Fast-sync via BroadcastChannel
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (data?.type === 'activeSkylineChanged' && data?.campaignId === cid) {
            loadSkylineCharacter();
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [activeCampaign?.id, campaignIdFromQuery, loadSkylineCharacter]);

  // Poll server periodically to reflect remote changes (multi-device control)
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    let disposed = false;
    const intervalMs = 2000;
    const interval = setInterval(async () => {
      if (disposed) return;
      await loadSkylineCharacter();
    }, intervalMs);
    return () => { disposed = true; clearInterval(interval); };
  }, [activeCampaign?.id, campaignIdFromQuery, loadSkylineCharacter]);

  // Probe if active map has skyline available to avoid loading spinner forever
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeMapId) { setHasSkyline(false); return; }
        const maps = await listMaps({ campaignId: activeCampaign?.id || campaignIdFromQuery || undefined });
        const m = maps.find(x => x.id === activeMapId);
        if (!cancelled) setHasSkyline(Boolean((m as any)?.skylineAvailable));
      } catch { if (!cancelled) setHasSkyline(false); }
    })();
    return () => { cancelled = true; };
  }, [activeMapId, activeCampaign?.id, campaignIdFromQuery]);

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

  const skylineAvatar = useMemo(() => {
    if (!skylineCharacter) return null;
    const initials = (skylineCharacter.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    const avatarBg = skylineCharacter.tokenColor || '#263238';
    const src = skylineCharacter.characterImageUrl || skylineCharacter.tokenImageUrl || undefined;
    return (
      <StackedCharacterOverlay src={src} initials={initials} bg={avatarBg} />
    );
  }, [skylineCharacter]);

  return (
    <Box id="projection-skyline-root" sx={{ width: '100vw', height: '100vh', bgcolor: 'black', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {skylineAvatar}
    </Box>
  );
};

const StackedCharacterOverlay: React.FC<{ src?: string; initials: string; bg: string }> = ({ src, initials, bg }) => {
  const size = '60vh';
  return (
    <Box sx={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {src ? (
        <Box sx={{ width: size, height: size, borderRadius: 2, overflow: 'hidden', boxShadow: 4, border: 'none', bgcolor: 'transparent' }}>
          <img src={src} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' }} />
        </Box>
      ) : (
        <Avatar
          alt={initials}
          sx={{ width: size, height: size, borderRadius: 2, border: '2px solid rgba(255,255,255,0.4)', boxShadow: 6, bgcolor: bg, fontSize: 64 }}
        >
          {initials}
        </Avatar>
      )}
    </Box>
  );
};

export default ProjectionSkylinePage;