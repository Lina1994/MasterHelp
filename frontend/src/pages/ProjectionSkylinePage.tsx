import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import AuthImage from '../components/common/AuthImage';
import { getMapSkylineUrlSized, listMaps } from '../api/maps';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../components/player/TimeOfDayContext';
import { getCharacter, CharacterPayload } from '../api/characters';
import { getActiveSkylineCharacterId } from '../api/campaigns/activeSkylineCharacter';
import { getActiveEncounterId } from '../api/campaigns/activeEncounter';
import { getCampaignBattleStatePublic } from '../api/campaigns/battleState';
import { getSkylineOverlaySettingsPublic } from '../api/campaigns/skylineOverlay';
import { getCampaignNowPlayingTitlePublic } from '../api/soundtrack/nowPlaying';

const SHOW_DAY_IN_SKYLINE_KEY = 'diary_showSelectedDayInSkyline';
const SELECTED_DAY_KEY = 'app.diary.selectedDay';

type DiarySelectedDayPayload = {
  label: string;
  campaignId: string;
} | null;

function loadShowSelectedDayInSkyline(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DAY_IN_SKYLINE_KEY);
    if (raw === null) return true; // default
    return raw === 'true';
  } catch {
    return true;
  }
}

function loadSelectedDayPayload(): DiarySelectedDayPayload {
  try {
    const raw = localStorage.getItem(SELECTED_DAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.label !== 'string') return null;
    if (typeof parsed.campaignId !== 'string') return null;
    return { label: parsed.label, campaignId: parsed.campaignId };
  } catch {
    return null;
  }
}

const ProjectionSkylinePage: React.FC = () => {
  const { activeMapId, refreshFromServer } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const { setActiveCampaignId, activeCampaign } = useActiveCampaign();
  const [hasSkyline, setHasSkyline] = useState<boolean>(true);
  const [campaignIdFromQuery, setCampaignIdFromQuery] = useState<string | null>(null);
  const [skylineCharacter, setSkylineCharacter] = useState<CharacterPayload | null>(null);
  const [showSongTitle, setShowSongTitle] = useState<boolean>(false);
  const [showInitiativeStrip, setShowInitiativeStrip] = useState<boolean>(false);
  const [showCurrentTurnImage, setShowCurrentTurnImage] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showCurrentTurnImage');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });
  const [currentTurnImagePosition, setCurrentTurnImagePosition] = useState<string>(() => {
    try {
      return localStorage.getItem('app.combat.currentTurnImagePosition') || 'center-right';
    } catch {
      return 'center-right';
    }
  });
  const [imageSizes, setImageSizes] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('app.combat.currentTurnImageSizes');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      Tiny: 15,
      Small: 20,
      Medium: 30,
      Large: 40,
      Huge: 50,
      Gargantuan: 60,
    };
  });
  const [initiativeStrip, setInitiativeStrip] = useState<{ battleStarted: boolean; enabled: boolean; currentTurnId: string | null; items: Array<{ id: string; name: string; imageUrl: string | null; fullImageUrl?: string | null; size?: string | null; role?: 'ally' | 'foe' }> }>({ battleStarted: false, enabled: false, currentTurnId: null, items: [] });
  const [battleStateStarted, setBattleStateStarted] = useState<boolean>(false);
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null);
  const [showSelectedDayInSkyline, setShowSelectedDayInSkyline] = useState<boolean>(loadShowSelectedDayInSkyline);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get('campaignId');
    if (cid) {
      setCampaignIdFromQuery(cid);
      setActiveCampaignId(cid);
    }
  }, [setActiveCampaignId]);

  // Load selected day label (if any) for this campaign.
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) {
      setSelectedDayLabel(null);
      return;
    }
    const payload = loadSelectedDayPayload();
    if (payload?.campaignId === cid) setSelectedDayLabel(payload.label);
    else setSelectedDayLabel(null);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  useEffect(() => { try { const d = (window as any).electronAPI?.onProjectionPoke?.(async () => { await refreshFromServer(); }); return () => { if (typeof d === 'function') d(); }; } catch {} }, [refreshFromServer]);

  const loadSkylineCharacter = useCallback(async () => {
    let charId: string | null | undefined = activeCampaign?.activeSkylineCharacter?.id;
    if (!charId && (campaignIdFromQuery || activeCampaign?.id)) {
      try {
        const fetched = await getActiveSkylineCharacterId(campaignIdFromQuery || activeCampaign?.id || '');
        charId = fetched ?? undefined;
      } catch {
        charId = undefined;
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

  const loadSkylineSettings = useCallback(async () => {
    const cid = campaignIdFromQuery || activeCampaign?.id;
    if (!cid) return;
    try {
      const settings = await getSkylineOverlaySettingsPublic(cid);
      setShowSongTitle(!!settings.showSongTitle);
      setShowInitiativeStrip(!!settings.showInitiativeStrip);
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Load active skyline character when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineCharacter(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineCharacter]);

  // Load skyline overlay settings when campaign context or query changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await loadSkylineSettings(); };
    run();
    return () => { cancelled = true; };
  }, [loadSkylineSettings]);

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
          if (data?.type === 'nowPlayingChanged' && data?.campaignId === cid) {
            // Cross-context robust update: re-fetch via public endpoint
            getCampaignNowPlayingTitlePublic(cid).then(r => setNowPlayingTitle(r.title || null)).catch(() => {});
          }
          if (data?.type === 'skylineSettingsChanged' && data?.campaignId === cid) {
            const st = data?.settings;
            if (typeof st?.showSongTitle === 'boolean') setShowSongTitle(!!st.showSongTitle);
            if (typeof st?.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!st.showInitiativeStrip);
            if (typeof st?.showCurrentTurnImage === 'boolean') setShowCurrentTurnImage(!!st.showCurrentTurnImage);
            if (typeof st?.currentTurnImagePosition === 'string') setCurrentTurnImagePosition(st.currentTurnImagePosition);
            if (st?.currentTurnImageSizes && typeof st.currentTurnImageSizes === 'object') setImageSizes(st.currentTurnImageSizes);
          }
          if (data?.type === 'initiativeStripUpdated' && data?.campaignId === cid) {
            const payload = data as any;
            const newStrip = { 
              battleStarted: !!payload.battleStarted, 
              enabled: !!payload.enabled, 
              currentTurnId: payload.currentTurnId || null, 
              items: (payload.items || []).map((x: any) => ({ 
                id: x.id, 
                name: x.name, 
                imageUrl: x.imageUrl ?? null, 
                fullImageUrl: x.fullImageUrl ?? null,
                size: x.size ?? null,
                role: x.role 
              })) 
            };
            // Only update if the content actually changed to prevent unnecessary re-renders and image flickering
            setInitiativeStrip(prev => {
              // Quick comparison: count, enabled, battleStarted, currentTurn
              if (prev.items.length !== newStrip.items.length) return newStrip;
              if (prev.enabled !== newStrip.enabled) return newStrip;
              if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
              if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
              // Deep comparison of items (id, name, imageUrl, fullImageUrl, size, role)
              for (let i = 0; i < prev.items.length; i++) {
                const p = prev.items[i];
                const n = newStrip.items[i];
                if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                  return newStrip;
                }
              }
              // No changes detected, keep previous reference
              return prev;
            });
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
    const doPoll = async () => {
      if (disposed) return;
      await loadSkylineCharacter();
      try {
        // Refresh skyline settings to ensure show/hide state updates across app/web contexts
        const settings = await getSkylineOverlaySettingsPublic(cid);
        setShowSongTitle(!!settings.showSongTitle);
        setShowInitiativeStrip(!!settings.showInitiativeStrip);
      } catch {}
      try {
        const r = await getCampaignNowPlayingTitlePublic(cid);
        setNowPlayingTitle(r.title || null);
      } catch {}
      try {
        const bs = await getCampaignBattleStatePublic(cid);
        setBattleStateStarted(!!bs.started);
        if (Array.isArray(bs.items)) {
          const newStrip = { 
            battleStarted: !!bs.started, 
            enabled: showInitiativeStrip, 
            currentTurnId: bs.currentTurnId || null, 
            items: bs.items.map((x) => ({ 
              id: x.id, 
              name: x.name, 
              imageUrl: x.imageUrl ?? null, 
              fullImageUrl: x.fullImageUrl ?? null,
              size: x.size ?? null,
              role: x.role 
            })) 
          };
          // Only update if the content actually changed to prevent unnecessary re-renders and image flickering
          setInitiativeStrip(prev => {
            if (prev.items.length !== newStrip.items.length) return newStrip;
            if (prev.enabled !== newStrip.enabled) return newStrip;
            if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
            if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
            // Deep comparison of items (id, name, imageUrl, fullImageUrl, size, role)
            for (let i = 0; i < prev.items.length; i++) {
              const p = prev.items[i];
              const n = newStrip.items[i];
              if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                return newStrip;
              }
            }
            return prev;
          });
        }
      } catch {}
    };
    // Immediate poll once
    doPoll();
    const interval = setInterval(doPoll, intervalMs);
    return () => { disposed = true; clearInterval(interval); };
  }, [activeCampaign?.id, campaignIdFromQuery, loadSkylineCharacter]);

  // On mount or campaign change, read last-known initiative strip from localStorage
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.campaignId === cid) {
          const newStrip = { 
            battleStarted: !!payload.battleStarted, 
            enabled: !!payload.enabled, 
            currentTurnId: payload.currentTurnId || null, 
            items: (payload.items || []).map((x: any) => ({ 
              id: x.id, 
              name: x.name, 
              imageUrl: x.imageUrl ?? null, 
              fullImageUrl: x.fullImageUrl ?? null,
              size: x.size ?? null,
              role: x.role 
            })) 
          };
          // Only update if content changed
          setInitiativeStrip(prev => {
            if (prev.items.length !== newStrip.items.length) return newStrip;
            if (prev.enabled !== newStrip.enabled) return newStrip;
            if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
            if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
            for (let i = 0; i < prev.items.length; i++) {
              const p = prev.items[i];
              const n = newStrip.items[i];
              if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                return newStrip;
              }
            }
            return prev;
          });
        }
      }
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // On mount or campaign change, read last-known skyline settings from localStorage
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    try {
      const raw = localStorage.getItem('app.skyline.settingsUpdated');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.campaignId === cid) {
          if (typeof payload.showSongTitle === 'boolean') setShowSongTitle(!!payload.showSongTitle);
          if (typeof payload.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!payload.showInitiativeStrip);
        }
      }
    } catch {}
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Rehydrate battle state from localStorage based on active encounter
  useEffect(() => {
    const cid = activeCampaign?.id || campaignIdFromQuery;
    if (!cid) return;
    let disposed = false;
    (async () => {
      try {
        const encId = await getActiveEncounterId(cid);
        if (!encId) { if (!disposed) setBattleStateStarted(false); return; }
        const key = `battle.state:${cid}:${encId}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const obj = JSON.parse(raw);
            if (!disposed) setBattleStateStarted(!!obj?.started);
          }
        } catch { if (!disposed) setBattleStateStarted(false); }
        const handler = (e: StorageEvent) => {
          if (e.key !== key) return;
          try {
            const obj = e.newValue ? JSON.parse(e.newValue) : null;
            if (!obj) return;
            setBattleStateStarted(!!obj.started);
          } catch {}
        };
        window.addEventListener('storage', handler);
        return () => { window.removeEventListener('storage', handler); };
      } catch { if (!disposed) setBattleStateStarted(false); }
    })();
    return () => { disposed = true; };
  }, [activeCampaign?.id, campaignIdFromQuery]);

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

  // Listen to storage events for now-playing changes cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.nowPlaying') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          setNowPlayingTitle(payload.title || null);
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to storage events for skyline settings changes cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.settingsUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          if (typeof payload.showSongTitle === 'boolean') setShowSongTitle(!!payload.showSongTitle);
          if (typeof payload.showInitiativeStrip === 'boolean') setShowInitiativeStrip(!!payload.showInitiativeStrip);
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to storage events for initiative strip updates cross-window
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'app.skyline.initiativeStrip') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) return;
        const cid = payload.campaignId as string | undefined;
        if (!cid) return;
        if (cid === (activeCampaign?.id || campaignIdFromQuery)) {
          const newStrip = { 
            battleStarted: !!payload.battleStarted, 
            enabled: !!payload.enabled, 
            currentTurnId: payload.currentTurnId || null, 
            items: (payload.items || []).map((x: any) => ({ 
              id: x.id, 
              name: x.name, 
              imageUrl: x.imageUrl ?? null, 
              fullImageUrl: x.fullImageUrl ?? null,
              size: x.size ?? null,
              role: x.role 
            })) 
          };
          // Only update if content changed to prevent flickering
          setInitiativeStrip(prev => {
            if (prev.items.length !== newStrip.items.length) return newStrip;
            if (prev.enabled !== newStrip.enabled) return newStrip;
            if (prev.battleStarted !== newStrip.battleStarted) return newStrip;
            if (prev.currentTurnId !== newStrip.currentTurnId) return newStrip;
            for (let i = 0; i < prev.items.length; i++) {
              const p = prev.items[i];
              const n = newStrip.items[i];
              if (p.id !== n.id || p.name !== n.name || p.imageUrl !== n.imageUrl || p.fullImageUrl !== n.fullImageUrl || p.size !== n.size || p.role !== n.role) {
                return newStrip;
              }
            }
            return prev;
          });
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  // Listen to diary storage events cross-window (selected day + preference)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      const cid = activeCampaign?.id || campaignIdFromQuery;
      if (!cid) return;

      if (e.key === SHOW_DAY_IN_SKYLINE_KEY) {
        if (e.newValue === null) setShowSelectedDayInSkyline(true);
        else setShowSelectedDayInSkyline(e.newValue === 'true');
        return;
      }

      if (e.key !== SELECTED_DAY_KEY) return;

      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (!payload) {
          setSelectedDayLabel(null);
          return;
        }
        if (payload.campaignId === cid && typeof payload.label === 'string') {
          setSelectedDayLabel(payload.label);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeCampaign?.id, campaignIdFromQuery]);

  const skylineAvatar = useMemo(() => {
    if (!skylineCharacter) return null;
    const initials = (skylineCharacter.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    const avatarBg = skylineCharacter.tokenColor || '#263238';
    const src = skylineCharacter.characterImageUrl || skylineCharacter.tokenImageUrl || undefined;
    return (
      <StackedCharacterOverlay src={src} initials={initials} bg={avatarBg} />
    );
  }, [skylineCharacter]);

  // Calculate current turn participant for image display
  const currentTurnParticipant = React.useMemo(() => {
    if (!initiativeStrip?.currentTurnId) return null;
    return initiativeStrip.items.find(it => it.id === initiativeStrip.currentTurnId) || null;
  }, [initiativeStrip]);

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
      {showSongTitle && nowPlayingTitle ? (
        <Box sx={{ position: 'absolute', top: 16, left: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1 }}>
          <Typography variant="subtitle1" color="white" noWrap title={nowPlayingTitle}>{nowPlayingTitle}</Typography>
        </Box>
      ) : null}

      {showSelectedDayInSkyline && selectedDayLabel ? (
        <Box sx={{ position: 'absolute', top: 16, right: 16, px: 1.5, py: 0.75, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, maxWidth: '45vw' }}>
          <Typography variant="subtitle1" color="white" noWrap title={selectedDayLabel}>{selectedDayLabel}</Typography>
        </Box>
      ) : null}

      {/* Current turn image overlay */}
      {showCurrentTurnImage && currentTurnParticipant && currentTurnParticipant.fullImageUrl && (initiativeStrip?.battleStarted || battleStateStarted) ? (() => {
        // Get size category (default to Medium if not specified)
        const sizeCategory = currentTurnParticipant.size || 'Medium';
        const sizeVw = imageSizes[sizeCategory] || imageSizes['Medium'] || 30;
        
        // Calculate position based on currentTurnImagePosition
        let positionSx: any = { position: 'absolute' };
        switch (currentTurnImagePosition) {
          case 'center-center':
            positionSx = { ...positionSx, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            break;
          case 'center-right':
            positionSx = { ...positionSx, top: '50%', right: 32, transform: 'translateY(-50%)' };
            break;
          case 'center-left':
            positionSx = { ...positionSx, top: '50%', left: 32, transform: 'translateY(-50%)' };
            break;
          case 'top-center':
            positionSx = { ...positionSx, top: 32, left: '50%', transform: 'translateX(-50%)' };
            break;
          case 'top-right':
            positionSx = { ...positionSx, top: 32, right: 32 };
            break;
          case 'top-left':
            positionSx = { ...positionSx, top: 32, left: 32 };
            break;
          case 'bottom-center':
            positionSx = { ...positionSx, bottom: 32, left: '50%', transform: 'translateX(-50%)' };
            break;
          case 'bottom-right':
            positionSx = { ...positionSx, bottom: 32, right: 32 };
            break;
          case 'bottom-left':
            positionSx = { ...positionSx, bottom: 32, left: 32 };
            break;
          default:
            positionSx = { ...positionSx, top: '50%', right: 32, transform: 'translateY(-50%)' };
        }
        
        return (
          <Box 
            sx={{ 
              ...positionSx,
              width: `${sizeVw}vw`,
              maxWidth: 800,
              minWidth: 150,
            }}
          >
            <AuthImage
              src={currentTurnParticipant.fullImageUrl}
              alt=""
              style={{ 
                width: '100%', 
                height: 'auto',
                display: 'block'
              }}
            />
          </Box>
        );
      })() : null}

      {showInitiativeStrip && (initiativeStrip?.battleStarted || battleStateStarted) && initiativeStrip?.enabled && (initiativeStrip.items?.length > 0) ? (
        <Box sx={{ position: 'absolute', bottom: 16, left: 16, px: 1, py: 0.75, bgcolor: 'rgba(0, 0, 0, 0)', borderRadius: 1, display: 'flex', alignItems: 'end', gap: 1 }}>
          {initiativeStrip.items.slice(0, 10).map((it) => {
            const isCurrent = initiativeStrip.currentTurnId === it.id;
            const sz = isCurrent ? 100 : 24;
            const borderColor = it.role === 'foe' ? '#f44336' : '#4caf50';
            return (
              <Box key={it.id} sx={{ display: 'flex', alignItems: 'end', bgcolor: 'rgba(0, 0, 0, 0.56)', borderRadius: 4, gap: 0.5 }}>
                {it.imageUrl ? (
                  <Box
                    sx={{
                      width: sz,
                      height: sz,
                      borderRadius: 4,
                      border: `3px solid ${borderColor}`,
                      overflow: 'hidden',
                    }}
                  >
                    <AuthImage
                      src={it.imageUrl}
                      alt={it.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ width: sz, height: sz, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.15)', border: `3px solid ${borderColor}` }} />
                )}
                <Typography variant="caption" color="white" noWrap sx={{ maxWidth: 120 }}>{it.name}</Typography>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
};

const StackedCharacterOverlay: React.FC<{ src?: string; initials: string; bg: string }> = ({ src, initials, bg }) => {
  const size = '60vh';
  return (
    <Box sx={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {src ? (
        <Box sx={{ width: size, height: size, borderRadius: 2, overflow: 'hidden', boxShadow: 4, border: 'none', bgcolor: 'transparent' }}>
          <AuthImage
            src={src}
            alt={initials}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' }}
          />
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