import { useEffect, useState, Fragment } from 'react';
import { SoundtrackTabs } from '../components/soundtrack/SoundtrackTabs';
import { SoundtrackSettingsPanel } from '../components/soundtrack/SoundtrackSettingsPanel';
import { useGlobalPlayer } from '../components/player/GlobalPlayerContext';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import { getCurrentUser } from '../utils/getCurrentUser';
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
  Autocomplete,
  Checkbox,
} from '@mui/material';
import type { AxiosProgressEvent } from 'axios';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

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
type OwnedSongsResponse = SongMeta[];

interface PlaylistMeta {
  id: string;
  name: string;
  songs: SongMeta[]; // simplified shape assumed from backend eager loading or additional fetch per item
}

/**
 * Página de gestión de Soundtrack (canciones) para la campaña activa.
 * Permite: listar asociadas y reutilizables, subir nueva canción, reproducir vía streaming autenticado,
 * editar metadatos (nombre, artista, grupo, álbum, atmósfera) y eliminar canciones sin asociaciones.
 */
export const SoundtrackPage = () => {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id;
  const canClearHistory = !!(campaignId && currentUserId && activeCampaign?.owner?.id && currentUserId === activeCampaign.owner.id);
  // Estado de datos y UI
  const [data, setData] = useState<SectionedSongsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; type: 'success' | 'error'} | null>(null);
  const [usage, setUsage] = useState<{ totalSize: number; count: number } | null>(null);

  // Filtros
  const [q, setQ] = useState('');
  const [filterGroups, setFilterGroups] = useState<string[]>([]);
  const [filterArtists, setFilterArtists] = useState<string[]>([]);
  const [filterAlbums, setFilterAlbums] = useState<string[]>([]);
  const [filterAtmospheres, setFilterAtmospheres] = useState<string[]>([]);
  const [filterPublic, setFilterPublic] = useState<'any' | 'true' | 'false'>('any');
  const [sort, setSort] = useState<'alpha' | 'alpha_desc' | 'newest' | 'oldest' | 'last_used'>('newest');

  // Opciones de filtros
  const [optionsGroups, setOptionsGroups] = useState<string[]>([]);
  const [optionsArtists, setOptionsArtists] = useState<string[]>([]);
  const [optionsAlbums, setOptionsAlbums] = useState<string[]>([]);
  const [optionsAtmospheres, setOptionsAtmospheres] = useState<string[]>([]);

  // Creación
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [group, setGroup] = useState('');
  const [atmosphere, setAtmosphere] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  // Reproducción global
  const { play, playQueue, current, stop } = useGlobalPlayer();
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

  // Playlists
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>([]);
  const [plName, setPlName] = useState('');
  const [openCreatePl, setOpenCreatePl] = useState(false);
  const [openEditPl, setOpenEditPl] = useState<PlaylistMeta | null>(null);
  const [savingPl, setSavingPl] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});

  // --- Data Fetch ---
  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
  const params: any = {};
      if (q.trim()) params.q = q.trim();
  if (filterGroups.length) params.group = filterGroups.join(',');
  if (filterArtists.length) params.artist = filterArtists.join(',');
  if (filterAlbums.length) params.album = filterAlbums.join(',');
  if (filterAtmospheres.length) params.atmosphere = filterAtmospheres.join(',');
      if (filterPublic !== 'any') params.isPublic = filterPublic === 'true' ? 'true' : 'false';
      if (sort) params.sort = sort;
      if (campaignId) {
        const res = await api.get(`/soundtrack/campaigns/${campaignId}/songs`, { headers: getAuthHeaders(), params });
        setData(res.data);
      } else {
        const res = await api.get<OwnedSongsResponse>(`/soundtrack/songs`, { headers: getAuthHeaders(), params });
        const list = res.data;
        setData({ associated: [], reusable: list });
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error cargando canciones');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSongs(); }, [campaignId]);

  // Cargar uso total del usuario (independiente de campaña)
  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`/soundtrack/usage`, { headers: getAuthHeaders() });
        setUsage(r.data);
      } catch {}
    };
    load();
  }, []);

  const fetchPlaylists = async () => {
    if (!campaignId) { setPlaylists([]); return; }
    try {
      const res = await api.get(`/soundtrack/campaigns/${campaignId}/playlists`, { headers: getAuthHeaders() });
      setPlaylists(res.data);
    } catch {}
  };
  useEffect(() => { fetchPlaylists(); }, [campaignId]);

  // Cargar opciones de filtros según contexto (campaña o owned)
  useEffect(() => {
    const load = async () => {
      try {
        if (campaignId) {
          const r = await api.get(`/soundtrack/campaigns/${campaignId}/filters`, { headers: getAuthHeaders() });
          setOptionsGroups(r.data.groups || []);
          setOptionsArtists(r.data.artists || []);
          setOptionsAlbums(r.data.albums || []);
          setOptionsAtmospheres(r.data.atmospheres || []);
        } else {
          const r = await api.get(`/soundtrack/filters`, { headers: getAuthHeaders() });
          setOptionsGroups(r.data.groups || []);
          setOptionsArtists(r.data.artists || []);
          setOptionsAlbums(r.data.albums || []);
          setOptionsAtmospheres(r.data.atmospheres || []);
        }
      } catch {}
    };
    load();
  }, [campaignId]);

  // Debounce de filtros
  useEffect(() => {
    const t = setTimeout(() => { fetchSongs(); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterGroups, filterArtists, filterAlbums, filterAtmospheres, filterPublic, sort]);

  // --- Helpers / Actions ---
  const handleCreate = async () => {
    // Two modes:
    // - Files selected (one or many): upload each with filename as name (single-file can honor newName if provided)
    // - URL provided: create single from URL using newName
    const hasFiles = files.length > 0;
    const hasUrl = !!newUrl.trim();
    if (!hasFiles && !hasUrl) return;
    setCreating(true);
    try {
      if (hasFiles) {
        // Initialize progress map
        const initial: Record<string, number> = {};
        for (const f of files) { initial[`${f.name}:${f.size}`] = 0; }
        setUploadProgress(initial);
        const uploads = files.map(async (f) => {
          const form = new FormData();
          const base = f.name.replace(/\.[^.]+$/, '');
          // If exactly one file and user typed a custom name, use it; otherwise use filename base
          const nameToUse = files.length === 1 && newName.trim() ? newName.trim() : base;
          form.append('name', nameToUse);
          if (campaignId) form.append('campaignId', campaignId);
          if (group.trim()) form.append('group', group.trim());
          if (artist.trim()) form.append('artist', artist.trim());
          if (album.trim()) form.append('album', album.trim());
          if (atmosphere.trim()) form.append('atmosphere', atmosphere.trim());
          form.append('file', f);
          const key = `${f.name}:${f.size}`;
          await api.post(`/soundtrack/songs`, form, {
            headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e: AxiosProgressEvent) => {
              const total = e.total ?? f.size;
              const loaded = e.loaded ?? 0;
              const percent = total ? Math.round((loaded / total) * 100) : 0;
              setUploadProgress(prev => ({ ...prev, [key]: percent }));
            },
          });
          // Ensure 100% at the end
          setUploadProgress(prev => ({ ...prev, [key]: 100 }));
        });
        const results = await Promise.allSettled(uploads);
        const ok = results.filter(r => r.status === 'fulfilled').length;
        const fail = results.length - ok;
        setSnack({ msg: `Subida completada: ${ok} ok${fail ? `, ${fail} errores` : ''}` , type: fail ? 'error' : 'success' });
      } else if (hasUrl) {
        if (!newName.trim()) { setSnack({ msg: 'Indica un nombre para la URL', type: 'error' }); return; }
        const form = new FormData();
        form.append('name', newName.trim());
        if (campaignId) form.append('campaignId', campaignId);
        if (group.trim()) form.append('group', group.trim());
        if (artist.trim()) form.append('artist', artist.trim());
        if (album.trim()) form.append('album', album.trim());
        if (atmosphere.trim()) form.append('atmosphere', atmosphere.trim());
        form.append('url', newUrl.trim());
        await api.post(`/soundtrack/songs`, form, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }});
        setSnack({ msg: 'Canción creada', type: 'success' });
      }
      // Reset and refresh
      setNewName(''); setNewUrl(''); setFiles([]);
      setArtist(''); setAlbum(''); setGroup(''); setAtmosphere(''); setShowAdvanced(false);
      await fetchSongs();
      // Refresh usage too
      try { const r = await api.get(`/soundtrack/usage`, { headers: getAuthHeaders() }); setUsage(r.data); } catch {}
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error creando canción', type: 'error' });
    } finally { setCreating(false); }
  };

  const handleAssociate = async (songId: string) => {
    if (!campaignId) return;
    try {
      await api.post(`/soundtrack/songs/${songId}/associate`, { campaignIds: [campaignId] }, { headers: getAuthHeaders() });
      setSnack({ msg: 'Asociada a campaña', type: 'success' });
      await fetchSongs();
    } catch (e: any) { setSnack({ msg: e.response?.data?.message || 'Error asociando', type: 'error' }); }
  };

  const handleUnassociate = async (songId: string) => {
    if (!campaignId) return;
    try {
      await api.delete(`/soundtrack/songs/${songId}/associate/${campaignId}`, { headers: getAuthHeaders() });
      setSnack({ msg: 'Desasociada', type: 'success' });
      await fetchSongs();
    } catch (e: any) { setSnack({ msg: e.response?.data?.message || 'Error desasociando', type: 'error' }); }
  };

  const buildStreamEndpoint = (songId: string) => {
    // Si hay campaignId lo incluimos; de lo contrario omitimos para fallback a preview owner-only
    return campaignId
      ? `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`
      : `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream`;
  };

  const ensureObjectUrl = async (songId: string) => {
    setLoadingAudio(songId);
    try {
      const res = await api.get(buildStreamEndpoint(songId), { headers: getAuthHeaders(), responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      return url;
    } finally { setLoadingAudio(prev => (prev === songId ? null : prev)); }
  };

  const handlePlay = async (songId: string) => {
    const meta = data?.associated?.find(s => s.id === songId) || data?.reusable?.find(s => s.id === songId) || null;
    if (!meta) return;
    await play({ id: meta.id, name: meta.name, size: meta.size, mimeType: meta.mimeType }, async () => {
      // Marcar como usada (lastPlayedAt)
      try {
        await api.post(`/soundtrack/songs/${songId}/played`, null, { headers: getAuthHeaders(), params: campaignId ? { campaignId } : undefined });
      } catch {}
      const url = await ensureObjectUrl(songId);
      return url;
    });
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
    const meta = data?.associated?.find(s => s.id === songId) || data?.reusable?.find(s => s.id === songId) || null;
    if (meta) setDeleteTarget(meta);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const deletingId = deleteTarget.id;
    try {
      await api.delete(`/soundtrack/songs/${deletingId}`, { headers: getAuthHeaders() });
      setSnack({ msg: 'Canción eliminada', type: 'success' });
      await fetchSongs();
      if (current && current.id === deletingId) { stop(); }
      if (editTarget && editTarget.id === deletingId) { setOpenEdit(false); }
      setDeleteTarget(null);
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error eliminando', type: 'error' });
    } finally { setDeleting(false); }
  };

  return (
    <Box>
      <SoundtrackTabs current="songs" />
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Soundtrack</Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {usage ? `${(usage.totalSize/1024/1024).toFixed(2)} MB / ${usage.count} pistas` : 'Calculando uso...'}
          </Typography>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpenCreate(true)}>Nueva Canción</Button>
        </Box>
      </Box>

      {campaignId ? <SoundtrackSettingsPanel campaignId={campaignId} canClearHistory={canClearHistory} /> : null}

      <Card variant="outlined" sx={{ mb:2 }}>
        <CardContent>
          <Grid container spacing={2} columns={12}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth size="small" label="Buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, artista, álbum, grupo, atmósfera" />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth size="small" label="Orden" value={sort} onChange={e => setSort(e.target.value as any)} select SelectProps={{ native: true }}>
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguas</option>
                <option value="alpha">Alfabético A-Z</option>
                <option value="alpha_desc">Alfabético Z-A</option>
                <option value="last_used">Últimas usadas</option>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Autocomplete
                multiple
                size="small"
                options={optionsGroups}
                value={filterGroups}
                onChange={(_, v) => setFilterGroups(v)}
                renderInput={(params) => <TextField {...params} label="Grupo" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Autocomplete
                multiple
                size="small"
                options={optionsArtists}
                value={filterArtists}
                onChange={(_, v) => setFilterArtists(v)}
                renderInput={(params) => <TextField {...params} label="Artista" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Autocomplete
                multiple
                size="small"
                options={optionsAlbums}
                value={filterAlbums}
                onChange={(_, v) => setFilterAlbums(v)}
                renderInput={(params) => <TextField {...params} label="Álbum" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Autocomplete
                multiple
                size="small"
                options={optionsAtmospheres}
                value={filterAtmospheres}
                onChange={(_, v) => setFilterAtmospheres(v)}
                renderInput={(params) => <TextField {...params} label="Atmósfera" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth size="small" label="Público" value={filterPublic} onChange={e => setFilterPublic(e.target.value as any)} select SelectProps={{ native: true }}>
                <option value="any">Todos</option>
                <option value="true">Sólo públicos</option>
                <option value="false">Sólo privados</option>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      {loading && <LinearProgress sx={{ mb:2 }} />}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      {/* Reproductor local eliminado: ahora se usa GlobalPlayerBar persistente */}
      {!campaignId && (
        <Alert severity="info" sx={{ mb:2 }}>No hay campaña activa seleccionada. Puedes subir canciones y luego asociarlas cuando elijas una campaña.</Alert>
      )}
      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardHeader title="Listas de reproducción" action={<>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenCreatePl(true)} disabled={!campaignId}>Nueva lista</Button>
              <Button size="small" variant={shuffle ? 'contained' : 'outlined'} startIcon={<ShuffleIcon />} sx={{ ml:1 }} onClick={() => setShuffle(s => !s)}>Aleatorio {shuffle ? 'ON' : 'OFF'}</Button>
            </>} />
            <CardContent sx={{ p:0 }}>
              <List dense>
                {playlists.map(pl => (
                  <Fragment key={pl.id}>
                  <ListItem secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" onClick={() => setExpandedPlaylists(prev => ({ ...prev, [pl.id]: !prev[pl.id] }))}>
                        {expandedPlaylists[pl.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <IconButton size="small" title="Reproducir" onClick={async () => {
                        const items = (pl.songs || []).map(s => ({ id: s.id, name: s.name, size: s.size, mimeType: s.mimeType }));
                        await playQueue(items, async (id: string) => {
                          // Marcar como usada (lastPlayedAt) por cada pista al comenzar su carga
                          try {
                            await api.post(`/soundtrack/songs/${id}/played`, null, { headers: getAuthHeaders(), params: campaignId ? { campaignId } : undefined });
                          } catch {}
                          const res = await api.get(buildStreamEndpoint(id), { headers: getAuthHeaders(), responseType: 'blob' });
                          return URL.createObjectURL(res.data as Blob);
                        }, { shuffle });
                      }}><PlaylistPlayIcon /></IconButton>
                      <IconButton size="small" title="Editar" onClick={() => setOpenEditPl(pl)}><EditIcon /></IconButton>
                      <IconButton size="small" title="Eliminar" onClick={async () => {
                        if (!campaignId) return;
                        await api.delete(`/soundtrack/campaigns/${campaignId}/playlists/${pl.id}`, { headers: getAuthHeaders() });
                        await fetchPlaylists();
                      }}><DeleteIcon /></IconButton>
                    </Stack>
                  }>
                    <ListItemText primary={pl.name} secondary={`${pl.songs?.length || 0} canciones`} />
                  </ListItem>
                  {expandedPlaylists[pl.id] && (
                    <Box px={2} pb={1}>
                      <List dense>
                        {(pl.songs || []).map((s, idx) => {
                          const isCurrent = current?.id === s.id;
                          return (
                            <ListItem
                              key={s.id}
                              secondaryAction={
                                <Stack direction="row" spacing={1}>
                                  <IconButton onClick={async () => {
                                    const items = (pl.songs || []).map(x => ({ id: x.id, name: x.name, size: x.size, mimeType: x.mimeType }));
                                    const startIndex = idx;
                                    await playQueue(items, async (id: string) => {
                                      try {
                                        await api.post(`/soundtrack/songs/${id}/played`, null, { headers: getAuthHeaders(), params: campaignId ? { campaignId } : undefined });
                                      } catch {}
                                      const res = await api.get(buildStreamEndpoint(id), { headers: getAuthHeaders(), responseType: 'blob' });
                                      return URL.createObjectURL(res.data as Blob);
                                    }, { shuffle: false, startIndex });
                                  }} size="small" title="Reproducir"><PlayArrowIcon /></IconButton>
                                </Stack>
                              }
                              sx={isCurrent ? { bgcolor: 'action.selected', borderLeft: '3px solid', borderColor: 'primary.main' } : undefined}
                            >
                              <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                            </ListItem>
                          );
                        })}
                        {(pl.songs || []).length === 0 && (
                          <ListItem><ListItemText primary="Lista vacía" /></ListItem>
                        )}
                      </List>
                    </Box>
                  )}
                  </Fragment>
                ))}
                {playlists.length === 0 && (
                  <ListItem><ListItemText primary="No hay listas de reproducción" /></ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="Asociadas" subheader={!campaignId ? 'Selecciona una campaña para ver asociaciones' : undefined} />
            <CardContent sx={{ p:0 }}>
              <List dense>
                {campaignId && data?.associated?.map((s) => {
                  const isCurrent = current?.id === s.id;
                  return (
                    <ListItem
                      key={s.id}
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          <IconButton onClick={() => handleUnassociate(s.id)} size="small" title="Desasociar"><LinkOffIcon /></IconButton>
                          <IconButton onClick={() => openEditDialog(s)} size="small" title="Editar"><EditIcon /></IconButton>
                          <IconButton onClick={() => handlePlay(s.id)} size="small" title="Reproducir"><PlayArrowIcon /></IconButton>
                        </Stack>
                      }
                      sx={isCurrent ? { bgcolor: 'action.selected', borderLeft: '3px solid', borderColor: 'primary.main' } : undefined}
                    >
                      <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                    </ListItem>
                  );
                })}
                {campaignId && data && data.associated.length === 0 && (
                  <ListItem><ListItemText primary="No hay canciones asociadas" /></ListItem>
                )}
                {!campaignId && (
                  <ListItem><ListItemText primary="No hay canciones asociadas (sin campaña activa)" /></ListItem>
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
                {data?.reusable?.map((s) => {
                  const isCurrent = current?.id === s.id;
                  return (
                    <ListItem
                      key={s.id}
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          {campaignId && (
                            <IconButton onClick={() => handleAssociate(s.id)} size="small" title="Asociar"><LinkIcon /></IconButton>
                          )}
                          <IconButton onClick={() => openEditDialog(s)} size="small" title="Editar"><EditIcon /></IconButton>
                          <IconButton onClick={() => handlePlay(s.id)} size="small" title="Reproducir"><PlayArrowIcon /></IconButton>
                        </Stack>
                      }
                      sx={isCurrent ? { bgcolor: 'action.selected', borderLeft: '3px solid', borderColor: 'primary.main' } : undefined}
                    >
                      <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                    </ListItem>
                  );
                })}
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
            {/* Nombre: solo relevante para URL o para 1 archivo. Si hay múltiples, se usarán los nombres de archivo. */}
            {files.length <= 1 && (
              <TextField label="Nombre" size="small" value={newName} onChange={e => setNewName(e.target.value)} fullWidth />
            )}
            <TextField label="URL (opcional)" size="small" value={newUrl} onChange={e => setNewUrl(e.target.value)} helperText="Si se provee URL no es necesario archivo" fullWidth disabled={files.length > 0} />
            <Typography variant="caption" color="text.secondary">
              En un lote, cada canción usará su nombre de archivo; si rellenas Artista/Grupo/Álbum/Atmósfera, se aplicarán a todas.
            </Typography>
            <Box
              sx={{
                p: 2,
                border: '2px dashed',
                borderColor: isDragging ? 'primary.main' : 'divider',
                borderRadius: 1,
                textAlign: 'center',
                bgcolor: isDragging ? 'action.hover' : 'transparent',
                cursor: 'pointer',
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setIsDragging(false);
                const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/')); 
                if (dropped.length) {
                  setFiles(prev => {
                    // avoid duplicates by name+size
                    const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
                    for (const d of dropped) map.set(d.name + ':' + d.size, d);
                    const arr = Array.from(map.values());
                    // if exactly one and no newName, set
                    if (arr.length === 1 && !newName.trim()) { const base = arr[0].name.replace(/\.[^.]+$/, ''); setNewName(base); }
                    return arr;
                  });
                }
              }}
              onClick={() => {
                // programmatically click hidden input
                const input = document.getElementById('file-input-multi') as HTMLInputElement | null;
                input?.click();
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Arrastra aquí tus archivos de audio o haz click para seleccionarlos
              </Typography>
              <input id="file-input-multi" type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => {
                const list = Array.from(e.target.files || []);
                if (!list.length) return;
                setFiles(prev => {
                  const map = new Map(prev.map(f => [f.name + ':' + f.size, f]));
                  for (const d of list) map.set(d.name + ':' + d.size, d);
                  const arr = Array.from(map.values());
                  if (arr.length === 1 && !newName.trim()) { const base = arr[0].name.replace(/\.[^.]+$/, ''); setNewName(base); }
                  return arr;
                });
              }} />
            </Box>
            {files.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Seleccionados: {files.length} archivo(s)</Typography>
                <List dense>
                  {files.slice(0, 5).map(f => {
                    const key = f.name + ':' + f.size;
                    const pct = uploadProgress[key];
                    return (
                      <ListItem key={key} sx={{ alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <ListItemText primary={f.name} secondary={`${(f.size/1024).toFixed(1)} KB`} />
                          {creating && (
                            <Box sx={{ pr: 2 }}>
                              <LinearProgress variant={typeof pct === 'number' ? 'determinate' : 'indeterminate'} value={pct ?? 0} />
                              <Typography variant="caption" color="text.secondary">{typeof pct === 'number' ? `${pct}%` : 'Subiendo…'}</Typography>
                            </Box>
                          )}
                        </Box>
                      </ListItem>
                    );
                  })}
                  {files.length > 5 && (
                    <ListItem><ListItemText primary={`… y ${files.length - 5} más`} /></ListItem>
                  )}
                </List>
              </Box>
            )}
            <Box>
              <Button size="small" onClick={() => setShowAdvanced(v => !v)}>{showAdvanced ? 'Ocultar detalles' : 'Más detalles'}</Button>
            </Box>
            {showAdvanced && (
              <Stack spacing={2}>
                <Typography variant="caption" color="text.secondary">
                  Estos metadatos se aplican a todas las canciones seleccionadas en este lote.
                </Typography>
                <TextField label="Artista" size="small" value={artist} onChange={e => setArtist(e.target.value)} fullWidth />
                <TextField label="Grupo" size="small" value={group} onChange={e => setGroup(e.target.value)} fullWidth />
                <TextField label="Álbum" size="small" value={album} onChange={e => setAlbum(e.target.value)} fullWidth />
                <TextField label="Atmósfera" size="small" value={atmosphere} onChange={e => setAtmosphere(e.target.value)} fullWidth />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} disabled={creating}>Cancelar</Button>
          <Button onClick={async () => { await handleCreate(); setOpenCreate(false); }} variant="contained" disabled={creating || (!(files.length > 0) && !(newUrl.trim() && newName.trim()))} startIcon={<AddIcon />}>Crear</Button>
        </DialogActions>
      </Dialog>
      {/* Crear playlist */}
      <Dialog open={openCreatePl} onClose={() => setOpenCreatePl(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva lista</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={plName} onChange={e => setPlName(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreatePl(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!campaignId || !plName.trim() || savingPl} onClick={async () => {
            if (!campaignId) return; setSavingPl(true);
            try {
              await api.post(`/soundtrack/campaigns/${campaignId}/playlists`, { name: plName.trim() }, { headers: getAuthHeaders() });
              setPlName(''); setOpenCreatePl(false);
              await fetchPlaylists();
            } finally { setSavingPl(false); }
          }}>Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Editar playlist */}
      <Dialog open={!!openEditPl} onClose={() => setOpenEditPl(null)} fullWidth maxWidth="sm">
        <DialogTitle>Editar lista</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField label="Nombre" size="small" value={openEditPl?.name || ''} onChange={e => setOpenEditPl(prev => prev ? { ...prev, name: e.target.value } : prev)} fullWidth />
            <Autocomplete
              multiple
              size="small"
              options={(data?.associated || [])}
              value={openEditPl?.songs || []}
              getOptionLabel={(opt) => opt.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              disableCloseOnSelect
              onChange={(_, values) => {
                setOpenEditPl(prev => prev ? { ...prev, songs: values as SongMeta[] } : prev);
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    style={{ marginRight: 8 }}
                    checked={selected}
                  />
                  {option.name}
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Canciones (asociadas)" />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditPl(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!campaignId || !openEditPl || savingPl} onClick={async () => {
            if (!campaignId || !openEditPl) return; setSavingPl(true);
            try {
              await api.patch(`/soundtrack/campaigns/${campaignId}/playlists/${openEditPl.id}`, {
                name: openEditPl.name,
                songs: (openEditPl.songs || []).map(s => s.id),
              }, { headers: getAuthHeaders() });
              setOpenEditPl(null);
              await fetchPlaylists();
            } finally { setSavingPl(false); }
          }}>Guardar</Button>
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
          <Button color="error" onClick={() => editTarget && requestDelete(editTarget.id)} startIcon={<DeleteIcon />}>Eliminar</Button>
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
