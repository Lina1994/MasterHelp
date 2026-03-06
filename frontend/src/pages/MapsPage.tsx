import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Paper, Typography, MenuItem, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PublicIcon from '@mui/icons-material/Public';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import ProjectedMapMirror from '../components/Map/ProjectedMapMirror';
import AuthImage from '../components/common/AuthImage';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { createMap, createMapsBulk, deleteMap, getMapImageUrl, getMapImageUrlSized, listMaps, MapItemDto, updateMap, getMapsUsage } from '../api/maps';
import AudioConfigEditor, { MusicConfig as MusicCfg, SfxConfig as SfxCfg } from '../components/soundtrack/AudioConfigEditor';
import MapTodImagesEditor from '../components/Map/MapTodImagesEditor';
import MapSkylineTodImagesEditor from '../components/Map/MapSkylineTodImagesEditor';
import WorldMapView from '../components/Map/WorldMapView';

type FormState = {
  id?: string;
  name: string;
  description?: string;
  group?: string;
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
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ totalSize: number; count: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', isWorldMap: false });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkHover, setBulkHover] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null); // kept for future image previews (currently not used)
  const [projectionReady, setProjectionReady] = useState<boolean>(false);
  const { activeMapId, setActiveMapId } = useActiveMap();
  /** Mapa actualmente visualizado en modo Mapa Mundial (fullscreen, DM only). */
  const [worldMapItem, setWorldMapItem] = useState<MapItemDto | null>(null);

  const filtered = useMemo(() => items, [items]);

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
    setForm({ name: '', isWorldMap: false, group: undefined, musicConfig: undefined, sfxConfig: undefined, file: null });
    setOpen(true);
  };
  const onOpenEdit = (it: MapItemDto) => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    setForm({
      id: it.id,
      name: it.name,
      description: it.description,
      group: it.group,
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
      <ProjectedMapMirror />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField size="small" label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 200 }}>
          {usage ? `${(usage.totalSize/1024/1024).toFixed(2)} MB / ${usage.count} mapas` : 'Calculando uso...'}
        </Typography>
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
      </Stack>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
          xl: 'repeat(4, 1fr)'
        },
        gap: 1.5,
      }}>
        {filtered.map((it) => (
          <Paper key={it.id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {/* Thumbnail */}
            <Box sx={{ width: 56, height: 56, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {it.imageAvailable ? (
                <AuthImage src={getMapImageUrlSized(it.id, 'thumb')} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="medium" />} />
              ) : (
                <ImageIcon fontSize="medium" />
              )}
            </Box>
            {/* Text */}
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography variant="subtitle1" noWrap title={it.name}>{it.name}</Typography>
              {it.description && (
                <Typography variant="body2" color="text.secondary" noWrap title={it.description}>{it.description}</Typography>
              )}
            </Box>
            {/* Actions */}
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {activeMapId === it.id && (
                <Tooltip title="Activo"><span><CheckCircleIcon color="success" /></span></Tooltip>
              )}
              <Tooltip title="Editar"><span><IconButton onClick={() => onOpenEdit(it)}><EditIcon /></IconButton></span></Tooltip>
              <Tooltip title="Hacer activo">
                <span>
                  <IconButton onClick={() => {
                    setActiveMapId(it.id);
                  }}>
                    <VisibilityIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Abrir modo Mapa Mundial">
                <span>
                  <IconButton onClick={() => setWorldMapItem(it)}>
                    <PublicIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>
        ))}
      </Box>

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

            <TextField label="Grupo" value={form.group || ''} onChange={(e) => setForm((s) => ({ ...s, group: e.target.value }))} />
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

      {/* Modo Mapa Mundial — visualizador fullscreen con zoom/pan y marcadores */}
      {worldMapItem && campaignId && (
        <WorldMapView
          map={worldMapItem}
          campaignId={campaignId}
          onClose={() => setWorldMapItem(null)}
        />
      )}
    </Box>
  );
}
