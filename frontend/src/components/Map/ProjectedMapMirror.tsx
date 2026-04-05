import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, MenuItem, Stack, Button, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useActiveMap } from './ActiveMapContext';
import AuthImage from '../common/AuthImage';
import { getMapImageUrlSized, getMapSkylineUrlSized, listMaps, listMapMarkers, MapItemDto, MapMarkerDto } from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import MapMarkerDetail from './MapMarkerDetail';
import MapMarkerDialog from './MapMarkerDialog';
import MapGridOverlay, { GridSettings } from './MapGridOverlay';
import FogOfWarOverlay from './FogOfWarOverlay';
import FogEditorLayer from './FogEditorLayer';
import OrganicFogOverlay from './OrganicFogOverlay';
import OrganicFogEditorLayer from './OrganicFogEditorLayer';
import type { OrganicFogTool } from './OrganicFogEditorLayer';
import { useFogOfWar } from '../../hooks/useFogOfWar';
import { useOrganicFog } from '../../hooks/useOrganicFog';
import { getGridOverlaySettings, setGridOverlaySettings } from '../../api/campaigns/gridOverlay';
import { getFogOfWarSettings, setFogOfWarSettings } from '../../api/campaigns/fogOfWar';
import type { FogMode } from '../../api/campaigns/fogOfWar';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useMapTokens } from '../../hooks/useMapTokens';
import MapTokensOverlay, { TokenEditMode } from './MapTokensOverlay';
import { computeAllFogCells, computeClearedFogByAllies, subtractClearedFog, computeAllyRevealStrokes, computeLightRevealStrokes, computeClearedFogByLights } from '../../utils/fogHelpers';
import ProjectedMapMirrorTools from './ProjectedMapMirrorTools';
import type { TokenCandidate } from './ProjectedMapMirrorTools';
import { useMapFogPreviewStyle } from '../../hooks/useMapFogPreviewStyle';
import { useCharacterTokenImageResolver } from '../../hooks/useCharacterTokenImageResolver';
import { TokenQuickInfoPopover } from './TokenQuickInfoPopover';
import MapElementsEditorLayer from './MapElementsEditorLayer';
import type { ElementEditorTool } from './MapElementsEditorLayer';
import ElementsPreviewLayer from './ElementsPreviewLayer';
import { useMapElements } from '../../hooks/useMapElements';
import type { MapElement, MapLightElement, MapDoorElement, MapWindowElement } from '../../api/mapElements';
import SkylineViewportContent from '../Skyline/SkylineViewportContent';
// removed duplicate import

const ProjectedMapMirror: React.FC<{
  fogEnabled?: boolean;
  highlightTokenId?: string | null;
  tokenImageResolver?: (id: string) => string | undefined;
  /** Optional: expose token preparation actions (Combat preview only). */
  onPrepareTokens?: (which: 'allies' | 'foes' | 'all') => void;
  /** Optional: list allies/foes to create tokens individually (Combat preview only). */
  tokenCandidates?: {
    allies: TokenCandidate[];
    foes: TokenCandidate[];
  };
  /** Optional: create one token for a given candidate (Combat preview only). */
  onCreateTokenForCandidate?: (candidate: TokenCandidate) => void;
  /** Optional: ids already present on the map (to disable duplicates in UI). */
  existingTokenIds?: Set<string>;
  /**
   * When provided and the user selects "custom" mode in settings, these values
   * override the real secondary-window sizes reported via Electron/localStorage.
   */
  customPlayersSize?: { width: number; height: number } | null;
  customSkylineSize?: { width: number; height: number } | null;
  /** When true, customPlayersSize / customSkylineSize are used instead of dynamic sizes. */
  useCustomSizes?: boolean;
}> = ({
  fogEnabled = false,
  highlightTokenId = null,
  tokenImageResolver,
  onPrepareTokens,
  tokenCandidates,
  onCreateTokenForCandidate,
  existingTokenIds,
  customPlayersSize = null,
  customSkylineSize = null,
  useCustomSizes = false,
}) => {
  const { activeMapId } = useActiveMap();
  const { timeOfDay } = useTimeOfDay();
  const [overrideMapId, setOverrideMapId] = useState<string | null>(null);
  const [projectionSize, setProjectionSize] = useState<{ width: number; height: number; dpr?: number } | null>(null);
  const [skylineSize, setSkylineSize] = useState<{ width: number; height: number; dpr?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(0.5);
  const [activeTransform, setActiveTransform] = useState<{ zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number } | null>(null);
  const [previewMode, setPreviewMode] = useState<'players' | 'skyline'>('players');
  const [gridSettings, setGridSettings] = useState<GridSettings>({ enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 });
  const { activeCampaign } = useActiveCampaign();
  const mapId = overrideMapId || activeMapId;
  const { cells, addCell, removeCell, clearAll, setAll } = useFogOfWar(activeCampaign?.id, mapId || undefined, gridSettings);
  const { strokes: organicStrokes, addStroke: addOrganicStroke, setAllStrokes: setAllOrganicStrokes, clearAll: clearAllOrganicStrokes } = useOrganicFog(activeCampaign?.id, mapId || undefined);
  const { style: fogPreviewStyle, setColor: setFogPreviewColor, setOpacity: setFogPreviewOpacity } = useMapFogPreviewStyle(mapId || undefined);
  const [fogTool, setFogTool] = useState<'paint' | 'erase'>('paint');
  const [organicFogTool, setOrganicFogTool] = useState<OrganicFogTool>('reveal');
  const [organicBrushRadius, setOrganicBrushRadius] = useState<number>(() => {
    try { const raw = localStorage.getItem('app.map.organicBrushRadius'); const n = raw ? parseInt(raw, 10) : 20; return Number.isFinite(n) ? Math.max(5, Math.min(300, n)) : 20; } catch { return 20; }
  });
  const [fogMode, setFogModeState] = useState<FogMode>(() => {
    try { const v = localStorage.getItem('app.map.fogMode'); if (v === 'organic' || v === 'grid') return v; } catch {}
    return 'grid';
  });
  const [fogEditEnabled, setFogEditEnabled] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [tokenMode, setTokenMode] = useState<TokenEditMode>('none');
  const { tokens, addToken, updateToken, removeToken, setTokens } = useMapTokens(activeCampaign?.id, mapId || undefined);
  const { resolver: defaultTokenImageResolver } = useCharacterTokenImageResolver(activeCampaign?.id);
  const [tokenInfo, setTokenInfo] = useState<{ token: import('../../api/maps').MapTokenPayload; pos: { left: number; top: number } } | null>(null);
  const [confirmClearTokens, setConfirmClearTokens] = useState(false);
  const [allyClearRadius, setAllyClearRadius] = useState<number>(() => {
    try { const raw = localStorage.getItem('app.map.allyClearRadius'); const n = raw ? parseInt(raw, 10) : 1; return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1; } catch { return 1; }
  });

  // --- Map elements (walls, doors, windows, lights) ---
  const { elements, addElement, updateElement, removeElement, clearAll: clearAllElements, setAll: setAllElements } = useMapElements(activeCampaign?.id, mapId || undefined);
  const [elementsEditEnabled, setElementsEditEnabled] = useState<boolean>(false);
  const [elementTool, setElementTool] = useState<ElementEditorTool>('select');
  const [selectedElement, setSelectedElement] = useState<MapElement | null>(null);
  const [newLightRadius, setNewLightRadius] = useState<number>(80);

  // Token visualization settings (guide dots and cell shading)
  const [showGuideDots, setShowGuideDots] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showTokenAnchors');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [showCellShading, setShowCellShading] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showTokenShadow');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  // --- Markers state ---
  const [showMarkers, setShowMarkers] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.map.showMarkers');
      return val === 'true';
    } catch { return false; }
  });
  const [markers, setMarkers] = useState<MapMarkerDto[]>([]);

  // Persist markers toggle
  useEffect(() => {
    try { localStorage.setItem('app.map.showMarkers', String(showMarkers)); } catch { /* noop */ }
  }, [showMarkers]);

  // Fetch markers when toggle is on and a map is active
  const loadMarkers = useCallback(async () => {
    if (!showMarkers || !mapId || !activeCampaign?.id) { setMarkers([]); return; }
    try {
      const list = await listMapMarkers(mapId, activeCampaign.id);
      setMarkers(list);
    } catch { setMarkers([]); }
  }, [showMarkers, mapId, activeCampaign?.id]);

  useEffect(() => { loadMarkers(); }, [loadMarkers]);

  const [detailMarker, setDetailMarker] = useState<MapMarkerDto | null>(null);
  const [editingMarker, setEditingMarker] = useState<MapMarkerDto | null>(null);
  const [addMarkerMode, setAddMarkerMode] = useState(false);
  const [createMarkerPos, setCreateMarkerPos] = useState<{ x: number; y: number } | null>(null);
  const [assocMaps, setAssocMaps] = useState<MapItemDto[]>([]);
  const [assocChars, setAssocChars] = useState<CharacterPayload[]>([]);
  const [assocEnemies, setAssocEnemies] = useState<CampaignMonsterListItem[]>([]);
  const [assocEncounters, setAssocEncounters] = useState<EncounterSummary[]>([]);

  // Lazy-fetch association lists when markers are shown
  useEffect(() => {
    if (!showMarkers || !activeCampaign?.id) return;
    let alive = true;
    Promise.allSettled([
      listMaps({ campaignId: activeCampaign.id }),
      listCharacters(activeCampaign.id),
      listCampaignMonsters(activeCampaign.id, { pageSize: 9999 }, 'en'),
      listEncounters(activeCampaign.id),
    ]).then(([mRes, cRes, eRes, enRes]) => {
      if (!alive) return;
      if (mRes.status === 'fulfilled') setAssocMaps(mRes.value);
      if (cRes.status === 'fulfilled') setAssocChars(cRes.value as CharacterPayload[]);
      if (eRes.status === 'fulfilled') setAssocEnemies((eRes.value as any).items ?? eRes.value);
      if (enRes.status === 'fulfilled') setAssocEncounters(enRes.value);
    });
    return () => { alive = false; };
  }, [showMarkers, activeCampaign?.id]);

  // Listen for token visualization setting changes from other windows
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.onmessage = (e: MessageEvent) => {
        const data = e?.data;
        if (!data || data.type !== 'tokenVisualizationUpdated') return;
        if (data.campaignId !== activeCampaign?.id) return;
        
        if (typeof data.showTokenAnchors === 'boolean') {
          setShowGuideDots(data.showTokenAnchors);
        }
        if (typeof data.showTokenShadow === 'boolean') {
          setShowCellShading(data.showTokenShadow);
        }
      };
    } catch {}

    return () => {
      try {
        bc?.close();
      } catch {}
    };
  }, [activeCampaign?.id]);

  // Load FoW settings from server (campaign-scoped) so Electron and Web match even across origins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeCampaign?.id) return;
        const s = await getFogOfWarSettings(activeCampaign.id);
        if (cancelled) return;
        const v = Number.isFinite(s?.allyClearRadius as any) ? Math.max(0, Math.min(10, Math.floor(Number((s as any).allyClearRadius)))) : 1;
        setAllyClearRadius(v);
        try { localStorage.setItem('app.map.allyClearRadius', String(v)); } catch {}
        // Restore fogMode
        if (s?.fogMode === 'organic' || s?.fogMode === 'grid') {
          setFogModeState(s.fogMode);
          try { localStorage.setItem('app.map.fogMode', s.fogMode); } catch {}
        }
      } catch {
        // Keep local fallback
        try {
          const localMode = localStorage.getItem('app.map.fogMode');
          if (localMode === 'organic' || localMode === 'grid') setFogModeState(localMode);
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [activeCampaign?.id]);

  // Persist radius and notify listeners (projection or other tabs)
  useEffect(() => {
    try { localStorage.setItem('app.map.allyClearRadius', String(allyClearRadius)); } catch {}
    try { const bc = new BroadcastChannel('campaign-sync'); bc.postMessage({ type: 'ally-clear-radius-updated', value: allyClearRadius, at: Date.now() }); bc.close(); } catch {}
    // Persist to server so browser clients (different origin) receive the same value.
    (async () => {
      try {
        if (activeCampaign?.id) await setFogOfWarSettings(activeCampaign.id, { allyClearRadius, fogMode });
      } catch {
        // ignore
      }
    })();
  }, [allyClearRadius, activeCampaign?.id, fogMode]);

  // Persist organic brush radius
  useEffect(() => {
    try { localStorage.setItem('app.map.organicBrushRadius', String(organicBrushRadius)); } catch {}
  }, [organicBrushRadius]);

  // Handler to change fog mode (persists to server + localStorage + BC)
  const setFogMode = useCallback((mode: FogMode) => {
    setFogModeState(mode);
    try { localStorage.setItem('app.map.fogMode', mode); } catch {}
    try {
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({ type: 'fog-mode-updated', fogMode: mode, at: Date.now() });
      bc.close();
    } catch {}
  }, []);

  // Compute fog after clearing around allied tokens (own cell + adjacent)
  const effectiveFogCells = React.useMemo(() => {
    try {
      const mapW = naturalSize?.w || 0;
      const mapH = naturalSize?.h || 0;
      const cleared = computeClearedFogByAllies(gridSettings, tokens || [], allyClearRadius, elements, timeOfDay, mapW, mapH);
      const lightCleared = computeClearedFogByLights(gridSettings, elements, timeOfDay, mapW, mapH);
      const combined = new Set([...cleared, ...lightCleared]);
      return subtractClearedFog(cells, combined);
    } catch {
      return cells;
    }
  }, [cells, tokens, gridSettings, allyClearRadius, elements, timeOfDay, naturalSize]);

  const resolveTokenImage = React.useCallback((id: string) => {
    const resolver = tokenImageResolver || defaultTokenImageResolver;
    return resolver ? resolver(id) : undefined;
  }, [tokenImageResolver, defaultTokenImageResolver]);

  // Load grid settings (server-preferred, fallback to localStorage)
  useEffect(() => {
    const KEY = 'app.map.grid.settings';
    (async () => {
      try {
        if (activeCampaign?.id) {
          const srv = await getGridOverlaySettings(activeCampaign.id);
          setGridSettings(srv);
          try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch {}
          return;
        }
      } catch {}
      try { const raw = localStorage.getItem(KEY); if (raw) setGridSettings((s) => ({ ...s, ...JSON.parse(raw) })); } catch {}
    })();
  }, [activeCampaign?.id]);

  const saveGrid = (next: Partial<GridSettings>) => {
    setGridSettings((prev) => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem('app.map.grid.settings', JSON.stringify(merged)); } catch {}
      try { const bc = new BroadcastChannel('campaign-sync'); bc.postMessage({ type: 'map-grid-updated', at: Date.now() }); bc.close(); } catch {}
      // Persist to server to reach browser players on other devices
      (async () => { try { if (activeCampaign?.id) await setGridOverlaySettings(activeCampaign.id, merged as any); } catch {} })();
      return merged;
    });
  };

  // Restore persisted zoom
  useEffect(() => {
    try {
      const raw = localStorage.getItem('app.projection.previewZoom');
      const z = raw ? parseFloat(raw) : NaN;
      if (!isNaN(z) && z > 0.05 && z <= 1.5) setPreviewZoom(z);
    } catch {}
  }, []);

  // Persist zoom
  useEffect(() => {
    try { localStorage.setItem('app.projection.previewZoom', String(previewZoom)); } catch {}
  }, [previewZoom]);

  // Sync tokenInfo when tokens change (from server or broadcast)
  useEffect(() => {
    if (!tokenInfo?.token?.id) return;
    const updatedToken = tokens.find(t => t.id === tokenInfo.token.id);
    if (updatedToken) {
      setTokenInfo(prev => prev ? { ...prev, token: updatedToken } : null);
    }
  }, [tokens, tokenInfo?.token?.id]);

  // Note: onProjectionMapShow removed; we rely on server-side activeMap state.

  // Load current active map transform to preview it accurately
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!activeMapId) { setActiveTransform(null); return; }
        const maps = await listMaps({});
        const m = maps.find(x => x.id === activeMapId);
        if (!cancelled) setActiveTransform((m as any)?.transform || null);
      } catch { if (!cancelled) setActiveTransform(null); }
    })();
    return () => { cancelled = true; };
  }, [activeMapId]);

  const persistTransform = async (next: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number }) => {
    try {
      if (!activeMapId) return;
      const { updateMap } = await import('../../api/maps');
      await updateMap(activeMapId, { transform: next });
      setActiveTransform(next);
      // Notify other windows/tabs (projection) to refresh transform immediately
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-transform-updated', mapId: activeMapId, at: Date.now() });
        bc.close();
      } catch {}
      // Fallback: storage ping to wake other tabs in browsers without BC (rare) or cross-context
      try { localStorage.setItem('app.lastMapTransformUpdate', String(Date.now())); } catch {}
  try { window.electronAPI?.projectionPoke?.({ reason: 'map-transform-updated' }); } catch {}
    } catch {}
  };

  // Suscribirse al tamaño de proyección (IPC) y leer valor inicial de localStorage
  useEffect(() => {
    const KEY_SIZE = 'app.projection.size';
    try {
      const raw = localStorage.getItem(KEY_SIZE);
      if (raw) setProjectionSize(JSON.parse(raw));
    } catch {}
    const dispose = window.electronAPI?.onProjectionSize?.((payload: { width: number; height: number; dpr?: number }) => {
      setProjectionSize(payload);
      try { localStorage.setItem(KEY_SIZE, JSON.stringify(payload)); } catch {}
    });
    return () => { if (typeof dispose === 'function') dispose(); };
  }, []);

  // Suscribirse al tamaño de la proyección Skyline
  useEffect(() => {
    const KEY_SIZE = 'app.projection.skyline.size';
    try {
      const raw = localStorage.getItem(KEY_SIZE);
      if (raw) setSkylineSize(JSON.parse(raw));
    } catch {}
    // Skyline size comes via a different IPC bridge in preload; keep reading from localStorage updates.
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY_SIZE && ev.newValue) {
        try { setSkylineSize(JSON.parse(ev.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);

  const baseSize = previewMode === 'players'
    ? (useCustomSizes && customPlayersSize ? customPlayersSize : projectionSize)
    : (useCustomSizes && customSkylineSize ? customSkylineSize : skylineSize);
  const scale = useMemo(() => {
    if (!baseSize) return 1;
    const s = previewZoom;
    return isFinite(s) && s > 0 ? s : 1;
  }, [baseSize, previewZoom]);

  const contentW = naturalSize?.w || baseSize?.width || 0;
  const contentH = naturalSize?.h || baseSize?.height || 0;

  // Compute organic fog strokes with ally-clearing reveal circles appended
  const effectiveOrganicStrokes = React.useMemo(() => {
    const allyReveals = computeAllyRevealStrokes(gridSettings, tokens || [], allyClearRadius, contentW, contentH, elements, timeOfDay);
    const lightReveals = computeLightRevealStrokes(elements, timeOfDay, contentW, contentH);
    const extra = [...allyReveals, ...lightReveals];
    if (extra.length === 0) return organicStrokes;
    return [...organicStrokes, ...extra];
  }, [organicStrokes, tokens, gridSettings, allyClearRadius, contentW, contentH, elements, timeOfDay]);

  // Compute lights that have showInPreview=true (for quick toggles in toolbar)
  const previewLights = useMemo(() => {
    return elements.filter((el): el is MapLightElement => el.type === 'light' && el.showInPreview);
  }, [elements]);

  /** Elements (lights, doors, windows) visible in preview mode. */
  const previewElements = useMemo(
    () => elements.filter(
      (el): el is MapLightElement | MapDoorElement | MapWindowElement =>
        (el.type === 'light' || el.type === 'door' || el.type === 'window') && !!(el as any).showInPreview,
    ),
    [elements],
  );

  // Capa que simula la ventana secundaria: marco escalado con fondo negro
  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">
            Vista previa ({previewMode === 'players' ? 'Ventana de jugadores' : 'Skyline'})
            {baseSize ? ` — ${baseSize.width}×${baseSize.height}${'dpr' in baseSize && (baseSize as any).dpr ? ` @${(baseSize as any).dpr}x` : ''}` : ''}
          </Typography>
          <ToggleButtonGroup size="small" exclusive value={previewMode} onChange={(_e, val) => { if (val) setPreviewMode(val); }}>
            <ToggleButton value="players">Jugadores</ToggleButton>
            <ToggleButton value="skyline">Skyline</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <TextField
          select
          size="small"
          label="Escala"
          value={String(previewZoom)}
          onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
          sx={{ width: 130 }}
        >
          <MenuItem value={"0.25"}>25%</MenuItem>
          <MenuItem value={"0.5"}>50%</MenuItem>
          <MenuItem value={"0.75"}>75%</MenuItem>
          <MenuItem value={"1"}>100%</MenuItem>
        </TextField>
      </Stack>
      {previewMode === 'players' && (
        <ProjectedMapMirrorTools
          canMoveScenario={!!activeMapId}
          onZoomIn={() => persistTransform({ ...(activeTransform || {}), zoom: Math.min(8, (activeTransform?.zoom ?? 1) * 1.1) })}
          onZoomOut={() => persistTransform({ ...(activeTransform || {}), zoom: Math.max(0.05, (activeTransform?.zoom ?? 1) / 1.1) })}
          onMoveLeft={() => persistTransform({ ...(activeTransform || {}), translateXPct: (activeTransform?.translateXPct ?? 0) - 5 })}
          onMoveRight={() => persistTransform({ ...(activeTransform || {}), translateXPct: (activeTransform?.translateXPct ?? 0) + 5 })}
          onMoveUp={() => persistTransform({ ...(activeTransform || {}), translateYPct: (activeTransform?.translateYPct ?? 0) - 5 })}
          onMoveDown={() => persistTransform({ ...(activeTransform || {}), translateYPct: (activeTransform?.translateYPct ?? 0) + 5 })}
          onRotatePlus90={() => persistTransform({ ...(activeTransform || {}), rotationDeg: (activeTransform?.rotationDeg ?? 0) + 90 })}
          onRotateMinus90={() => persistTransform({ ...(activeTransform || {}), rotationDeg: (activeTransform?.rotationDeg ?? 0) - 90 })}
          onResetTransform={() => persistTransform({ zoom: 1, rotationDeg: 0, translateXPct: 0, translateYPct: 0 })}

          gridSettings={gridSettings}
          onSaveGrid={saveGrid}

          fogEnabled={fogEnabled}
          fogEditEnabled={fogEditEnabled}
          onSetFogEditEnabled={setFogEditEnabled}
          fogMode={fogMode}
          onSetFogMode={setFogMode}
          fogTool={fogTool}
          onSetFogTool={setFogTool}
          fogPreviewColor={fogPreviewStyle.color}
          onSetFogPreviewColor={setFogPreviewColor}
          fogPreviewOpacity={fogPreviewStyle.opacity}
          onSetFogPreviewOpacity={setFogPreviewOpacity}
          allyClearRadius={allyClearRadius}
          onSetAllyClearRadius={setAllyClearRadius}
          canFogFillAll={!!contentW && !!contentH}
          onFogFillAll={() => {
            if (!contentW || !contentH) return;
            setAll(computeAllFogCells(gridSettings, contentW, contentH));
          }}
          onFogClearAll={() => clearAll()}
          organicFogTool={organicFogTool}
          onSetOrganicFogTool={setOrganicFogTool}
          organicBrushRadius={organicBrushRadius}
          onSetOrganicBrushRadius={setOrganicBrushRadius}
          onOrganicFogClearAll={() => clearAllOrganicStrokes()}
          onOrganicFogFillAll={() => {
            // "Fill all" in organic mode: add a single huge stroke covering the entire map
            setAllOrganicStrokes([{ points: [{ x: 0.5, y: 0.5 }], radius: Math.max(contentW || 1, contentH || 1), mode: 'fog' }]);
          }}

          tokenMode={tokenMode}
          onSetTokenMode={setTokenMode}
          onPrepareTokens={onPrepareTokens}
          tokenCandidates={tokenCandidates}
          onCreateTokenForCandidate={onCreateTokenForCandidate}
          existingTokenIds={existingTokenIds}
          onClearAllTokens={() => setConfirmClearTokens(true)}

          showMarkers={showMarkers}
          onToggleMarkers={setShowMarkers}
          addMarkerMode={addMarkerMode}
          onToggleAddMarkerMode={(v) => { setAddMarkerMode(v); if (v) setShowMarkers(true); }}

          elementsEditEnabled={elementsEditEnabled}
          onSetElementsEditEnabled={setElementsEditEnabled}
          elementTool={elementTool}
          onSetElementTool={setElementTool}
          elements={elements}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onUpdateElement={updateElement}
          onRemoveElement={removeElement}
          onClearAllElements={clearAllElements}
          newLightRadius={newLightRadius}
          onSetNewLightRadius={setNewLightRadius}
          previewLights={previewLights}
          onToggleLight={(id) => {
            const light = elements.find(el => el.id === id);
            if (light?.type === 'light') updateElement(id, { isOn: !light.isOn } as any);
          }}
        />
      )}
      <Box ref={containerRef} sx={{ width: '100%', overflow: 'auto' }}>
        {baseSize ? (
          <Box
            sx={{
              width: Math.round(baseSize.width * scale),
              height: Math.round(baseSize.height * scale),
              margin: '0 auto',
              position: 'relative',
            }}
          >
            {/* Inner unscaled frame scaled uniformly via CSS transform */}
            <Box
              sx={{
                width: baseSize.width,
                height: baseSize.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                bgcolor: 'black',
                borderRadius: 1,
                position: 'absolute',
                left: 0,
                top: 0,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {mapId ? (
                  <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                    {previewMode === 'players' ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) translate(${activeTransform?.translateXPct ?? 0}%, ${activeTransform?.translateYPct ?? 0}%) rotate(${activeTransform?.rotationDeg ?? 0}deg) scale(${activeTransform?.zoom ?? 1})`,
                          transformOrigin: 'center center',
                        }}
                      >
                        <Box sx={{ position: 'relative', width: contentW, height: contentH }}>
                          <AuthImage
                            src={getMapImageUrlSized(mapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
                            alt="Mapa proyectado"
                            style={{ display: 'block' }}
                            onLoad={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              const w = img.naturalWidth || img.width;
                              const h = img.naturalHeight || img.height;
                              if (w && h) setNaturalSize({ w, h });
                            }}
                          />
                          {/* Fog overlay (master shading) */}
                          {fogEnabled && fogMode === 'grid' && (
                            <FogOfWarOverlay
                              mode="master"
                              grid={gridSettings}
                              widthPx={contentW}
                              heightPx={contentH}
                              cells={effectiveFogCells}
                              masterColor={fogPreviewStyle.color}
                              masterOpacity={fogPreviewStyle.opacity}
                            />
                          )}
                          {fogEnabled && fogMode === 'organic' && (
                            <OrganicFogOverlay
                              mode="master"
                              widthPx={contentW}
                              heightPx={contentH}
                              strokes={effectiveOrganicStrokes}
                              masterColor={fogPreviewStyle.color}
                              masterOpacity={fogPreviewStyle.opacity}
                            />
                          )}
                          {/* Overlay grid follows the same transform */}
                          {gridSettings.enabled && (
                            <MapGridOverlay
                              settings={gridSettings}
                              redrawKey={scale}
                              widthPx={contentW}
                              heightPx={contentH}
                            />
                          )}
                          {/* Tokens overlay (editable in preview) */}
                          <TokensBridge
                            gridSettings={gridSettings}
                            widthPx={contentW}
                            heightPx={contentH}
                            mapId={mapId}
                            tokenMode={tokenMode}
                            previewScale={scale}
                            transform={activeTransform}
                            tokens={tokens}
                            onAddToken={addToken}
                            onMoveToken={(id, patch) => updateToken(id, patch)}
                            onRemoveToken={removeToken}
                            onSelectToken={(t, pos) => {
                              // Only show info popover in view/drag/rotate mode
                              if (tokenMode !== 'none') return;
                              setTokenInfo({ token: t, pos });
                            }}
                            highlightIds={(highlightTokenId ? new Set([highlightTokenId]) : null)}
                            tokenImageResolver={tokenImageResolver || defaultTokenImageResolver}
                            showGuideDots={showGuideDots}
                            showCellShading={showCellShading}
                          />
                          {/* Click-to-add marker overlay */}
                          {addMarkerMode && showMarkers && (
                            <Box
                              sx={{ position: 'absolute', inset: 0, zIndex: 12, cursor: 'crosshair' }}
                              onClick={(e) => {
                                // offsetX/offsetY are in the target's local coordinate space,
                                // already accounting for all CSS transforms (rotation, zoom, scale).
                                const pctX = (e.nativeEvent.offsetX / contentW) * 100;
                                const pctY = (e.nativeEvent.offsetY / contentH) * 100;
                                const clamp = (v: number) => Math.max(0, Math.min(100, v));
                                setCreateMarkerPos({ x: clamp(pctX), y: clamp(pctY) });
                                setAddMarkerMode(false);
                              }}
                            />
                          )}
                          {/* World-map markers overlay (preview only) */}
                          {showMarkers && markers.length > 0 && (
                            <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                              {markers.map((m) => (
                                <Box
                                  key={m.id}
                                  sx={{
                                    position: 'absolute',
                                    left: `${m.x}%`,
                                    top: `${m.y}%`,
                                    transform: `translate(-50%, -100%) scale(${1 / (activeTransform?.zoom ?? 1)})`,
                                    transformOrigin: '50% 100%',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    opacity: m.visibleToPlayers ? 1 : 0.70,
                                  }}
                                  title={m.name}
                                  onClick={(e) => { e.stopPropagation(); setDetailMarker(m); }}
                                >
                                  <Paper elevation={4} sx={{
                                    px: 0.75, py: 0.25, borderRadius: 2,
                                    bgcolor: 'background.paper',
                                    border: '2px solid', borderColor: 'primary.main',
                                    minWidth: 32, textAlign: 'center', lineHeight: 1,
                                  }}>
                                    <Typography variant="body1" component="span" sx={{ fontSize: '1.25rem' }}>
                                      {m.icon}
                                    </Typography>
                                  </Paper>
                                  <Box sx={{ width: 2, height: 8, bgcolor: 'primary.main' }} />
                                </Box>
                              ))}
                            </Box>
                          )}
                          {/* Editor layer captures pointer events only when explicit fog edit is enabled */}
                          {fogEnabled && fogEditEnabled && fogMode === 'grid' && (
                            <FogEditorLayer
                              grid={gridSettings}
                              widthPx={contentW}
                              heightPx={contentH}
                              tool={fogTool}
                              transform={{ zoom: activeTransform?.zoom ?? 1, rotationDeg: activeTransform?.rotationDeg ?? 0 }}
                              previewScale={scale}
                              onToggleCell={(key, add) => (add ? addCell(key) : removeCell(key))}
                            />
                          )}
                          {fogEnabled && fogEditEnabled && fogMode === 'organic' && (
                            <OrganicFogEditorLayer
                              widthPx={contentW}
                              heightPx={contentH}
                              tool={organicFogTool}
                              brushRadius={organicBrushRadius}
                              transform={{ zoom: activeTransform?.zoom ?? 1, rotationDeg: activeTransform?.rotationDeg ?? 0 }}
                              previewScale={scale}
                              onStrokeComplete={addOrganicStroke}
                            />
                          )}
                          {/* Element preview icons (visible outside edit mode for showInPreview elements) */}
                          {!elementsEditEnabled && previewElements.length > 0 && (
                            <ElementsPreviewLayer
                              widthPx={contentW}
                              heightPx={contentH}
                              elements={previewElements}
                              onUpdate={updateElement}
                            />
                          )}

                          {/* Map elements editor layer (walls, doors, windows, lights) */}
                          {elementsEditEnabled && (
                            <MapElementsEditorLayer
                              widthPx={contentW}
                              heightPx={contentH}
                              elements={elements}
                              tool={elementTool}
                              transform={{ zoom: activeTransform?.zoom ?? 1, rotationDeg: activeTransform?.rotationDeg ?? 0 }}
                              previewScale={scale}
                              onAddElement={addElement}
                              onUpdateElement={updateElement}
                              onRemoveElement={removeElement}
                              onSelectElement={setSelectedElement}
                              newLightRadius={newLightRadius}
                            />
                          )}
                        </Box>
                      </Box>
                    ) : (
                      // Full-fidelity Skyline preview: mirrors everything shown in the
                      // real Skyline projection window (character, song, day, turn image,
                      // initiative strip, shop items) inside the scaled container.
                      activeCampaign?.id ? (
                        <SkylineViewportContent
                          campaignId={activeCampaign.id}
                          mapId={mapId}
                          timeOfDay={timeOfDay}
                        />
                      ) : (
                        <AuthImage
                          src={getMapSkylineUrlSized(mapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
                          alt="Skyline proyectado"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )
                    )}
                  </Box>
                ) : (
                  <Typography variant="body1" color="white">Sin mapa activo</Typography>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ width: '100%', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">Esperando tamaño de proyección…</Typography>
          </Box>
        )}
      </Box>

      <TokenQuickInfoPopover
        open={!!tokenInfo}
        token={tokenInfo?.token || null}
        anchorPosition={tokenInfo?.pos}
        campaignId={activeCampaign?.id}
        resolveTokenImage={resolveTokenImage}
        onClose={() => setTokenInfo(null)}
        onUpdateToken={(id, patch) => {
          updateToken(id, patch);
          // Update tokenInfo to reflect changes in real-time
          if (tokenInfo?.token?.id === id) {
            setTokenInfo({
              ...tokenInfo,
              token: { ...tokenInfo.token, ...patch },
            });
          }
        }}
      />

      {detailMarker && mapId && activeCampaign?.id && (
        <MapMarkerDetail
          marker={detailMarker}
          mapId={mapId}
          campaignId={activeCampaign.id}
          open={!!detailMarker}
          onClose={() => setDetailMarker(null)}
          onEdit={() => {
            setEditingMarker(detailMarker);
            setDetailMarker(null);
          }}
          onDelete={(deletedId) => {
            setDetailMarker(null);
            setMarkers(prev => prev.filter(m => m.id !== deletedId));
          }}
          allMaps={assocMaps}
          allCharacters={assocChars}
          allEnemies={assocEnemies}
          allEncounters={assocEncounters}
        />
      )}

      {/* Create marker dialog (click-to-add from preview) */}
      {createMarkerPos && !editingMarker && mapId && activeCampaign?.id && (
        <MapMarkerDialog
          initialX={createMarkerPos.x}
          initialY={createMarkerPos.y}
          campaignId={activeCampaign.id}
          mapId={mapId}
          onClose={() => setCreateMarkerPos(null)}
          onSaved={(saved) => {
            setMarkers(prev => [...prev, saved]);
            setCreateMarkerPos(null);
          }}
        />
      )}

      {/* Edit marker dialog (opened from detail view) */}
      {editingMarker && mapId && activeCampaign?.id && (
        <MapMarkerDialog
          marker={editingMarker}
          campaignId={activeCampaign.id}
          mapId={mapId}
          onClose={() => setEditingMarker(null)}
          onSaved={(saved) => {
            setMarkers(prev => prev.map(m => m.id === saved.id ? saved : m));
            setEditingMarker(null);
          }}
          onDelete={(deletedId) => {
            setMarkers(prev => prev.filter(m => m.id !== deletedId));
            setEditingMarker(null);
          }}
        />
      )}

      <Dialog
        open={confirmClearTokens}
        onClose={() => setConfirmClearTokens(false)}
      >
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar todos los tokens del mapa?
            Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearTokens(false)} autoFocus>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setTokens([]);
              setConfirmClearTokens(false);
            }}
            color="error"
            variant="contained"
          >
            Eliminar todos
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProjectedMapMirror;

// Local bridge to hook into tokens state with active campaign
const TokensBridge: React.FC<{
  gridSettings: GridSettings;
  widthPx: number;
  heightPx: number;
  mapId: string;
  tokenMode: TokenEditMode;
  previewScale: number;
  transform: { zoom?: number; rotationDeg?: number } | null;
  tokens: import('../../api/maps').MapTokenPayload[];
  onAddToken: (t: { id: string; cellKey: string; type: 'ally'|'enemy'; label?: string; color?: string; rotationDeg?: number; size?: import('../../api/maps').TokenSize }) => void;
  onMoveToken: (id: string, patch: Partial<import('../../api/maps').MapTokenPayload>) => void;
  onRemoveToken: (id: string) => void;
  onSelectToken?: (token: import('../../api/maps').MapTokenPayload, anchor: { left: number; top: number }) => void;
  highlightIds: Set<string> | null;
  tokenImageResolver?: (id: string) => string | undefined;
  showGuideDots?: boolean;
  showCellShading?: boolean;
}> = ({ gridSettings, widthPx, heightPx, tokenMode, previewScale, transform, tokens, onAddToken, onMoveToken, onRemoveToken, onSelectToken, highlightIds, tokenImageResolver, showGuideDots, showCellShading }) => {
  const onAdd = React.useCallback((cellKey: string, type: 'ally'|'enemy') => {
    const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Calculate initial rotation to face nearest rival
    let rotationDeg = 0;
    const getCenterFromCell = (key: string): { x: number; y: number } => {
      const [colStr, rowStr] = key.split(':');
      const col = parseInt(colStr, 10) || 0;
      const row = parseInt(rowStr, 10) || 0;
      const r = gridSettings.cellSize || 40;
      if (gridSettings.type === 'square') {
        return { x: col * r + r / 2, y: row * r + r / 2 };
      } else {
        const hexR = r;
        const hexH = Math.sqrt(3) * hexR;
        const horizStep = 1.5 * hexR;
        const vertStep = hexH;
        const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
        const cx = col * horizStep + hexR;
        const cy = row * vertStep + hexH / 2 + yOffset;
        return { x: cx, y: cy };
      }
    };
    
    const newTokenCenter = getCenterFromCell(cellKey);
    const targetType = type === 'ally' ? 'enemy' : 'ally';
    let nearestRival: { token: import('../../api/maps').MapTokenPayload; distance: number } | null = null;
    
    for (const rival of tokens) {
      if (rival.type !== targetType) continue;
      const rivalCenter = getCenterFromCell(rival.cellKey);
      const dx = rivalCenter.x - newTokenCenter.x;
      const dy = rivalCenter.y - newTokenCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (!nearestRival || distance < nearestRival.distance) {
        nearestRival = { token: rival, distance };
      }
    }
    
    if (nearestRival) {
      const rivalCenter = getCenterFromCell(nearestRival.token.cellKey);
      const dx = rivalCenter.x - newTokenCenter.x;
      const dy = rivalCenter.y - newTokenCenter.y;
      const angleRad = Math.atan2(dx, -dy);
      rotationDeg = (angleRad * 180 / Math.PI + 360) % 360;
    }
    
    onAddToken({ id, cellKey, type, rotationDeg });
  }, [onAddToken, tokens, gridSettings]);
  const onMove = React.useCallback((id: string, cellKey: string) => { onMoveToken(id, { cellKey }); }, [onMoveToken]);
  const onUpdate = React.useCallback((id: string, patch: Partial<import('../../api/maps').MapTokenPayload>) => { onMoveToken(id, patch); }, [onMoveToken]);
  const onRemove = React.useCallback((id: string) => { onRemoveToken(id); }, [onRemoveToken]);
  const getTokenImage = React.useCallback((t: import('../../api/maps').MapTokenPayload) => {
    if (!tokenImageResolver) return undefined;
    return tokenImageResolver(t.id);
  }, [tokenImageResolver]);
  return (
    <MapTokensOverlay
      settings={gridSettings}
      widthPx={widthPx}
      heightPx={heightPx}
      tokens={tokens}
      editable={true}
      editMode={tokenMode}
      onSelectToken={onSelectToken}
      onAddToken={onAdd}
      onMoveToken={onMove}
      onUpdateToken={onUpdate}
      onRemoveToken={onRemove}
      previewScale={previewScale}
      transform={{ zoom: transform?.zoom ?? 1, rotationDeg: transform?.rotationDeg ?? 0 }}
      highlightIds={highlightIds}
      getTokenImage={getTokenImage}
      showGuideDots={showGuideDots}
      showCellShading={showCellShading}
    />
  );
};

// Token info popover (rendered inside main component tree)
// Note: kept lightweight (label/type/rotation + optional image) to avoid coupling to combat state.

