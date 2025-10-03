import { useEffect, useState } from 'react';
import { useCampaignId } from '../hooks/useCampaignId';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Stack,
  LinearProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface SongMeta {
  id: string;
  name: string;
  group?: string | null;
  isPublic: boolean;
  size: number;
  mimeType: string;
  artist?: string | null;
  album?: string | null;
  atmosphere?: string | null;
}

interface SectionedSongsResponse {
  associated: SongMeta[];
  reusable: SongMeta[];
}

/**
 * Página de gestión de Soundtrack (canciones) para la campaña activa.
 * Permite: listar asociadas y reutilizables, subir nueva canción, reproducir vía streaming autenticado,
 * editar metadatos (nombre, artista, grupo, álbum, atmósfera) y eliminar canciones sin asociaciones.
 */
export const SoundtrackPage = () => {
  const campaignId = useCampaignId();
  // Estado de datos y UI
  const [data, setData] = useState<SectionedSongsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; type: 'success' | 'error'} | null>(null);

  // Creación
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [group, setGroup] = useState('');
  const [atmosphere, setAtmosphere] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  // Reproducción
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingMeta, setPlayingMeta] = useState<SongMeta | null>(null);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);

  // Edición
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<SongMeta | null>(null);
  const [editShowAdvanced, setEditShowAdvanced] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editAtmosphere, setEditAtmosphere] = useState('');

  // Confirmación de borrado
  const [deleteTarget, setDeleteTarget] = useState<SongMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Data Fetch ---
  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/soundtrack/campaigns/${campaignId}/songs`, { headers: getAuthHeaders() });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error cargando canciones');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSongs(); }, [campaignId]);

  // --- Helpers / Actions ---
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const form = new FormData();
    form.append('name', newName.trim());
    form.append('campaignId', campaignId);
    if (group.trim()) form.append('group', group.trim());
    if (artist.trim()) form.append('artist', artist.trim());
    if (album.trim()) form.append('album', album.trim());
    if (atmosphere.trim()) form.append('atmosphere', atmosphere.trim());
    if (file) form.append('file', file); else if (newUrl.trim()) form.append('url', newUrl.trim());
    try {
      await api.post(`/soundtrack/songs`, form, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }});
      setNewName(''); setNewUrl(''); setFile(null);
      setArtist(''); setAlbum(''); setGroup(''); setAtmosphere(''); setShowAdvanced(false);
      setSnack({ msg: 'Canción creada', type: 'success' });
      await fetchSongs();
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error creando canción', type: 'error' });
    } finally { setCreating(false); }
  };

  const handleAssociate = async (songId: string) => {
    try {
      await api.post(`/soundtrack/songs/${songId}/associate`, { campaignIds: [campaignId] }, { headers: getAuthHeaders() });
      setSnack({ msg: 'Asociada a campaña', type: 'success' });
      await fetchSongs();
    } catch (e: any) { setSnack({ msg: e.response?.data?.message || 'Error asociando', type: 'error' }); }
  };

  const handleUnassociate = async (songId: string) => {
    try {
      await api.delete(`/soundtrack/songs/${songId}/associate/${campaignId}`, { headers: getAuthHeaders() });
      setSnack({ msg: 'Desasociada', type: 'success' });
      await fetchSongs();
    } catch (e: any) { setSnack({ msg: e.response?.data?.message || 'Error desasociando', type: 'error' }); }
  };

  const buildStreamEndpoint = (songId: string) => `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`;

  const ensureObjectUrl = async (songId: string) => {
    if (objectUrls[songId]) return objectUrls[songId];
    setLoadingAudio(songId);
    try {
      const res = await api.get(buildStreamEndpoint(songId), { headers: getAuthHeaders(), responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setObjectUrls(prev => ({ ...prev, [songId]: url }));
      return url;
    } finally { setLoadingAudio(prev => (prev === songId ? null : prev)); }
  };

  const handlePlay = async (songId: string) => {
    if (playingId === songId) { setPlayingId(null); setPlayingMeta(null); return; }
    await ensureObjectUrl(songId);
    const meta = data?.associated.find(s => s.id === songId) || data?.reusable.find(s => s.id === songId) || null;
    setPlayingMeta(meta || null);
    setPlayingId(songId);
  };

  const openEditDialog = (s: SongMeta) => {
    setEditTarget(s);
    setEditName(s.name);
    setEditArtist(s.artist || '');
    setEditAlbum(s.album || '');
    setEditGroup(s.group || '');
    setEditAtmosphere(s.atmosphere || '');
    setEditShowAdvanced(!!(s.artist || s.album || s.group || s.atmosphere));
    setOpenEdit(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditing(true);
    try {
      await api.patch(`/soundtrack/songs/${editTarget.id}`, {
        name: editName.trim() || editTarget.name,
        artist: editArtist.trim() || null,
        album: editAlbum.trim() || null,
        group: editGroup.trim() || null,
        atmosphere: editAtmosphere.trim() || null,
      }, { headers: getAuthHeaders() });
      setSnack({ msg: 'Canción actualizada', type: 'success' });
      await fetchSongs();
      setOpenEdit(false);
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error actualizando', type: 'error' });
    } finally { setEditing(false); }
  };

  const requestDelete = (songId: string) => {
    const meta = data?.associated.find(s => s.id === songId) || data?.reusable.find(s => s.id === songId) || null;
    if (meta) setDeleteTarget(meta);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/soundtrack/songs/${deleteTarget.id}`, { headers: getAuthHeaders() });
      setSnack({ msg: 'Canción eliminada', type: 'success' });
      await fetchSongs();
      if (playingId === deleteTarget.id) { setPlayingId(null); setPlayingMeta(null); }
      setDeleteTarget(null);
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error eliminando', type: 'error' });
    } finally { setDeleting(false); }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Soundtrack</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpenCreate(true)}>Nueva Canción</Button>
      </Box>
      {loading && <LinearProgress sx={{ mb:2 }} />}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      {playingId && (
        <Card variant="outlined" sx={{ mb:3 }}>
          <CardHeader title={playingMeta?.name || 'Reproduciendo'} subheader={playingMeta ? `${(playingMeta.size/1024).toFixed(1)} KB` : undefined} />
          <CardContent>
            {loadingAudio === playingId && <Typography variant="caption">Cargando audio...</Typography>}
            <audio autoPlay controls src={objectUrls[playingId]} style={{ width:'100%' }} onEnded={() => { setPlayingId(null); setPlayingMeta(null); }} />
            <Box mt={1} display="flex" gap={1}>
              <Button size="small" onClick={() => { setPlayingId(null); setPlayingMeta(null); }}>Cerrar</Button>
            </Box>
          </CardContent>
        </Card>
      )}
      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Asociadas" />
            <CardContent sx={{ p:0 }}>
              <List dense>
                {data?.associated.map(s => (
                  <ListItem key={s.id} secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton onClick={() => handleUnassociate(s.id)} size="small" title="Desasociar"><LinkOffIcon /></IconButton>
                      <IconButton onClick={() => openEditDialog(s)} size="small" title="Editar"><EditIcon /></IconButton>
                      <IconButton onClick={() => requestDelete(s.id)} size="small" title="Eliminar"><DeleteIcon /></IconButton>
                      <IconButton onClick={() => handlePlay(s.id)} size="small" title="Reproducir"><PlayArrowIcon /></IconButton>
                    </Stack>
                  }>
                    <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                  </ListItem>
                ))}
                {data && data.associated.length === 0 && (
                  <ListItem><ListItemText primary="No hay canciones asociadas" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Reutilizables" subheader="No asociadas aún" />
            <CardContent sx={{ p:0 }}>
              <List dense>
                {data?.reusable.map(s => (
                  <ListItem key={s.id} secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton onClick={() => handleAssociate(s.id)} size="small" title="Asociar"><LinkIcon /></IconButton>
                      <IconButton onClick={() => openEditDialog(s)} size="small" title="Editar"><EditIcon /></IconButton>
                      <IconButton onClick={() => requestDelete(s.id)} size="small" title="Eliminar"><DeleteIcon /></IconButton>
                      <IconButton onClick={() => handlePlay(s.id)} size="small" title="Reproducir"><PlayArrowIcon /></IconButton>
                    </Stack>
                  }>
                    <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                  </ListItem>
                ))}
                {data && data.reusable.length === 0 && (
                  <ListItem><ListItemText primary="No hay canciones reutilizables" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva Canción</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={newName} onChange={e => setNewName(e.target.value)} fullWidth />
            <TextField label="URL (opcional)" size="small" value={newUrl} onChange={e => setNewUrl(e.target.value)} helperText="Si se provee URL no es necesario archivo" fullWidth />
            <input type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f && !newName.trim()) { const base = f.name.replace(/\.[^.]+$/, ''); setNewName(base); } }} />
            <Box>
              <Button size="small" onClick={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Ocultar detalles' : 'Más detalles'}</Button>
            </Box>
            {showAdvanced && (
              <Stack spacing={2}>
                <TextField label="Artista" size="small" value={artist} onChange={e => setArtist(e.target.value)} fullWidth />
                <TextField label="Grupo" size="small" value={group} onChange={e => setGroup(e.target.value)} fullWidth />
                <TextField label="Álbum" size="small" value={album} onChange={e => setAlbum(e.target.value)} fullWidth />
                <TextField label="Atmósfera" size="small" value={atmosphere} onChange={e => setAtmosphere(e.target.value)} fullWidth />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
          <Button onClick={async () => { await handleCreate(); setOpenCreate(false); }} variant="contained" disabled={creating || !newName.trim()} startIcon={<AddIcon />}>Crear</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar Canción</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={editName} onChange={e => setEditName(e.target.value)} fullWidth />
            <Box>
              <Button size="small" onClick={() => setEditShowAdvanced(v => !v)}>{editShowAdvanced ? 'Ocultar detalles' : 'Más detalles'}</Button>
            </Box>
            {editShowAdvanced && (
              <Stack spacing={2}>
                <TextField label="Artista" size="small" value={editArtist} onChange={e => setEditArtist(e.target.value)} fullWidth />
                <TextField label="Grupo" size="small" value={editGroup} onChange={e => setEditGroup(e.target.value)} fullWidth />
                <TextField label="Álbum" size="small" value={editAlbum} onChange={e => setEditAlbum(e.target.value)} fullWidth />
                <TextField label="Atmósfera" size="small" value={editAtmosphere} onChange={e => setEditAtmosphere(e.target.value)} fullWidth />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Cancelar</Button>
          <Button onClick={handleEditSave} disabled={editing || !editName.trim()} variant="contained" startIcon={<EditIcon />}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}>
        {snack ? <Alert severity={snack.type} onClose={() => setSnack(null)}>{snack.msg}</Alert> : undefined}
      </Snackbar>
      <Dialog open={!!deleteTarget} onClose={() => (!deleting && setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar canción</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">¿Seguro que deseas eliminar <strong>{deleteTarget?.name}</strong>? Debe no estar asociada a ninguna campaña.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={performDelete} disabled={deleting} startIcon={<DeleteIcon />}>{deleting ? 'Eliminando...' : 'Eliminar'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SoundtrackPage;
