import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api } from '../../apiBase';
import { useGlobalPlayer } from '../player/GlobalPlayerContext';
import { clearSongPlayHistory, getSongPlayHistory, type SongPlayHistoryItem } from '../../api/soundtrack';

export interface SongHistoryCardProps {
  campaignId: string;
  limit?: number;
  variant?: 'card' | 'plain';
  canClear?: boolean;
}

function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

/**
 * Renders the recent playback history for a campaign.
 */
export const SongHistoryCard: React.FC<SongHistoryCardProps> = ({ campaignId, limit = 25, variant = 'card', canClear = false }) => {
  const { play, loading: playerLoading } = useGlobalPlayer();
  const [items, setItems] = useState<SongPlayHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getSongPlayHistory(campaignId, { limit });
      setItems(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [campaignId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const buildStreamEndpoint = (songId: string) => {
    return `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaignId}`;
  };

  const ensureObjectUrl = async (songId: string) => {
    const res = await api.get(buildStreamEndpoint(songId), { responseType: 'blob' });
    const blob = res.data as Blob;
    return URL.createObjectURL(blob);
  };

  const handlePlayFromHistory = async (songId: string, songName: string) => {
    if (!campaignId) return;

    await play({ id: songId, name: songName }, async () => {
      // Marcar como reproducida (también alimenta el historial en backend). Best-effort.
      try {
        await api.post(`/soundtrack/songs/${songId}/played`, null, { params: { campaignId } });
      } catch {}
      return ensureObjectUrl(songId);
    });

    // refrescar el historial para que aparezca arriba
    load();
  };

  const handleClearHistory = async () => {
    if (!campaignId) return;
    setClearing(true);
    setError(null);
    try {
      await clearSongPlayHistory(campaignId);
      setItems([]);
      setConfirmOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo borrar el historial');
    } finally {
      setClearing(false);
    }
  };

  const content = (
    <Stack spacing={1}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        {variant === 'card' ? <Typography variant="h6">Historial de reproducción</Typography> : null}
        <Stack direction="row" spacing={0.5} alignItems="center">
          {canClear ? (
            <IconButton
              size="small"
              onClick={() => setConfirmOpen(true)}
              disabled={loading || clearing}
              aria-label="Borrar historial"
              title="Borrar historial"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          ) : null}
          <IconButton size="small" onClick={load} disabled={loading} aria-label="Recargar historial">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <List dense disablePadding>
        {(items || []).map((it) => (
          <ListItem key={it.id} divider disablePadding>
            <ListItemButton
              onClick={() => handlePlayFromHistory(it.songId, it.songName)}
              disabled={loading || playerLoading}
              aria-label={`Reproducir ${it.songName}`}
            >
              <ListItemText
                primary={it.songName}
                secondary={formatDateTime(it.playedAt)}
                primaryTypographyProps={{ noWrap: true }}
              />
              <PlayArrowIcon fontSize="small" />
            </ListItemButton>
          </ListItem>
        ))}
        {!loading && (!items || items.length === 0) ? (
          <ListItem>
            <ListItemText primary="Sin reproducciones todavía" />
          </ListItem>
        ) : null}
      </List>

      <Dialog open={confirmOpen} onClose={() => (clearing ? null : setConfirmOpen(false))}>
        <DialogTitle>Borrar historial</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Esto eliminará todas las entradas del historial de reproducción de esta campaña.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={clearing}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleClearHistory} disabled={clearing}>
            Borrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );

  if (variant === 'plain') return content;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>{content}</CardContent>
    </Card>
  );
};
