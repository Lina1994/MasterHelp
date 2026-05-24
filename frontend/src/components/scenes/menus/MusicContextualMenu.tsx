import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';
import { listSongsForCampaign, listPlaylists, type PlaylistLite, type SongLite } from '../../../api/soundtrack';
import type { SoundEffectMeta, SoundPresetMeta } from '../../../types/soundEffects';
import { api } from '../../../apiBase';
import { getAuthHeaders } from '../../../utils/auth';
import type { SoundSourceSelection } from '../../Map/SoundSourcePickerDialog';
import type { SoundSourceType } from '../../../api/mapElements';
import { useTranslation } from 'react-i18next';

interface MusicContextualMenuProps {
  campaignId: string;
  onSelect: (selection: SoundSourceSelection) => void;
  onClose: () => void;
}

export const MusicContextualMenu: React.FC<MusicContextualMenuProps> = ({ campaignId, onSelect, onClose }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [effects, setEffects] = useState<SoundEffectMeta[]>([]);
  const [presets, setPresets] = useState<SoundPresetMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSongs = useMemo(() => {
    if (!normalizedQuery) return songs;
    return songs.filter((song) => {
      const haystack = [song.name, song.artist, song.album, song.atmosphere]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [songs, normalizedQuery]);

  const filteredPlaylists = useMemo(() => {
    if (!normalizedQuery) return playlists;
    return playlists.filter((playlist) => playlist.name.toLowerCase().includes(normalizedQuery));
  }, [playlists, normalizedQuery]);

  const filteredEffects = useMemo(() => {
    if (!normalizedQuery) return effects;
    return effects.filter((effect) => {
      const haystack = [effect.name, effect.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [effects, normalizedQuery]);

  const filteredPresets = useMemo(() => {
    if (!normalizedQuery) return presets;
    return presets.filter((preset) => preset.name.toLowerCase().includes(normalizedQuery));
  }, [presets, normalizedQuery]);

  useEffect(() => {
    if (!campaignId) return;
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
        // Non-blocking: keep empty collections.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleSelect = (sourceType: SoundSourceType, sourceId: string, sourceName: string) => {
    onSelect({ sourceType, sourceId, sourceName });
    onClose();
  };

  return (
    <ContextualMenuBase title={t('scene_tools_menu_audio_title', 'Seleccionar fuente de audio')} onClose={onClose}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label={t('scene_tools_menu_songs_count', { count: filteredSongs.length, defaultValue: `Canciones (${filteredSongs.length})` })} />
        <Tab label={t('scene_tools_menu_playlists_count', { count: filteredPlaylists.length, defaultValue: `Playlists (${filteredPlaylists.length})` })} />
        <Tab label={t('scene_tools_menu_effects_count', { count: filteredEffects.length, defaultValue: `Efectos (${filteredEffects.length})` })} />
        <Tab label={t('scene_tools_menu_presets_count', { count: filteredPresets.length, defaultValue: `Presets (${filteredPresets.length})` })} />
      </Tabs>

      <TextField
        size="small"
        fullWidth
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t('scene_tools_menu_search_placeholder', 'Buscar en audio...')}
        sx={{ mt: 1 }}
      />

      {loading && (
        <Typography sx={{ mt: 1.5 }} color="text.secondary" variant="caption">
          {t('scene_tools_menu_loading', 'Cargando...')}
        </Typography>
      )}

      <Box sx={{ mt: 1, minHeight: 320, maxHeight: 'min(56vh, 520px)', overflowY: 'auto' }}>
        {tab === 0 && !loading && (
          <List dense>
            {filteredSongs.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                {t('scene_tools_menu_no_results', 'No hay resultados para la búsqueda actual.')}
              </Typography>
            )}
            {filteredSongs.map((song) => (
              <ListItemButton key={song.id} onClick={() => handleSelect('song', song.id, song.name)}>
                <ListItemText
                  primary={song.name}
                  secondary={[song.artist, song.album, song.atmosphere].filter(Boolean).join(' · ') || undefined}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {tab === 1 && !loading && (
          <List dense>
            {filteredPlaylists.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                {t('scene_tools_menu_no_results', 'No hay resultados para la búsqueda actual.')}
              </Typography>
            )}
            {filteredPlaylists.map((playlist) => (
              <ListItemButton key={playlist.id} onClick={() => handleSelect('playlist', playlist.id, playlist.name)}>
                <ListItemText
                  primary={playlist.name}
                  secondary={playlist.songs ? t('scene_tools_menu_songs_n', { count: playlist.songs.length, defaultValue: `${playlist.songs.length} canciones` }) : undefined}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {tab === 2 && !loading && (
          <List dense>
            {filteredEffects.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                {t('scene_tools_menu_no_results', 'No hay resultados para la búsqueda actual.')}
              </Typography>
            )}
            {filteredEffects.map((effect) => (
              <ListItemButton key={effect.id} onClick={() => handleSelect('effect', effect.id, effect.name)}>
                <ListItemText primary={effect.name} secondary={effect.category || undefined} />
              </ListItemButton>
            ))}
          </List>
        )}

        {tab === 3 && !loading && (
          <List dense>
            {filteredPresets.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.25 }}>
                {t('scene_tools_menu_no_results', 'No hay resultados para la búsqueda actual.')}
              </Typography>
            )}
            {filteredPresets.map((preset) => (
              <ListItemButton key={preset.id} onClick={() => handleSelect('preset', preset.id, preset.name)}>
                <ListItemText
                  primary={preset.name}
                  secondary={t('scene_tools_menu_effects_n', { count: preset.items?.length ?? 0, defaultValue: `${preset.items?.length ?? 0} efectos` })}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </ContextualMenuBase>
  );
};
