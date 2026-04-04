import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Paper, Typography, MenuItem, Divider, Autocomplete, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import SettingsIcon from '@mui/icons-material/Settings';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SendIcon from '@mui/icons-material/Send';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ViewListIcon from '@mui/icons-material/ViewList';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import ProjectedMapMirror from '../components/Map/ProjectedMapMirror';
import AuthImage from '../components/common/AuthImage';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { createMap, createMapsBulk, deleteMap, getMapImageUrl, getMapImageUrlSized, listMaps, MapItemDto, updateMap, getMapsUsage, toggleMapPrepared } from '../api/maps';
import AudioConfigEditor, { MusicConfig as MusicCfg, SfxConfig as SfxCfg } from '../components/soundtrack/AudioConfigEditor';
import MapTodImagesEditor from '../components/Map/MapTodImagesEditor';
import MapSkylineTodImagesEditor from '../components/Map/MapSkylineTodImagesEditor';
import WorldMapView from '../components/Map/WorldMapView';
import SecondaryWindowSizesSettings from '../components/common/SecondaryWindowSizesSettings';
import { useSecondaryWindowSizes } from '../hooks/useSecondaryWindowSizes';
import { uploadDefaultSkyline, getDefaultSkylineUrl, hasDefaultSkyline, deleteDefaultSkyline } from '../api/campaigns/defaultSkyline';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import ImportMapFromOtherCampaignDialog from '../components/Map/ImportMapFromOtherCampaignDialog';

type FormState = {
  id?: string;
  name: string;
  description?: string;
  group?: string[];
  isWorldMap?: boolean;
  musicConfig?: MusicCfg;
  sfxConfig?: SfxCfg;
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };
  file?: File | null;
};

export default function MapsPage() {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;
  const [items, setItems] = useState<MapItemDto[]>([]);
  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mapsPage.groupFilter');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ totalSize: number; count: number } | null>(null);
  const [sortOrder, setSortOrder] = useState<'alpha' | 'newest' | 'oldest' | 'lastUsed'>(() => {
    try {
      const saved = localStorage.getItem('mapsPage.sortOrder');
      if (saved === 'alpha' || saved === 'newest' || saved === 'oldest' || saved === 'lastUsed') return saved;
    } catch { /* noop */ }
    return 'lastUsed';
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', isWorldMap: false });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkHover, setBulkHover] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [projectionReady, setProjectionReady] = useState<boolean>(false);
  const { activeMapId, setActiveMapId } = useActiveMap();
  const [worldMapItem, setWorldMapItem] = useState<MapItemDto | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode: windowSizeMode, customSizes, setMode: setWindowSizeMode, setCustomSize } = useSecondaryWindowSizes();
  const [viewMode, setViewMode] = useState<'list' | 'groups'>(() => {
    try {
      const saved = localStorage.getItem('mapsPage.viewMode');
      if (saved === 'list' || saved === 'groups') return saved;
    } catch { /* noop */ }
    return 'list';
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Default skyline fallback state
  const [defaultSkylineExists, setDefaultSkylineExists] = useState(false);
  const [defaultSkylineCb, setDefaultSkylineCb] = useState(0);
  const [uploadingSkyline, setUploadingSkyline] = useState(false);

  // Check if default skyline exists when settings open or campaign changes
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    hasDefaultSkyline(campaignId).then(v => { if (!cancelled) setDefaultSkylineExists(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId, defaultSkylineCb]);

  const handleUploadDefaultSkyline = useCallback(async (file: File) => {
    if (!campaignId) return;
    setUploadingSkyline(true);
    try {
      await uploadDefaultSkyline(campaignId, file);
      setDefaultSkylineExists(true);
      setDefaultSkylineCb(c => c + 1);
    } finally {
      setUploadingSkyline(false);
    }
  }, [campaignId]);

  const handleDeleteDefaultSkyline = useCallback(async () => {
    if (!campaignId) return;
    await deleteDefaultSkyline(campaignId);
    setDefaultSkylineExists(false);
    setDefaultSkylineCb(c => c + 1);
  }, [campaignId]);

  // Persist group filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mapsPage.groupFilter', JSON.stringify(groupFilter));
    } catch { /* noop */ }
  }, [groupFilter]);

  // Persist sort order to localStorage
  useEffect(() => {
    try { localStorage.setItem('mapsPage.sortOrder', sortOrder); } catch { /* noop */ }
  }, [sortOrder]);

  // Persist view mode to localStorage
  useEffect(() => {
    try { localStorage.setItem('mapsPage.viewMode', viewMode); } catch { /* noop */ }
  }, [viewMode]);

  const filtered = useMemo(() => {
    let result = [...items];
    
    // Apply group filter
    if (groupFilter.length > 0) {
      result = result.filter((map) => {
        const mapGroups = map.group || [];
        return groupFilter.some(g => mapGroups.includes(g));
      });
    }

    // Sort: prepared maps always first, then by chosen order
    result.sort((a, b) => {
      const ap = a.isPrepared ? 1 : 0;
      const bp = b.isPrepared ? 1 : 0;
      if (ap !== bp) return bp - ap;
      switch (sortOrder) {
        case 'alpha':
          return a.name.localeCompare(b.name);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'lastUsed':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
    
    return result;
  }, [items, groupFilter, sortOrder]);

  /** All distinct groups across loaded maps, for autocomplete suggestions. */
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    for (const m of items) {
      if (Array.isArray(m.group)) {
        for (const g of m.group) if (g) set.add(g);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const refresh = async () => {
    // Si no hay campaña activa, no intentes cargar: esta vista depende del contexto de campaña.
    if (!campaignId) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await listMaps({ q: q || undefined, campaignId });
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  const refreshUsage = async () => {
    if (!campaignId) { setUsage(null); return; }
    try { const r = await getMapsUsage({ campaignId }); setUsage(r); } catch { /* noop */ }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, campaignId]);

  // Fetch usage (total bytes / count) similar to Soundtrack UI
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!campaignId) { if (isMounted) setUsage(null); return; }
      try {
        const r = await getMapsUsage({ campaignId });
        if (isMounted) setUsage(r);
      } catch {
        if (isMounted) setUsage(null);
      }
    })();
    return () => { isMounted = false; };
  }, [campaignId]);

  // Detectar disponibilidad de API Electron
  useEffect(() => {
    setProjectionReady(!!window.electronAPI?.openMapsProjection);
  }, []);

  const onOpenCreate = () => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    setForm({ name: '', isWorldMap: false, group: [], musicConfig: undefined, sfxConfig: undefined, file: null });
    setOpen(true);
  };
  const onOpenEdit = (it: MapItemDto) => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    setForm({
      id: it.id,
      name: it.name,
      description: it.description,
      group: it.group ?? [],
      isWorldMap: it.isWorldMap ?? false,
      musicConfig: (it as any).musicConfig as any,
      sfxConfig: (it as any).sfxConfig as any,
      transform: (it as any).transform as any,
      file: null,
    });
    setOpen(true);
  };
  const onClose = () => { setOpen(false); if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); } };

  const onSubmit = async () => {
    if (!form.name.trim()) return;
    // eslint-disable-next-line no-console
    console.log('[MapsPage] onSubmit');
    const common = {
      name: form.name,
      description: form.description,
      campaignId,
      group: form.group,
      isWorldMap: form.isWorldMap,
      musicConfig: form.musicConfig,
      sfxConfig: form.sfxConfig,
      transform: form.transform,
      file: form.file,
    } as const;
    try {
      if (form.id) {
        await updateMap(form.id, common);
        try { (window as any).electronAPI?.projectionPoke?.({ reason: 'map-transform-updated' }); } catch {}
      } else {
        await createMap(common as any);
      }
      // Notify orchestrator and other tabs/windows that a map's config (including audio) may have changed.
      // Sent for both create and update so the MapAudioOrchestrator always re-fetches its maps list.
      try {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'map-transform-updated', mapId: form.id, at: Date.now() });
        bc.close();
      } catch {}
      setOpen(false);
      await refresh();
      await refreshUsage();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[MapsPage] submit error:', err?.response?.data || err);
      alert(`Error al guardar el mapa: ${err?.response?.data?.message || err?.message || 'Desconocido'}`);
    }
  };

  const onDelete = async (id: string) => {
    await deleteMap(id);
    await refresh();
    await refreshUsage();
  };

  const onDeleteFromDialog = async () => {
    if (!form.id) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!form.id) return;
    setDeleting(true);
    try {
      await deleteMap(form.id);
      setDeleteConfirmOpen(false);
      setOpen(false);
      await refresh();
      await refreshUsage();
    } finally {
      setDeleting(false);
    }
  };

  // Empty state cuando no hay campaña activa
  if (!campaignId) {
    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>Selecciona una campaña</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          La sección de mapas depende de la campaña activa. Ve a Campañas y selecciona una para ver y gestionar sus mapas.
        </Typography>
      </Box>
    );
  }

  // Preseleccionar un momento del día con configuración existente al abrir el editor
  const defaultEditorTod = useMemo(() => {
    const mc = form.musicConfig || {};
    const sc = form.sfxConfig || {};
    const TODS = ['dawn', 'morning', 'afternoon', 'night'] as const;
    for (const t of TODS) {
      if ((mc as any)[t] && Object.keys((mc as any)[t]).length) return t as any;
      if ((sc as any)[t] && Object.keys((sc as any)[t]).length) return t as any;
    }
    return undefined;
  }, [form.musicConfig, form.sfxConfig]);

  return (
    <Box>
      <ProjectedMapMirror
        fogEnabled
        useCustomSizes={windowSizeMode === 'custom'}
        customPlayersSize={customSizes.players}
        customSkylineSize={customSizes.skyline}
      />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 200 }} />
        <Autocomplete
          multiple
          size="small"
          options={allGroups}
          value={groupFilter}
          onChange={(_e, newValue) => setGroupFilter(newValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="Filtrar por grupos" placeholder="Selecciona grupos" />}
          sx={{ minWidth: 280 }}
        />
        <TextField
          select
          size="small"
          label="Ordenar por"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="lastUsed">Últimos usados</MenuItem>
          <MenuItem value="alpha">Alfabético</MenuItem>
          <MenuItem value="newest">Más recientes</MenuItem>
          <MenuItem value="oldest">Más antiguos</MenuItem>
        </TextField>
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_e, v) => { if (v) setViewMode(v); }}
        >
          <ToggleButton value="list"><Tooltip title="Vista lista"><ViewListIcon fontSize="small" /></Tooltip></ToggleButton>
          <ToggleButton value="groups"><Tooltip title="Vista grupos"><FolderIcon fontSize="small" /></Tooltip></ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenCreate}>Nuevo mapa</Button>
        <Button
          variant="outlined"
          startIcon={<PresentToAllIcon />}
          onClick={async () => {
            if (window.electronAPI?.openMapsProjection) {
              try { await window.electronAPI.openMapsProjection(campaignId); } catch {}
            } else {
              // Web: abrir nueva ventana/nueva pestaña con la ruta de proyección
              const url = campaignId
                ? `${window.location.origin}/projection/maps?campaignId=${encodeURIComponent(campaignId)}`
                : `${window.location.origin}/projection/maps`;
              window.open(url, 'projection_maps', 'noopener,noreferrer');
            }
          }}
        >
          Abrir ventana de jugadores
        </Button>
        <Button
          variant="outlined"
          startIcon={<PresentToAllIcon />}
          onClick={async () => {
            if ((window as any).electronAPI?.openSkylineProjection) {
              try { await (window as any).electronAPI.openSkylineProjection(campaignId); } catch {}
            } else {
              const url = campaignId
                ? `${window.location.origin}/projection/skyline?campaignId=${encodeURIComponent(campaignId)}`
                : `${window.location.origin}/projection/skyline`;
              window.open(url, 'projection_skyline', 'noopener,noreferrer');
            }
          }}
        >
          Abrir ventana Skyline
        </Button>
        <Tooltip title="Ajustes de mapas">
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
          >
            Ajustes
          </Button>
        </Tooltip>
        <Tooltip title="Importar mapas de otras campañas">
          <Button
            variant="outlined"
            startIcon={<FolderCopyIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Otras campañas
          </Button>
        </Tooltip>
      </Stack>
      {viewMode === 'list' ? (
        <MapsGrid maps={filtered} activeMapId={activeMapId} setActiveMapId={setActiveMapId} onOpenEdit={onOpenEdit} setWorldMapItem={setWorldMapItem} setItems={setItems} />
      ) : (
        <MapsGroupsView maps={filtered} allGroups={allGroups} activeMapId={activeMapId} setActiveMapId={setActiveMapId} onOpenEdit={onOpenEdit} setWorldMapItem={setWorldMapItem} setItems={setItems} expandedGroups={expandedGroups} setExpandedGroups={setExpandedGroups} />
      )}

      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Editar mapa' : 'Nuevo mapa'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Image preview: if selecting a new file show local preview; otherwise show current image when editing */}
            <Box sx={{ width: '100%', height: 180, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {localPreview ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={localPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : form.id ? (
                <AuthImage src={getMapImageUrlSized(form.id, 'preview')} alt={form.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<Typography variant="body2" color="text.secondary">Sin imagen</Typography>} />
              ) : (
                <Typography variant="body2" color="text.secondary">Sin imagen</Typography>
              )}
            </Box>
            {/* Base image updater (affects thumbnail and fallback TOD) */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button component="label" variant="outlined" size="small">
                {form.id ? 'Cambiar imagen base' : 'Seleccionar imagen base'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const file = (e.target.files && e.target.files[0]) || null;
                    if (!file) return;
                    if (localPreview) URL.revokeObjectURL(localPreview);
                    setLocalPreview(URL.createObjectURL(file));
                    setForm((s) => ({ ...s, file }));
                  }}
                />
              </Button>
              {form.file && (
                <Button size="small" onClick={() => {
                  if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
                  setForm((s) => ({ ...s, file: null }));
                }}>Quitar selección</Button>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 1 } }}>
                Esta imagen se usa para la miniatura y como base cuando no hay imagen específica por momento del día.
              </Typography>
            </Stack>
            <TextField label="Nombre" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            <TextField label="Descripción" value={form.description || ''} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} multiline rows={3} />

            <Autocomplete
              multiple
              freeSolo
              options={allGroups}
              value={form.group ?? []}
              onChange={(_e, newValue) => setForm((s) => ({ ...s, group: newValue as string[] }))}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} />
                ))
              }
              renderInput={(params) => <TextField {...params} label="Grupos" placeholder="Escribe o selecciona grupos" />}
            />
            {/* Selector de archivo removido por petición: la actualización por franja se hace en el bloque inferior */}

            {form.id && (
              <>
                <Divider sx={{ my: 1 }} />
                <MapTodImagesEditor mapId={form.id} />
                <Divider sx={{ my: 2 }} />
                <MapSkylineTodImagesEditor mapId={form.id} />
              </>
            )}

            <AudioConfigEditor
              value={{ musicConfig: form.musicConfig, sfxConfig: form.sfxConfig }}
              onChange={(v) => setForm((s) => ({ ...s, musicConfig: v.musicConfig as any, sfxConfig: v.sfxConfig as any }))}
              defaultTimeOfDay={defaultEditorTod as any}
            />

            {/* Transform controls */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Transformaciones (proyección)</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Zoom"
                  type="number"
                  inputProps={{ step: 0.05, min: 0.05, max: 8 }}
                  size="small"
                  value={form.transform?.zoom ?? 1}
                  onChange={(e) => setForm(s => ({ ...s, transform: { ...(s.transform||{}), zoom: Math.max(0.05, Number(e.target.value||1)) } }))}
                />
                <TextField
                  label="Rotación (°)"
                  type="number"
                  inputProps={{ step: 1 }}
                  size="small"
                  value={form.transform?.rotationDeg ?? 0}
                  onChange={(e) => setForm(s => ({ ...s, transform: { ...(s.transform||{}), rotationDeg: Number(e.target.value||0) } }))}
                />
                <TextField
                  label="Pan X (%)"
                  type="number"
                  inputProps={{ step: 1 }}
                  size="small"
                  value={form.transform?.translateXPct ?? 0}
                  onChange={(e) => setForm(s => ({ ...s, transform: { ...(s.transform||{}), translateXPct: Number(e.target.value||0) } }))}
                />
                <TextField
                  label="Pan Y (%)"
                  type="number"
                  inputProps={{ step: 1 }}
                  size="small"
                  value={form.transform?.translateYPct ?? 0}
                  onChange={(e) => setForm(s => ({ ...s, transform: { ...(s.transform||{}), translateYPct: Number(e.target.value||0) } }))}
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setForm(s => ({ ...s, transform: { ...(s.transform||{}), zoom: Math.min(8, (s.transform?.zoom ?? 1) * 1.1) } }))}>Zoom +</Button>
                <Button size="small" onClick={() => setForm(s => ({ ...s, transform: { ...(s.transform||{}), zoom: Math.max(0.05, (s.transform?.zoom ?? 1) / 1.1) } }))}>Zoom -</Button>
                <Button size="small" onClick={() => setForm(s => ({ ...s, transform: { ...(s.transform||{}), rotationDeg: (s.transform?.rotationDeg ?? 0) + 90 } }))}>Rotar +90°</Button>
                <Button size="small" onClick={() => setForm(s => ({ ...s, transform: { ...(s.transform||{}), rotationDeg: (s.transform?.rotationDeg ?? 0) - 90 } }))}>Rotar -90°</Button>
                <Button size="small" onClick={() => setForm(s => ({ ...s, transform: undefined }))}>Reset</Button>
              </Stack>
            </Paper>

            {/* Bulk upload: visible SOLO al crear un nuevo mapa */}
            {!form.id && (
              <Paper
                variant="outlined"
                sx={{ p: 2, borderStyle: 'dashed', bgcolor: bulkHover ? 'action.hover' : 'transparent' }}
                onDragOver={(e) => { e.preventDefault(); setBulkHover(true); }}
                onDragLeave={() => setBulkHover(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setBulkHover(false);
                  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                  if (!files.length) return;
                  await createMapsBulk(files, campaignId);
                  setOpen(false);
                  await refresh();
                  await refreshUsage();
                }}
              >
                <Typography variant="body2">O arrastra aquí varias imágenes para crear múltiples mapas</Typography>
                <Box mt={1}>
                  <Button component="label" size="small" variant="text">
                    Seleccionar múltiples archivos
                    <input type="file" hidden multiple accept="image/*" onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      await createMapsBulk(files, campaignId);
                      setOpen(false);
                      await refresh();
                      await refreshUsage();
                      (e.target as HTMLInputElement).value = '';
                    }} />
                  </Button>
                </Box>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {form.id && (
            <Button color="error" onClick={onDeleteFromDialog} sx={{ mr: 'auto' }} disabled={deleting}>
              Eliminar
            </Button>
          )}
          <Button onClick={onClose} disabled={deleting}>Cancelar</Button>
          <Button variant="contained" onClick={onSubmit} disabled={deleting}>{form.id ? 'Guardar' : 'Crear'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminar mapa"
        message={form.id ? `¿Eliminar "${form.name || 'Mapa'}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
        confirmColor="error"
        confirmDisabled={deleting}
        onClose={() => (deleting ? null : setDeleteConfirmOpen(false))}
        onConfirm={handleConfirmDelete}
      />

      {/* Modo Vista en detalle — visualizador fullscreen con zoom/pan y marcadores */}
      {worldMapItem && campaignId && (
        <WorldMapView
          map={worldMapItem}
          campaignId={campaignId}
          onClose={() => setWorldMapItem(null)}
        />
      )}

      {/* Importar mapas de otras campañas */}
      {campaignId && (
        <ImportMapFromOtherCampaignDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          campaignId={campaignId}
          onImported={async () => { await refresh(); await refreshUsage(); }}
        />
      )}

      {/* Ajustes de mapas */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajustes de Mapas</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Uso de almacenamiento</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {usage ? `${(usage.totalSize / 1024 / 1024).toFixed(2)} MB / ${usage.count} mapas` : 'Calculando uso...'}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Default skyline fallback */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Skyline por defecto</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Se muestra cuando el mapa activo no tiene imagen de skyline propia.
            </Typography>
            {defaultSkylineExists && campaignId ? (
              <Box sx={{ mb: 2 }}>
                <AuthImage
                  src={`${getDefaultSkylineUrl(campaignId)}?_cb=${defaultSkylineCb}`}
                  alt="Skyline por defecto"
                  style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 4 }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    component="label"
                    disabled={uploadingSkyline}
                  >
                    Reemplazar
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDefaultSkyline(f); e.target.value = ''; }}
                    />
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteDefaultSkyline}
                  >
                    Eliminar
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  component="label"
                  disabled={uploadingSkyline || !campaignId}
                >
                  {uploadingSkyline ? 'Subiendo...' : 'Subir imagen'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDefaultSkyline(f); e.target.value = ''; }}
                  />
                </Button>
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />
            <SecondaryWindowSizesSettings
              mode={windowSizeMode}
              customSizes={customSizes}
              setMode={setWindowSizeMode}
              setCustomSize={setCustomSize}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Shared map card                                            */
/* ────────────────────────────────────────────────────────── */

interface MapCardProps {
  it: MapItemDto;
  activeMapId: string | null;
  setActiveMapId: (id: string) => void;
  onOpenEdit: (it: MapItemDto) => void;
  setWorldMapItem: (it: MapItemDto) => void;
  setItems: React.Dispatch<React.SetStateAction<MapItemDto[]>>;
}

function MapCard({ it, activeMapId, setActiveMapId, onOpenEdit, setWorldMapItem, setItems }: MapCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', gap: 1.5, minWidth: 0, borderLeft: it.isPrepared ? '3px solid' : undefined, borderLeftColor: it.isPrepared ? 'warning.main' : undefined }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {it.imageAvailable ? (
          <AuthImage src={getMapImageUrlSized(it.id, 'thumb')} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="medium" />} />
        ) : (
          <ImageIcon fontSize="medium" />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap title={it.name}>{it.name}</Typography>
          {it.musicConfig && Object.values(it.musicConfig).some(v => v && typeof v === 'object' && Object.keys(v).length > 0) && (
            <Tooltip title="Tiene música asociada"><MusicNoteIcon fontSize="small" color="action" /></Tooltip>
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
          <Tooltip title={it.isPrepared ? 'Quitar de preparados' : 'Marcar como preparado'}>
            <span>
              <IconButton
                size="small"
                onClick={async () => {
                  try {
                    const res = await toggleMapPrepared(it.id);
                    setItems(prev => prev.map(m => m.id === it.id ? { ...m, isPrepared: res.isPrepared } : m));
                  } catch { /* noop */ }
                }}
                color={it.isPrepared ? 'warning' : 'default'}
              >
                {it.isPrepared ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Editar">
            <span><IconButton size="small" onClick={() => onOpenEdit(it)}><EditIcon fontSize="small" /></IconButton></span>
          </Tooltip>
          <Tooltip title="Hacer activo">
            <span>
              <IconButton size="small" onClick={() => setActiveMapId(it.id)}>
                {activeMapId === it.id ? <CheckCircleIcon fontSize="small" color="success" /> : <SendIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Abrir vista en detalle">
            <span>
              <IconButton size="small" onClick={() => setWorldMapItem(it)}>
                <ZoomInMapIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Grid (flat list view)                                      */
/* ────────────────────────────────────────────────────────── */

const gridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(2, 1fr)',
    lg: 'repeat(3, 1fr)',
    xl: 'repeat(4, 1fr)',
  },
  gap: 1.5,
} as const;

interface MapsGridProps {
  maps: MapItemDto[];
  activeMapId: string | null;
  setActiveMapId: (id: string) => void;
  onOpenEdit: (it: MapItemDto) => void;
  setWorldMapItem: (it: MapItemDto) => void;
  setItems: React.Dispatch<React.SetStateAction<MapItemDto[]>>;
}

function MapsGrid({ maps, activeMapId, setActiveMapId, onOpenEdit, setWorldMapItem, setItems }: MapsGridProps) {
  return (
    <Box sx={gridSx}>
      {maps.map((it) => (
        <MapCard key={it.id} it={it} activeMapId={activeMapId} setActiveMapId={setActiveMapId} onOpenEdit={onOpenEdit} setWorldMapItem={setWorldMapItem} setItems={setItems} />
      ))}
    </Box>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Groups view (collapsible sections)                         */
/* ────────────────────────────────────────────────────────── */

interface MapsGroupsViewProps extends MapsGridProps {
  allGroups: string[];
  expandedGroups: Set<string>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
}

function MapsGroupsView({ maps, allGroups, activeMapId, setActiveMapId, onOpenEdit, setWorldMapItem, setItems, expandedGroups, setExpandedGroups }: MapsGroupsViewProps) {
  const toggle = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const ungroupedLabel = 'Sin grupo';
  const mapsByGroup = useMemo(() => {
    const result = new Map<string, MapItemDto[]>();
    for (const g of allGroups) result.set(g, []);
    const ungrouped: MapItemDto[] = [];
    for (const m of maps) {
      const groups = m.group?.filter(g => allGroups.includes(g)) ?? [];
      if (groups.length === 0) {
        ungrouped.push(m);
      } else {
        for (const g of groups) result.get(g)!.push(m);
      }
    }
    return { grouped: result, ungrouped };
  }, [maps, allGroups]);

  const sections = [...mapsByGroup.grouped.entries()].filter(([, list]) => list.length > 0);

  // Sort groups: those containing prepared maps first, then alphabetically
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => {
      const aHasPrepared = a[1].some(m => m.isPrepared);
      const bHasPrepared = b[1].some(m => m.isPrepared);
      if (aHasPrepared !== bHasPrepared) return aHasPrepared ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });
  }, [sections]);

  return (
    <Stack spacing={1}>
      {sortedSections.map(([group, groupMaps]) => {
        const hasPrepared = groupMaps.some(m => m.isPrepared);
        return (
        <Box key={group}>
          <Paper variant="outlined" sx={{ px: 2, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: hasPrepared ? '3px solid' : undefined, borderLeftColor: hasPrepared ? 'warning.main' : undefined }} onClick={() => toggle(group)}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FolderIcon fontSize="small" color={hasPrepared ? 'warning' : 'action'} />
              <Typography variant="subtitle2">{group}</Typography>
              <Chip label={groupMaps.length} size="small" />
            </Stack>
            {expandedGroups.has(group) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Paper>
          <Collapse in={expandedGroups.has(group)}>
            <Box sx={{ ...gridSx, mt: 1, mb: 1 }}>
              {groupMaps.map((it) => (
                <MapCard key={it.id} it={it} activeMapId={activeMapId} setActiveMapId={setActiveMapId} onOpenEdit={onOpenEdit} setWorldMapItem={setWorldMapItem} setItems={setItems} />
              ))}
            </Box>
          </Collapse>
        </Box>
        );
      })}
      {mapsByGroup.ungrouped.length > 0 && (
        <Box>
          <Paper variant="outlined" sx={{ px: 2, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => toggle(ungroupedLabel)}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FolderIcon fontSize="small" color="disabled" />
              <Typography variant="subtitle2" color="text.secondary">{ungroupedLabel}</Typography>
              <Chip label={mapsByGroup.ungrouped.length} size="small" />
            </Stack>
            {expandedGroups.has(ungroupedLabel) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Paper>
          <Collapse in={expandedGroups.has(ungroupedLabel)}>
            <Box sx={{ ...gridSx, mt: 1, mb: 1 }}>
              {mapsByGroup.ungrouped.map((it) => (
                <MapCard key={it.id} it={it} activeMapId={activeMapId} setActiveMapId={setActiveMapId} onOpenEdit={onOpenEdit} setWorldMapItem={setWorldMapItem} setItems={setItems} />
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Stack>
  );
}
