import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { listSongsForCampaign, listPlaylists, type SongLite, type PlaylistLite } from '../../api/soundtrack';
import type { SoundEffectMeta, SoundPresetMeta } from '../../types/soundEffects';
import type { SoundSourceType } from '../../api/mapElements';
import { api } from '../../apiBase';
import { getAuthHeaders } from '../../utils/auth';

/**
 * Result returned when the user selects a sound source.
 */
export interface SoundSourceSelection {
  sourceType: SoundSourceType;
  sourceId: string;
  sourceName: string;
}

/**
 * Props for the SoundSourcePickerDialog.
 */
interface SoundSourcePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: SoundSourceSelection) => void;
  campaignId: string;
  currentSourceType?: SoundSourceType;
  currentSourceId?: string;
}

/**
 * SoundSourcePickerDialog
 *
 * Modal dialog that allows the DM to select a soundtrack source (song,
 * playlist, sound effect, or preset) to assign to a map sound-source element.
 *
 * @param open          Whether the dialog is visible.
 * @param onClose       Close callback.
 * @param onSelect      Selection callback — returns the chosen source.
 * @param campaignId    Active campaign UUID for fetching data.
 * @param currentSourceType  Currently assigned source type (for highlighting).
 * @param currentSourceId    Currently assigned source id (for highlighting).
 */
const SoundSourcePickerDialog: React.FC<SoundSourcePickerDialogProps> = ({
  open,
  onClose,
  onSelect,
  campaignId,
  currentSourceType,
  currentSourceId,
}) => {
  const [tab, setTab] = useState(0);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [effects, setEffects] = useState<SoundEffectMeta[]>([]);
  const [presets, setPresets] = useState<SoundPresetMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [songsRes, playlistsRes, effectsRes, presetsRes] = await Promise.all([
          listSongsForCampaign(campaignId),
          listPlaylists(campaignId),
          api.get<{ associated: SoundEffectMeta[]; reusable: SoundEffectMeta[] }>(
            `/soundtrack/effects/campaigns/${campaignId}`,
            { headers: getAuthHeaders() },
          ),
          api.get<SoundPresetMeta[]>(
            `/soundtrack/presets/campaigns/${campaignId}`,
            { headers: getAuthHeaders() },
          ),
        ]);
        if (cancelled) return;
        setSongs([...(songsRes.associated || []), ...(songsRes.reusable || [])]);
        setPlaylists(playlistsRes || []);
        const efData = effectsRes.data;
        setEffects([...(efData?.associated || []), ...(efData?.reusable || [])]);
        setPresets(presetsRes.data || []);
      } catch {
        /* non-critical — empty lists will simply be shown */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, campaignId]);

  const handleSelect = (sourceType: SoundSourceType, sourceId: string, sourceName: string) => {
    onSelect({ sourceType, sourceId, sourceName });
    onClose();
  };

  const isSelected = (type: SoundSourceType, id: string) =>
    currentSourceType === type && currentSourceId === id;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Seleccionar fuente de audio</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 300 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Canciones (${songs.length})`} />
          <Tab label={`Playlists (${playlists.length})`} />
          <Tab label={`Efectos (${effects.length})`} />
          <Tab label={`Presets (${presets.length})`} />
        </Tabs>

        {loading && (
          <Typography sx={{ mt: 2 }} color="text.secondary">Cargando…</Typography>
        )}

        {/* Songs */}
        {tab === 0 && !loading && (
          <List dense>
            {songs.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No hay canciones disponibles.
              </Typography>
            )}
            {songs.map((s) => (
              <ListItemButton
                key={s.id}
                selected={isSelected('song', s.id)}
                onClick={() => handleSelect('song', s.id, s.name)}
              >
                <ListItemText
                  primary={s.name}
                  secondary={[s.artist, s.album, s.atmosphere].filter(Boolean).join(' · ') || undefined}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {/* Playlists */}
        {tab === 1 && !loading && (
          <List dense>
            {playlists.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No hay playlists disponibles.
              </Typography>
            )}
            {playlists.map((p) => (
              <ListItemButton
                key={p.id}
                selected={isSelected('playlist', p.id)}
                onClick={() => handleSelect('playlist', p.id, p.name)}
              >
                <ListItemText
                  primary={p.name}
                  secondary={p.songs ? `${p.songs.length} canciones` : undefined}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {/* Sound Effects */}
        {tab === 2 && !loading && (
          <List dense>
            {effects.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No hay efectos de sonido disponibles.
              </Typography>
            )}
            {effects.map((ef) => (
              <ListItemButton
                key={ef.id}
                selected={isSelected('effect', ef.id)}
                onClick={() => handleSelect('effect', ef.id, ef.name)}
              >
                <ListItemText
                  primary={ef.name}
                  secondary={ef.category || undefined}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {/* Presets */}
        {tab === 3 && !loading && (
          <List dense>
            {presets.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No hay presets disponibles.
              </Typography>
            )}
            {presets.map((pr) => (
              <ListItemButton
                key={pr.id}
                selected={isSelected('preset', pr.id)}
                onClick={() => handleSelect('preset', pr.id, pr.name)}
              >
                <ListItemText
                  primary={pr.name}
                  secondary={`${pr.items?.length ?? 0} efectos`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SoundSourcePickerDialog;
