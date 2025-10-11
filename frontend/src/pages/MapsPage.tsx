import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Paper, Typography, FormControlLabel, Switch, MenuItem, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import AuthImage from '../components/common/AuthImage';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { createMap, createMapsBulk, deleteMap, getMapImageUrl, getMapImageUrlSized, listMaps, MapItemDto, updateMap } from '../api/maps';
import AudioConfigEditor, { MusicConfig as MusicCfg, SfxConfig as SfxCfg } from '../components/soundtrack/AudioConfigEditor';

type FormState = {
  id?: string;
  name: string;
  description?: string;
  file?: File | null;
  group?: string;
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: MusicCfg;
  sfxConfig?: SfxCfg;
};

export default function MapsPage() {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;
  const [items, setItems] = useState<MapItemDto[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', isWorldMap: false });
  const [bulkHover, setBulkHover] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const filtered = useMemo(() => items, [items]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listMaps({ q: q || undefined, campaignId });
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, campaignId]);

  const onOpenCreate = () => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    setForm({ name: '', isWorldMap: false, timeOfDay: undefined, group: undefined, musicConfig: undefined, sfxConfig: undefined });
    setOpen(true);
  };
  const onOpenEdit = (it: MapItemDto) => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    setForm({
      id: it.id,
      name: it.name,
      description: it.description,
      group: it.group,
      timeOfDay: it.timeOfDay,
      isWorldMap: it.isWorldMap ?? false,
      musicConfig: (it as any).musicConfig as any,
      sfxConfig: (it as any).sfxConfig as any,
    });
    setOpen(true);
  };
  const onClose = () => { setOpen(false); if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); } };

  const onSubmit = async () => {
    if (!form.name.trim()) return;
    const common = {
      name: form.name,
      description: form.description,
      campaignId,
      file: form.file,
      group: form.group,
      timeOfDay: form.timeOfDay,
      isWorldMap: form.isWorldMap,
      musicConfig: form.musicConfig,
      sfxConfig: form.sfxConfig,
    } as const;
    if (form.id) {
      await updateMap(form.id, common);
    } else {
      await createMap(common as any);
    }
    setOpen(false);
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deleteMap(id);
    await refresh();
  };

  const onDeleteFromDialog = async () => {
    if (!form.id) return;
    const ok = window.confirm('¿Eliminar este mapa? Esta acción no se puede deshacer.');
    if (!ok) return;
    await deleteMap(form.id);
    setOpen(false);
    await refresh();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField size="small" label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenCreate}>Nuevo mapa</Button>
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
          <Paper key={it.id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Thumbnail */}
            <Box sx={{ width: 56, height: 56, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {it.imageAvailable ? (
                <AuthImage src={getMapImageUrlSized(it.id, 'thumb')} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="medium" />} />
              ) : (
                <ImageIcon fontSize="medium" />
              )}
            </Box>
            {/* Text */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap title={it.name}>{it.name}</Typography>
              {it.description && (
                <Typography variant="body2" color="text.secondary" noWrap title={it.description}>{it.description}</Typography>
              )}
            </Box>
            {/* Actions */}
            <Stack direction="row" spacing={1}>
              <Tooltip title="Editar"><span><IconButton onClick={() => onOpenEdit(it)}><EditIcon /></IconButton></span></Tooltip>
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
            <TextField label="Nombre" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            <TextField label="Descripción" value={form.description || ''} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} multiline rows={3} />

            <TextField label="Grupo" value={form.group || ''} onChange={(e) => setForm((s) => ({ ...s, group: e.target.value }))} />
            <TextField select label="Momento del día" value={form.timeOfDay || ''} onChange={(e) => setForm((s) => ({ ...s, timeOfDay: (e.target.value || undefined) as any }))}>
              <MenuItem value="">(sin especificar)</MenuItem>
              <MenuItem value="dawn">Amanecer</MenuItem>
              <MenuItem value="morning">Mañana</MenuItem>
              <MenuItem value="afternoon">Tarde</MenuItem>
              <MenuItem value="night">Noche</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={!!form.isWorldMap} onChange={(e) => setForm((s) => ({ ...s, isWorldMap: e.target.checked }))} />} label="World Map" />
            <TextField type="file" inputProps={{ accept: 'image/*' }} onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0] || null;
              // local preview handling
              if (localPreview) {
                URL.revokeObjectURL(localPreview);
              }
              const preview = f ? URL.createObjectURL(f) : null;
              setLocalPreview(preview);
              setForm((s) => ({ ...s, file: f, name: s.name || (f ? f.name.replace(/\.[^.]+$/, '') : '') }));
            }} />

            <Divider sx={{ my: 1 }} />
            <AudioConfigEditor
              value={{ musicConfig: form.musicConfig, sfxConfig: form.sfxConfig }}
              defaultTimeOfDay={form.timeOfDay as any}
              onChange={(v) => setForm((s) => ({ ...s, musicConfig: v.musicConfig as any, sfxConfig: v.sfxConfig as any }))}
            />

            {/* Bulk upload inside dialog */}
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
                    (e.target as HTMLInputElement).value = '';
                  }} />
                </Button>
              </Box>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          {form.id && (
            <Button color="error" onClick={onDeleteFromDialog} sx={{ mr: 'auto' }}>
              Eliminar
            </Button>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" onClick={onSubmit}>{form.id ? 'Guardar' : 'Crear'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
