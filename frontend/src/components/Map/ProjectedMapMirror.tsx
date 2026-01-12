import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Box, Paper, Typography, TextField, MenuItem, Stack, Button, ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, Select } from '@mui/material';
import { useActiveMap } from './ActiveMapContext';
import AuthImage from '../common/AuthImage';
import { getMapImageUrlSized, getMapSkylineUrlSized, listMaps } from '../../api/maps';
import MapGridOverlay, { GridSettings } from './MapGridOverlay';
import FogOfWarOverlay from './FogOfWarOverlay';
import FogEditorLayer from './FogEditorLayer';
import { useFogOfWar } from '../../hooks/useFogOfWar';
import { getGridOverlaySettings, setGridOverlaySettings } from '../../api/campaigns/gridOverlay';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useTimeOfDay } from '../player/TimeOfDayContext';
import { useMapTokens } from '../../hooks/useMapTokens';
import MapTokensOverlay, { TokenEditMode } from './MapTokensOverlay';
import { computeClearedFogByAllies, subtractClearedFog } from '../../utils/fogHelpers';
// removed duplicate import

const ProjectedMapMirror: React.FC<{ fogEnabled?: boolean; highlightTokenId?: string | null; tokenImageResolver?: (id: string) => string | undefined }> = ({ fogEnabled = false, highlightTokenId = null, tokenImageResolver }) => {
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
  const { cells, addCell, removeCell, clearAll } = useFogOfWar(activeCampaign?.id, mapId || undefined, gridSettings);
  const [fogTool, setFogTool] = useState<'paint' | 'erase'>('paint');
  const [fogEditEnabled, setFogEditEnabled] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [tokenMode, setTokenMode] = useState<TokenEditMode>('none');
  const { tokens, addToken, updateToken, removeToken } = useMapTokens(activeCampaign?.id, mapId || undefined);
  const [allyClearRadius, setAllyClearRadius] = useState<number>(() => {
    try { const raw = localStorage.getItem('app.map.allyClearRadius'); const n = raw ? parseInt(raw, 10) : 1; return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1; } catch { return 1; }
  });

  // Persist radius and notify listeners (projection or other tabs)
  useEffect(() => {
    try { localStorage.setItem('app.map.allyClearRadius', String(allyClearRadius)); } catch {}
    try { const bc = new BroadcastChannel('campaign-sync'); bc.postMessage({ type: 'ally-clear-radius-updated', value: allyClearRadius, at: Date.now() }); bc.close(); } catch {}
  }, [allyClearRadius]);

  // Compute fog after clearing around allied tokens (own cell + adjacent)
  const effectiveFogCells = React.useMemo(() => {
    try {
      const cleared = computeClearedFogByAllies(gridSettings, tokens || [], allyClearRadius);
      return subtractClearedFog(cells, cleared);
    } catch {
      return cells;
    }
  }, [cells, tokens, gridSettings, allyClearRadius]);

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
      {activeMapId && previewMode === 'players' && (
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), zoom: Math.min(8, (activeTransform?.zoom ?? 1) * 1.1) })}>Zoom +</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), zoom: Math.max(0.05, (activeTransform?.zoom ?? 1) / 1.1) })}>Zoom -</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), translateXPct: (activeTransform?.translateXPct ?? 0) - 5 })}>←</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), translateXPct: (activeTransform?.translateXPct ?? 0) + 5 })}>→</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), translateYPct: (activeTransform?.translateYPct ?? 0) - 5 })}>↑</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), translateYPct: (activeTransform?.translateYPct ?? 0) + 5 })}>↓</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), rotationDeg: (activeTransform?.rotationDeg ?? 0) + 90 })}>Rotar +90°</Button>
          <Button size="small" onClick={() => persistTransform({ ...(activeTransform||{}), rotationDeg: (activeTransform?.rotationDeg ?? 0) - 90 })}>Rotar -90°</Button>
          <Button size="small" onClick={() => persistTransform({ zoom: 1, rotationDeg: 0, translateXPct: 0, translateYPct: 0 })}>Reset</Button>
        </Stack>
      )}
      {previewMode === 'players' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FormControlLabel control={<Switch checked={gridSettings.enabled} onChange={(e) => saveGrid({ enabled: e.target.checked })} />} label="Cuadrícula" />
          <TextField select size="small" label="Tipo" value={gridSettings.type} onChange={(e) => saveGrid({ type: e.target.value as any })} sx={{ width: 140 }}>
            <MenuItem value="square">Cuadrados</MenuItem>
            <MenuItem value="hex">Hexágonos</MenuItem>
          </TextField>
          <TextField size="small" type="number" label="Tamaño" value={gridSettings.cellSize} inputProps={{ min: 6, step: 2 }} onChange={(e) => saveGrid({ cellSize: Math.max(6, Number(e.target.value||0)) })} sx={{ width: 120 }} />
          <TextField size="small" type="color" label="Color" value={gridSettings.color} onChange={(e) => saveGrid({ color: e.target.value })} sx={{ width: 120 }} />
          <TextField size="small" type="number" label="Opacidad" value={gridSettings.opacity} inputProps={{ min: 0, max: 1, step: 0.05 }} onChange={(e) => saveGrid({ opacity: Math.max(0, Math.min(1, Number(e.target.value||0))) })} sx={{ width: 140 }} />
          <TextField size="small" type="number" label="Grosor" value={gridSettings.lineWidth} inputProps={{ min: 0.25, max: 4, step: 0.25 }} onChange={(e) => saveGrid({ lineWidth: Math.max(0.25, Math.min(4, Number(e.target.value||0))) })} sx={{ width: 120 }} />
          {/* Fog of War controls */}
          <FormControlLabel control={<Switch checked={fogEnabled} onChange={() => { /* controlled upstream in Combat; local maps preview can be edited via tool toggle below */ }} />} label="Niebla (vista previa)" />
          {fogEnabled && (
            <>
              <FormControlLabel control={<Switch checked={fogEditEnabled} onChange={(e) => setFogEditEnabled(e.target.checked)} />} label="Editar niebla" />
              <TextField select size="small" label="Herramienta" value={fogTool} onChange={(e) => setFogTool((e.target.value as any) || 'paint')} sx={{ width: 160 }}>
                <MenuItem value="paint">Pintar</MenuItem>
                <MenuItem value="erase">Borrar</MenuItem>
              </TextField>
              <TextField size="small" type="number" label="Radio aliados" value={allyClearRadius} inputProps={{ min: 0, max: 10, step: 1 }} onChange={(e) => setAllyClearRadius(Math.max(0, Math.min(10, Number(e.target.value||0))))} sx={{ width: 160 }} />
              <Button size="small" onClick={() => clearAll()}>Borrar todo</Button>
            </>
          )}
          {/* Tokens edit controls */}
          <TextField select size="small" label="Tokens" value={tokenMode} onChange={(e) => setTokenMode((e.target.value as TokenEditMode) || 'none')} sx={{ width: 170 }}>
            <MenuItem value="none">Ver/arrastrar</MenuItem>
            <MenuItem value="ally">Añadir aliado</MenuItem>
            <MenuItem value="enemy">Añadir enemigo</MenuItem>
            <MenuItem value="erase">Borrar token</MenuItem>
          </TextField>
        </Stack>
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
                            <FogOfWarOverlay mode="master" grid={gridSettings} widthPx={contentW} heightPx={contentH} cells={effectiveFogCells} />
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
                            highlightIds={(highlightTokenId ? new Set([highlightTokenId]) : null)}
                            tokenImageResolver={tokenImageResolver}
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
  onAddToken: (t: { id: string; cellKey: string; type: 'ally'|'enemy'; label?: string; color?: string }) => void;
  onMoveToken: (id: string, patch: Partial<{ cellKey: string; label: string; color: string }>) => void;
  onRemoveToken: (id: string) => void;
  highlightIds: Set<string> | null;
  tokenImageResolver?: (id: string) => string | undefined;
}> = ({ gridSettings, widthPx, heightPx, tokenMode, previewScale, transform, tokens, onAddToken, onMoveToken, onRemoveToken, highlightIds, tokenImageResolver }) => {
  const onAdd = React.useCallback((cellKey: string, type: 'ally'|'enemy') => {
    const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    onAddToken({ id, cellKey, type });
  }, [onAddToken]);
  const onMove = React.useCallback((id: string, cellKey: string) => { onMoveToken(id, { cellKey }); }, [onMoveToken]);
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
      onAddToken={onAdd}
      onMoveToken={onMove}
      onRemoveToken={onRemove}
      previewScale={previewScale}
      transform={{ zoom: transform?.zoom ?? 1, rotationDeg: transform?.rotationDeg ?? 0 }}
      highlightIds={highlightIds}
      getTokenImage={getTokenImage}
    />
  );
};
