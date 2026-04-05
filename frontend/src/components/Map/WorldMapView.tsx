import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import WallsIcon from '@mui/icons-material/Layers';

import {
  MapItemDto,
  MapMarkerDto,
  getMapImageUrl,
  listMapMarkers,
  listMaps,
} from '../../api/maps';
import { listCharacters, CharacterPayload } from '../../api/characters';
import { listCampaignMonsters, CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listEncounters, EncounterSummary } from '../../api/encounters';
import AuthImage from '../common/AuthImage';
import MapMarkerDialog from './MapMarkerDialog';
import MapMarkerDetail from './MapMarkerDetail';
import MapElementsEditorLayer from './MapElementsEditorLayer';
import MapElementsPanel from './MapElementsPanel';
import ElementsPreviewLayer from './ElementsPreviewLayer';
import { useMapElements } from '../../hooks/useMapElements';
import { TITLEBAR_HEIGHT } from '../TitleBar';
import type { ElementEditorTool } from './MapElementsEditorLayer';
import type { MapElement, MapLightElement, MapDoorElement, MapWindowElement } from '../../api/mapElements';

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_FACTOR = 1.15;
/** Pixel threshold below which a pointer-up is treated as a click, not a pan-end. */
const CLICK_THRESHOLD = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transform {
  panX: number;
  panY: number;
  zoom: number;
}

interface Props {
  /** The map to display in world-map mode. */
  map: MapItemDto;
  campaignId: string;
  onClose: () => void;
}

// ─── Pin component ────────────────────────────────────────────────────────────

interface PinProps {
  marker: MapMarkerDto;
  /** Current zoom level — used to keep pin size constant on screen. */
  zoom: number;
  onClick: (marker: MapMarkerDto) => void;
}

/**
 * MarkerPin
 *
 * Renders a single world-map pin at the marker's (x%, y%) position relative
 * to the image container. The counter-scale `scale(1/zoom)` keeps the pin
 * visually the same size regardless of the current zoom level.
 */
function MarkerPin({ marker, zoom, onClick }: PinProps) {
  return (
    <Box
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(marker); }}
      sx={{
        position: 'absolute',
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        // Counter-scale so the pin remains the same screen size
        transform: `translate(-50%, -100%) scale(${1 / zoom})`,
        transformOrigin: '50% 100%',
        cursor: 'pointer',
        userSelect: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Paper
        elevation={4}
        sx={{
          px: 0.75,
          py: 0.25,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          minWidth: 32,
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        <Typography variant="body1" component="span" sx={{ fontSize: '1.25rem' }}>
          {marker.icon}
        </Typography>
      </Paper>
      {/* Tail */}
      <Box sx={{ width: 2, height: 8, bgcolor: 'primary.main' }} />
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * WorldMapView
 *
 * Full-screen overlay that renders a world map with independent pan/zoom
 * controls (separate from the projected-window transform) and a marker layer
 * that the DM can create, edit, and inspect.
 *
 * Pan: click-drag anywhere on the map.
 * Zoom: mouse-wheel (zooms toward the cursor) or toolbar buttons.
 * Markers: click the "Add marker" button then click on the map to place.
 * Inspect: click an existing marker to open its detail drawer.
 */
export default function WorldMapView({ map, campaignId, onClose }: Props) {
  // ─── Transform state (pan + zoom, independent from the projected window) ──
  const [transform, setTransform] = useState<Transform>({ panX: 0, panY: 0, zoom: 1 });
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);

  // ─── Interaction state ───────────────────────────────────────────────────
  const [addMode, setAddMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isPointerDownRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasPannedRef = useRef(false);          // distinguishes pan from click
  const pendingClickPosRef = useRef<{ x: number; y: number } | null>(null);

  // ─── Markers ─────────────────────────────────────────────────────────────
  const [markers, setMarkers] = useState<MapMarkerDto[]>([]);
  const [markersLoading, setMarkersLoading] = useState(true);

  // ─── Dialog / DrawerContext ──────────────────────────────────────────────
  const [createPos, setCreatePos] = useState<{ x: number; y: number } | null>(null);
  const [editingMarker, setEditingMarker] = useState<MapMarkerDto | null>(null);
  const [detailMarker, setDetailMarker] = useState<MapMarkerDto | null>(null);

  // ─── Map Elements (walls, doors, windows, lights) ────────────────────────
  const { elements, addElement, updateElement, removeElement, clearAll: clearAllElements } = useMapElements(campaignId, map.id);
  const [elementsEditEnabled, setElementsEditEnabled] = useState(false);
  const [elementTool, setElementTool] = useState<ElementEditorTool>('select');
  const [selectedElement, setSelectedElement] = useState<MapElement | null>(null);
  const [newLightRadius, setNewLightRadius] = useState(80);
  const [elementsAnchor, setElementsAnchor] = useState<HTMLElement | null>(null);

  const previewLights = useMemo(
    () => elements.filter((el): el is MapLightElement => el.type === 'light' && !!el.showInPreview),
    [elements],
  );

  /** Elements (lights, doors, windows) visible in preview mode. */
  const previewElements = useMemo(
    () => elements.filter(
      (el): el is MapLightElement | MapDoorElement | MapWindowElement =>
        (el.type === 'light' || el.type === 'door' || el.type === 'window') && !!(el as any).showInPreview,
    ),
    [elements],
  );

  /** Toggle a preview-light on/off by id. */
  const handleToggleLight = useCallback((id: string) => {
    const light = elements.find((el) => el.id === id);
    if (light && light.type === 'light') updateElement(id, { isOn: !light.isOn } as any);
  }, [elements, updateElement]);

  // ─── Association lists (fetched once, passed to dialogs/detail) ──────────
  const [allMaps, setAllMaps] = useState<MapItemDto[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterPayload[]>([]);
  const [allEnemies, setAllEnemies] = useState<CampaignMonsterListItem[]>([]);
  const [allEncounters, setAllEncounters] = useState<EncounterSummary[]>([]);

  // ─── Load markers + association lists ────────────────────────────────────

  useEffect(() => {
    let alive = true;
    setMarkersLoading(true);
    listMapMarkers(map.id, campaignId)
      .then((data) => { if (alive) { setMarkers(data); setMarkersLoading(false); } })
      .catch(() => { if (alive) setMarkersLoading(false); });
    return () => { alive = false; };
  }, [map.id, campaignId]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      listMaps({ campaignId }),
      listCharacters(campaignId),
      listCampaignMonsters(campaignId, { pageSize: 9999 }, 'en'),
      listEncounters(campaignId),
    ]).then(([mRes, cRes, eRes, enRes]) => {
      if (!alive) return;
      if (mRes.status === 'fulfilled') setAllMaps(mRes.value);
      if (cRes.status === 'fulfilled') setAllCharacters(cRes.value as CharacterPayload[]);
      if (eRes.status === 'fulfilled') setAllEnemies((eRes.value as any).items ?? eRes.value);
      if (enRes.status === 'fulfilled') setAllEncounters(enRes.value);
    });
    return () => { alive = false; };
  }, [campaignId]);

  // ─── Fit image to viewport on load ───────────────────────────────────────

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    setImageDims({ w: iw, h: ih });

    const vw = container.clientWidth;
    const vh = container.clientHeight;
    const fitZoom = Math.min(vw / iw, vh / ih) * 0.92; // 8% padding
    setTransform({ panX: 0, panY: 0, zoom: fitZoom });
  }, []);

  // ─── Fit-to-screen helper ─────────────────────────────────────────────────

  const fitToScreen = useCallback(() => {
    if (!imageDims || !containerRef.current) return;
    const vw = containerRef.current.clientWidth;
    const vh = containerRef.current.clientHeight;
    const fitZoom = Math.min(vw / imageDims.w, vh / imageDims.h) * 0.92;
    setTransform({ panX: 0, panY: 0, zoom: fitZoom });
  }, [imageDims]);

  // ─── Pan: pointer events ──────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle left-button / touch
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    // Close the elements panel popover on any map interaction
    setElementsAnchor(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    hasPannedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: transform.panX, y: transform.panY };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform.panX, transform.panY]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (!hasPannedRef.current && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
      hasPannedRef.current = true;
    }
    if (hasPannedRef.current) {
      setTransform((prev) => ({
        ...prev,
        panX: panStartRef.current.x + dx,
        panY: panStartRef.current.y + dy,
      }));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (!hasPannedRef.current) {
      // Treat as click — store position for add-marker flow
      pendingClickPosRef.current = { x: e.clientX, y: e.clientY };
      handleMapClick(e.clientX, e.clientY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode, imageDims]);

  /** Converts a viewport click to image-percentage coordinates and opens create dialog. */
  const handleMapClick = useCallback(
    (clientX: number, clientY: number) => {
      if (!addMode || !imageDims || !containerRef.current) return;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;

      // Viewport-center-relative position
      const cx = clientX - rect.left - vw / 2;
      const cy = clientY - rect.top - vh / 2;

      // Undo pan and scale to get position in image-local coords (image centered = origin at image center)
      const { panX, panY, zoom } = transform;
      const localX = (cx - panX) / zoom; // in pixels relative to image center
      const localY = (cy - panY) / zoom;

      // Convert to percentage (image center = 50%)
      const pctX = (localX / imageDims.w + 0.5) * 100;
      const pctY = (localY / imageDims.h + 0.5) * 100;

      // Clamp to image bounds
      const clamp = (v: number) => Math.max(0, Math.min(100, v));
      setCreatePos({ x: clamp(pctX), y: clamp(pctY) });
      setAddMode(false);
    },
    [addMode, imageDims, transform],
  );

  // ─── Zoom: wheel event ────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

      setTransform((prev) => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
        // Zoom toward cursor
        const worldX = (cx - prev.panX) / prev.zoom;
        const worldY = (cy - prev.panY) / prev.zoom;
        return {
          zoom: newZoom,
          panX: cx - worldX * newZoom,
          panY: cy - worldY * newZoom,
        };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Toolbar zoom helpers ─────────────────────────────────────────────────

  const zoomIn = () => setTransform((prev) => ({
    ...prev,
    zoom: Math.min(MAX_ZOOM, prev.zoom * ZOOM_FACTOR),
  }));
  const zoomOut = () => setTransform((prev) => ({
    ...prev,
    zoom: Math.max(MIN_ZOOM, prev.zoom / ZOOM_FACTOR),
  }));

  // ─── Marker mutations ─────────────────────────────────────────────────────

  const handleMarkerSaved = (saved: MapMarkerDto) => {
    setMarkers((prev) => {
      const idx = prev.findIndex((m) => m.id === saved.id);
      return idx >= 0
        ? prev.map((m, i) => (i === idx ? saved : m))
        : [...prev, saved];
    });
    setCreatePos(null);
    setEditingMarker(null);
    // Open detail for the newly created/updated marker
    setDetailMarker(saved);
  };

  const handleMarkerDeleted = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    setEditingMarker(null);
    setDetailMarker(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const { panX, panY, zoom } = transform;

  return (
    <>
      {/* Full-screen overlay */}
      <Box
        ref={containerRef}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: 'rgba(0,0,0,0.92)',
          overflow: 'hidden',
          cursor: addMode ? 'crosshair' : (isPointerDownRef.current ? 'grabbing' : 'grab'),
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* ─── Map + Markers (transform wrapper) ──────────────────────── */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            // Width and height set to image natural dims (or a large fallback) after load
            width: imageDims ? imageDims.w : 'auto',
            height: imageDims ? imageDims.h : 'auto',
            lineHeight: 0,
          }}
        >
          {/* The map image */}
          <AuthImage
            src={getMapImageUrl(map.id)}
            alt={map.name}
            style={{ display: 'block', width: imageDims ? '100%' : 'auto', height: imageDims ? '100%' : 'auto', maxWidth: 'none' }}
            onLoad={handleImgLoad}
          />

          {/* Markers layer (only when image dimensions are known) */}
          {imageDims && markers.map((marker) => (
            <MarkerPin
              key={marker.id}
              marker={marker}
              zoom={zoom}
              onClick={(m) => {
                if (addMode) return; // ignore if in add mode
                setDetailMarker(m);
              }}
            />
          ))}

          {/* Element preview icons (visible outside edit mode for showInPreview elements) */}
          {imageDims && !elementsEditEnabled && previewElements.length > 0 && (
            <ElementsPreviewLayer
              widthPx={imageDims.w}
              heightPx={imageDims.h}
              elements={previewElements}
              onUpdate={updateElement}
            />
          )}

          {/* Map Elements editor layer (walls, doors, windows, lights) */}
          {imageDims && elementsEditEnabled && (
            <MapElementsEditorLayer
              widthPx={imageDims.w}
              heightPx={imageDims.h}
              elements={elements}
              tool={elementTool}
              transform={{ zoom, rotationDeg: 0 }}
              previewScale={1}
              onAddElement={addElement}
              onUpdateElement={updateElement}
              onRemoveElement={removeElement}
              onSelectElement={setSelectedElement}
              newLightRadius={newLightRadius}
            />
          )}

          {/* Loading skeleton */}
          {!imageDims && (
            <Box sx={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        </Box>

        {/* ─── Add-mode overlay hint ───────────────────────────────────── */}
        {addMode && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <Paper elevation={6} sx={{ px: 3, py: 1.5, opacity: 0.85 }}>
              <Typography variant="body1">Haz clic en el mapa para colocar el marcador</Typography>
            </Paper>
          </Box>
        )}

        {/* ─── Toolbar ─────────────────────────────────────────────────── */}
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            top: TITLEBAR_HEIGHT + 12,
            left: 12,
            px: 1,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            zIndex: 10,
            pointerEvents: 'all',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Tooltip title="Cerrar vista en detalle">
            <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
          </Tooltip>

          <Box sx={{ width: 1, height: 28, bgcolor: 'divider', mx: 0.5 }} />

          <Typography variant="body2" noWrap sx={{ maxWidth: 180, fontWeight: 600 }}>
            {map.name}
          </Typography>
        </Paper>

        {/* Right toolbar */}
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            top: TITLEBAR_HEIGHT + 12,
            right: 12,
            px: 1,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            zIndex: 10,
            pointerEvents: 'all',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Tooltip title="Zoom in">
            <IconButton size="small" onClick={zoomIn}><ZoomInIcon /></IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="Zoom out">
            <IconButton size="small" onClick={zoomOut}><ZoomOutIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Ajustar a pantalla">
            <IconButton size="small" onClick={fitToScreen}><FitScreenIcon /></IconButton>
          </Tooltip>

          <Box sx={{ width: 1, height: 28, bgcolor: 'divider', mx: 0.5 }} />

          <Tooltip title={addMode ? 'Cancelar colocación' : 'Añadir marcador'}>
            <IconButton
              size="small"
              onClick={() => setAddMode((v) => !v)}
              color={addMode ? 'primary' : 'default'}
              sx={{ bgcolor: addMode ? 'primary.light' : undefined }}
            >
              <AddLocationIcon />
            </IconButton>
          </Tooltip>

          {markersLoading && <CircularProgress size={18} sx={{ ml: 0.5 }} />}

          <Box sx={{ width: 1, height: 28, bgcolor: 'divider', mx: 0.5 }} />

          <Tooltip title="Elementos del mapa">
            <IconButton
              size="small"
              onClick={(e) => {
                if (elementsAnchor) {
                  setElementsAnchor(null);
                } else {
                  setElementsAnchor(e.currentTarget);
                }
              }}
              color={elementsEditEnabled || elementsAnchor ? 'primary' : 'default'}
              sx={{ bgcolor: elementsEditEnabled ? 'primary.light' : undefined }}
            >
              <WallsIcon />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* ─── Elements editing panel (floating) ──────────────────────── */}
        <Popover
          open={Boolean(elementsAnchor)}
          anchorEl={elementsAnchor}
          onClose={() => setElementsAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          disableRestoreFocus
          slotProps={{ paper: { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() } }}
        >
          <Box sx={{ p: 1.5, minWidth: 280, maxWidth: 420 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Elementos del mapa</Typography>
            <MapElementsPanel
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
              onToggleLight={handleToggleLight}
            />
          </Box>
        </Popover>
      </Box>

      {/* ─── Create marker dialog ─────────────────────────────────────────── */}
      {createPos && !editingMarker && (
        <MapMarkerDialog
          initialX={createPos.x}
          initialY={createPos.y}
          campaignId={campaignId}
          mapId={map.id}
          onClose={() => setCreatePos(null)}
          onSaved={handleMarkerSaved}
        />
      )}

      {/* ─── Edit marker dialog ───────────────────────────────────────────── */}
      {editingMarker && (
        <MapMarkerDialog
          marker={editingMarker}
          campaignId={campaignId}
          mapId={map.id}
          onClose={() => setEditingMarker(null)}
          onSaved={handleMarkerSaved}
          onDelete={handleMarkerDeleted}
        />
      )}

      {/* ─── Marker detail drawer ─────────────────────────────────────────── */}
      {detailMarker && (
        <MapMarkerDetail
          marker={detailMarker}
          mapId={map.id}
          campaignId={campaignId}
          open={!!detailMarker}
          onClose={() => setDetailMarker(null)}
          onEdit={() => {
            setEditingMarker(detailMarker);
            setDetailMarker(null);
          }}
          onDelete={handleMarkerDeleted}
          allMaps={allMaps}
          allCharacters={allCharacters}
          allEnemies={allEnemies}
          allEncounters={allEncounters}
        />
      )}
    </>
  );
}
