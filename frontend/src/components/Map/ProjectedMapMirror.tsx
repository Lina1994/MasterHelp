import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, MenuItem, Stack, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useActiveMap } from './ActiveMapContext';
import AuthImage from '../common/AuthImage';
import { getMapImageUrlSized, getMapSkylineUrlSized, listMaps } from '../../api/maps';
import MapGridOverlay, { GridSettings } from './MapGridOverlay';
import FogOfWarOverlay from './FogOfWarOverlay';
import FogEditorLayer from './FogEditorLayer';
import { useFogOfWar } from '../../hooks/useFogOfWar';
import { getGridOverlaySettings, setGridOverlaySettings } from '../../api/campaigns/gridOverlay';
import { getFogOfWarSettings, setFogOfWarSettings } from '../../api/campaigns/fogOfWar';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useMapTokens } from '../../hooks/useMapTokens';
import MapTokensOverlay, { TokenEditMode } from './MapTokensOverlay';
import { computeAllFogCells, computeClearedFogByAllies, subtractClearedFog } from '../../utils/fogHelpers';
import ProjectedMapMirrorTools from './ProjectedMapMirrorTools';
import type { TokenCandidate } from './ProjectedMapMirrorTools';
import { useMapFogPreviewStyle } from '../../hooks/useMapFogPreviewStyle';
import { useCharacterTokenImageResolver } from '../../hooks/useCharacterTokenImageResolver';
import { TokenQuickInfoPopover } from './TokenQuickInfoPopover';
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
}> = ({
  fogEnabled = false,
  highlightTokenId = null,
  tokenImageResolver,
  onPrepareTokens,
  tokenCandidates,
  onCreateTokenForCandidate,
  existingTokenIds,
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
  const { style: fogPreviewStyle, setColor: setFogPreviewColor, setOpacity: setFogPreviewOpacity } = useMapFogPreviewStyle(mapId || undefined);
  const [fogTool, setFogTool] = useState<'paint' | 'erase'>('paint');
  const [fogEditEnabled, setFogEditEnabled] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [tokenMode, setTokenMode] = useState<TokenEditMode>('none');
  const { tokens, addToken, updateToken, removeToken } = useMapTokens(activeCampaign?.id, mapId || undefined);
  const { resolver: defaultTokenImageResolver } = useCharacterTokenImageResolver(activeCampaign?.id);
  const [tokenInfo, setTokenInfo] = useState<{ token: import('../../api/maps').MapTokenPayload; pos: { left: number; top: number } } | null>(null);
  const [allyClearRadius, setAllyClearRadius] = useState<number>(() => {
    try { const raw = localStorage.getItem('app.map.allyClearRadius'); const n = raw ? parseInt(raw, 10) : 1; return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1; } catch { return 1; }
  });

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
      } catch {
        // Keep local fallback
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
        if (activeCampaign?.id) await setFogOfWarSettings(activeCampaign.id, { allyClearRadius });
      } catch {
        // ignore
      }
    })();
  }, [allyClearRadius, activeCampaign?.id]);

  // Compute fog after clearing around allied tokens (own cell + adjacent)
  const effectiveFogCells = React.useMemo(() => {
    try {
      const cleared = computeClearedFogByAllies(gridSettings, tokens || [], allyClearRadius);
      return subtractClearedFog(cells, cleared);
    } catch {
      return cells;
    }
  }, [cells, tokens, gridSettings, allyClearRadius]);

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

  const baseSize = previewMode === 'players' ? projectionSize : skylineSize;
  const scale = useMemo(() => {
    if (!baseSize) return 1;
    const s = previewZoom;
    return isFinite(s) && s > 0 ? s : 1;
  }, [baseSize, previewZoom]);

  const contentW = naturalSize?.w || baseSize?.width || 0;
  const contentH = naturalSize?.h || baseSize?.height || 0;

  // Capa que simula la ventana secundaria: marco escalado con fondo negro
  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">
            Vista previa ({previewMode === 'players' ? 'Ventana de jugadores' : 'Skyline'})
            {baseSize ? ` — ${baseSize.width}×${baseSize.height}${baseSize.dpr ? ` @${baseSize.dpr}x` : ''}` : ''}
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

          tokenMode={tokenMode}
          onSetTokenMode={setTokenMode}
          onPrepareTokens={onPrepareTokens}
          tokenCandidates={tokenCandidates}
          onCreateTokenForCandidate={onCreateTokenForCandidate}
          existingTokenIds={existingTokenIds}
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
                          {fogEnabled && (
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
                          />
                          {/* Editor layer captures pointer events only when explicit fog edit is enabled */}
                          {fogEnabled && fogEditEnabled && (
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
                        </Box>
                      </Box>
                    ) : (
                      <AuthImage
                        src={getMapSkylineUrlSized(mapId, 'full', { timeOfDay, cacheBust: timeOfDay })}
                        alt="Skyline proyectado"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
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
      />
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
}> = ({ gridSettings, widthPx, heightPx, tokenMode, previewScale, transform, tokens, onAddToken, onMoveToken, onRemoveToken, onSelectToken, highlightIds, tokenImageResolver }) => {
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
    />
  );
};

// Token info popover (rendered inside main component tree)
// Note: kept lightweight (label/type/rotation + optional image) to avoid coupling to combat state.

