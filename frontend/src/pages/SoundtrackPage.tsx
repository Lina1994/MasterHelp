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
  Divider,
  TextField,
  Stack,
  LinearProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface SongMeta {
  id: string;
  name: string;
  group?: string | null;
  isPublic: boolean;
  size: number;
  mimeType: string;
}

interface SectionedSongsResponse {
  associated: SongMeta[];
  reusable: SongMeta[];
}

export const SoundtrackPage = () => {
  const campaignId = useCampaignId();
  const [data, setData] = useState<SectionedSongsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [snack, setSnack] = useState<{ msg: string; type: 'success' | 'error'} | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);

  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/soundtrack/campaigns/${campaignId}/songs`, { headers: getAuthHeaders() });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error cargando canciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSongs(); }, [campaignId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const form = new FormData();
    form.append('name', newName.trim());
    form.append('campaignId', campaignId); // auto-asociar en backend
    if (file) form.append('file', file);
    else if (newUrl.trim()) form.append('url', newUrl.trim());
    try {
      await api.post(`/soundtrack/songs`, form, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }});
      setNewName('');
      setNewUrl('');
      setFile(null);
      setSnack({ msg: 'Canción creada', type: 'success' });
      await fetchSongs();
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error creando canción', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleAssociate = async (songId: string) => {
    try {
      await api.post(`/soundtrack/songs/${songId}/associate`, { campaignIds: [campaignId] }, { headers: getAuthHeaders() });
      setSnack({ msg: 'Asociada a campaña', type: 'success' });
      await fetchSongs();
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error asociando', type: 'error' });
    }
  };

  const handleUnassociate = async (songId: string) => {
    try {
      await api.delete(`/soundtrack/songs/${songId}/associate/${campaignId}`, { headers: getAuthHeaders() });
      setSnack({ msg: 'Desasociada', type: 'success' });
      await fetchSongs();
    } catch (e: any) {
      setSnack({ msg: e.response?.data?.message || 'Error desasociando', type: 'error' });
    }
  };

  // Endpoint protegido: necesitamos incluir Authorization manualmente -> fetch blob y crear ObjectURL
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
    } finally {
      setLoadingAudio(prev => (prev === songId ? null : prev));
    }
  };

  const handlePlay = async (songId: string) => {
    if (playingId === songId) {
      setPlayingId(null);
      return;
    }
    await ensureObjectUrl(songId);
    setPlayingId(songId);
  };

  // Liberar ObjectURLs al desmontar para evitar fugas
  useEffect(() => {
    return () => {
      Object.values(objectUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [objectUrls]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Soundtrack</Typography>
      {loading && <LinearProgress sx={{ mb:2 }} />}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid container spacing={2} columns={12}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined">
              <CardHeader title="Nueva Canción" />
              <CardContent>
                <Stack spacing={2}>
                  <TextField label="Nombre" size="small" value={newName} onChange={e => setNewName(e.target.value)} />
                  <TextField label="URL (opcional)" size="small" value={newUrl} onChange={e => setNewUrl(e.target.value)} helperText="Si se provee URL no es necesario archivo" />
                  <input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                  <Button startIcon={<AddIcon />} disabled={creating} variant="contained" onClick={handleCreate}>Crear</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
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
                            <IconButton onClick={() => handlePlay(s.id)} size="small"><PlayArrowIcon /></IconButton>
                          </Stack>
                        }>
                          <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                          {playingId === s.id && (
                            <>
                              {loadingAudio === s.id && <Typography variant="caption">Cargando...</Typography>}
                              <audio autoPlay controls src={objectUrls[s.id]} style={{ display:'block', width:'100%' }} />
                            </>
                          )}
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
                            <IconButton onClick={() => handlePlay(s.id)} size="small"><PlayArrowIcon /></IconButton>
                          </Stack>
                        }>
                          <ListItemText primary={s.name} secondary={`${(s.size/1024).toFixed(1)} KB`} />
                          {playingId === s.id && (
                            <>
                              {loadingAudio === s.id && <Typography variant="caption">Cargando...</Typography>}
                              <audio autoPlay controls src={objectUrls[s.id]} style={{ display:'block', width:'100%' }} />
                            </>
                          )}
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
          </Grid>
        </Grid>
      </Grid>
      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}>
        {snack ? <Alert severity={snack.type} onClose={() => setSnack(null)}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};

export default SoundtrackPage;
