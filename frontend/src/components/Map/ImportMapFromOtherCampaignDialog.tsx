import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LandscapeIcon from '@mui/icons-material/Landscape';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AuthImage from '../common/AuthImage';
import {
  OtherCampaignMapDto,
  listOtherCampaignMaps,
  importMapToCampaign,
  getMapImageUrlSized,
} from '../../api/maps';

interface ImportMapFromOtherCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onImported: () => void;
}

/**
 * Dialog that lists maps from other campaigns and allows importing (cloning)
 * them into the active campaign.
 */
export default function ImportMapFromOtherCampaignDialog({
  open,
  onClose,
  campaignId,
  onImported,
}: ImportMapFromOtherCampaignDialogProps) {
  const [maps, setMaps] = useState<OtherCampaignMapDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const fetchMaps = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const data = await listOtherCampaignMaps(campaignId);
      setMaps(data);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (open) {
      fetchMaps();
      setImported(new Set());
      setSearch('');
    }
  }, [open, fetchMaps]);

  const handleImport = useCallback(async (mapId: string) => {
    setImporting(prev => new Set(prev).add(mapId));
    try {
      await importMapToCampaign(mapId, campaignId);
      setImported(prev => new Set(prev).add(mapId));
      onImported();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[ImportMap] error:', err?.response?.data || err);
      alert(`Error al importar: ${err?.response?.data?.message || err?.message || 'Desconocido'}`);
    } finally {
      setImporting(prev => {
        const next = new Set(prev);
        next.delete(mapId);
        return next;
      });
    }
  }, [campaignId, onImported]);

  /** Group maps by campaign name for better readability. */
  const grouped = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = search
      ? maps.filter(m =>
          m.name.toLowerCase().includes(lowerSearch) ||
          (m.description ?? '').toLowerCase().includes(lowerSearch) ||
          (m.campaignName ?? '').toLowerCase().includes(lowerSearch))
      : maps;

    const groups = new Map<string, OtherCampaignMapDto[]>();
    for (const m of filtered) {
      const key = m.campaignName ?? 'Sin campaña';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return groups;
  }, [maps, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Mapas de otras campañas</DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          label="Buscar"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : maps.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No hay mapas en otras campañas.
          </Typography>
        ) : grouped.size === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Sin resultados para la búsqueda.
          </Typography>
        ) : (
          Array.from(grouped.entries()).map(([campaignName, campaignMaps]) => (
            <Box key={campaignName} sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                {campaignName}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: 1.5,
                }}
              >
                {campaignMaps.map(m => (
                  <OtherCampaignMapCard
                    key={m.id}
                    map={m}
                    isImporting={importing.has(m.id)}
                    isImported={imported.has(m.id)}
                    onImport={() => handleImport(m.id)}
                  />
                ))}
              </Box>
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Card for a single map from another campaign               */
/* ────────────────────────────────────────────────────────── */

interface OtherCampaignMapCardProps {
  map: OtherCampaignMapDto;
  isImporting: boolean;
  isImported: boolean;
  onImport: () => void;
}

function OtherCampaignMapCard({ map, isImporting, isImported, onImport }: OtherCampaignMapCardProps) {
  const hasMusicConfig = map.musicConfig && Object.values(map.musicConfig).some(
    v => v && typeof v === 'object' && Object.keys(v).length > 0,
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {map.imageAvailable ? (
          <AuthImage
            src={getMapImageUrlSized(map.id, 'thumb')}
            alt={map.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onErrorIcon={<ImageIcon fontSize="medium" />}
          />
        ) : (
          <ImageIcon fontSize="medium" />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={map.name}>
            {map.name}
          </Typography>
          {hasMusicConfig && (
            <Tooltip title="Tiene música asociada">
              <MusicNoteIcon fontSize="small" color="action" />
            </Tooltip>
          )}
          {map.skylineAvailable && (
            <Tooltip title="Tiene skyline">
              <LandscapeIcon fontSize="small" color="action" />
            </Tooltip>
          )}
        </Stack>
        {map.group && map.group.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, flexWrap: 'wrap' }}>
            {map.group.map(g => (
              <Chip key={g} label={g} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
          {isImported ? (
            <Tooltip title="Importado">
              <CheckCircleIcon fontSize="small" color="success" />
            </Tooltip>
          ) : (
            <Tooltip title="Usar en campaña activa">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={onImport}
                  disabled={isImporting}
                >
                  {isImporting ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {isImported && (
            <Typography variant="caption" color="success.main">
              Importado
            </Typography>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
