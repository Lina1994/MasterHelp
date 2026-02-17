import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SendIcon from '@mui/icons-material/Send';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { ShopCell, uploadCellMedia, getCellStreamUrl } from '../../api/shops';
import { addSkylineItem, getSkylineItems, removeSkylineItem } from '../../api/campaigns/skylineItems';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';

interface MediaCellProps {
  cell: ShopCell | null;
  onUpdate: () => void;
}

export const MediaCell: React.FC<MediaCellProps> = ({ cell, onUpdate }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingToSkyline, setSendingToSkyline] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const { activeCampaign } = useActiveCampaign();
  const [skylineItemId, setSkylineItemId] = useState<string | null>(null);

  if (!cell) {
    return <Typography variant="caption" color="text.secondary">No disponible</Typography>;
  }

  if (!cell.column) {
    return <Typography variant="caption" color="text.secondary">Cargando...</Typography>;
  }

  const hasMedia = !!cell.mimeType;
  const cellType = cell.column.cellType;

  // Check if this cell is already in skyline
  useEffect(() => {
    if (!activeCampaign?.id || !cell?.id) {
      setSkylineItemId(null);
      return;
    }
    
    let cancelled = false;
    const checkSkylineStatus = async () => {
      try {
        const items = await getSkylineItems(activeCampaign.id);
        if (cancelled) return;
        const existingItem = items.find(item => item.cellId === cell.id);
        setSkylineItemId(existingItem?.id || null);
      } catch (err) {
        if (!cancelled) setSkylineItemId(null);
      }
    };
    
    checkSkylineStatus();
    return () => { cancelled = true; };
  }, [activeCampaign?.id, cell?.id]);

  // Listen to skyline updates from other windows and same window
  useEffect(() => {
    if (!activeCampaign?.id || !cell?.id) return;

    const checkAndUpdateSkylineStatus = async () => {
      try {
        const items = await getSkylineItems(activeCampaign.id);
        const existingItem = items.find(item => item.cellId === cell.id);
        setSkylineItemId(existingItem?.id || null);
      } catch {}
    };

    // Listen to storage events (cross-window)
    const handleStorageUpdate = async (e: StorageEvent) => {
      if (e.key !== 'app.skyline.itemsUpdated') return;
      try {
        const payload = e.newValue ? JSON.parse(e.newValue) : null;
        if (payload?.campaignId === activeCampaign.id) {
          await checkAndUpdateSkylineStatus();
        }
      } catch {}
    };

    // Listen to BroadcastChannel events (same window + cross-window)
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('campaign-sync');
      bc.onmessage = (event) => {
        if (event.data?.type === 'skylineItemsChanged' && event.data?.campaignId === activeCampaign.id) {
          checkAndUpdateSkylineStatus();
        }
      };
    }

    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      if (bc) bc.close();
    };
  }, [activeCampaign?.id, cell?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUrl(''); // Clear URL if file is selected
    }
  };

  const handleUpload = async () => {
    if (!file && !url.trim()) return;

    setUploading(true);
    try {
      const result = await uploadCellMedia(cell.entryId, cell.columnId, file || undefined, url || undefined);
      setDialogOpen(false);
      setFile(null);
      setUrl('');
      onUpdate();
    } catch (error: any) {
      console.error('Failed to upload media:', error);
      alert(error?.response?.data?.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleSendToSkyline = async () => {
    if (!cell || !activeCampaign?.id) return;
    setSendingToSkyline(true);
    try {
      if (skylineItemId) {
        // Remove from skyline
        await removeSkylineItem(skylineItemId);
        setSkylineItemId(null);
      } else {
        // Add to skyline
        const newItem = await addSkylineItem(activeCampaign.id, cell.id);
        setSkylineItemId(newItem.id);
      }
      
      // Notify other windows via BroadcastChannel
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'skylineItemsChanged', campaignId: activeCampaign.id });
        bc.close();
      }
      // Notify via localStorage for fallback
      try {
        localStorage.setItem('app.skyline.itemsUpdated', JSON.stringify({ campaignId: activeCampaign.id, at: Date.now() }));
      } catch {}
    } catch (error: any) {
      console.error('Failed to toggle skyline:', error);
      alert(error?.response?.data?.message || 'Error al gestionar Skyline');
    } finally {
      setSendingToSkyline(false);
    }
  };

  const renderPreview = () => {
    if (!hasMedia) return null;

    const streamUrl = getCellStreamUrl(cell.id);
    // Get token for authenticated streaming
    const token = localStorage.getItem('access_token');
    const fullUrl = `${streamUrl}?token=${token}`;

    switch (cellType) {
      case 'image':
      case 'gif':
        return (
          <Box
            component="img"
            src={fullUrl}
            alt="Cell media"
            sx={{ maxWidth: 100, maxHeight: 100, objectFit: 'contain' }}
          />
        );
      case 'video':
        return (
          <video
            controls
            style={{ maxWidth: 200, maxHeight: 100 }}
            src={fullUrl}
          />
        );
      case 'audio':
        return (
          <audio
            controls
            src={fullUrl}
          />
        );
      default:
        return <Typography variant="caption">Media ({cellType})</Typography>;
    }
  };

  const getIcon = () => {
    switch (cellType) {
      case 'image':
      case 'gif':
        return <ImageIcon fontSize="small" />;
      case 'video':
        return <VideoLibraryIcon fontSize="small" />;
      case 'audio':
        return <AudiotrackIcon fontSize="small" />;
      default:
        return <EditIcon fontSize="small" />;
    }
  };

  const getAcceptType = () => {
    switch (cellType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      case 'gif':
        return 'image/gif';
      default:
        return '*/*';
    }
  };

  return (
    <Box>
      {hasMedia ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {renderPreview()}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => setDialogOpen(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {(cellType === 'image' || cellType === 'gif') && activeCampaign?.id && (
              <Tooltip title={skylineItemId ? "Quitar de Skyline" : "Enviar a Skyline"}>
                <IconButton 
                  size="small" 
                  onClick={handleSendToSkyline}
                  disabled={sendingToSkyline}
                  color={skylineItemId ? "warning" : "primary"}
                >
                  {skylineItemId ? <RemoveCircleIcon fontSize="small" /> : <SendIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      ) : (
        <Button
          size="small"
          startIcon={getIcon()}
          onClick={() => setDialogOpen(true)}
          variant="outlined"
        >
          Subir
        </Button>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Subir {cellType}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Desde archivo:
              </Typography>
              <input
                type="file"
                accept={getAcceptType()}
                onChange={handleFileChange}
                style={{ display: 'block' }}
              />
              {file && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Archivo seleccionado: {file.name}
                </Typography>
              )}
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                O desde URL:
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="https://ejemplo.com/archivo.jpg"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setFile(null); // Clear file if URL is entered
                }}
                disabled={!!file}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={uploading || (!file && !url.trim())}
          >
            {uploading ? 'Subiendo...' : 'Subir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
