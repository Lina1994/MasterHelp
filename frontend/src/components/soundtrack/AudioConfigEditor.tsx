import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { listSongsForCampaign, listPlaylists, PlaylistLite, SongLite } from '../../api/soundtrack';
import { listSfxPresets, SoundPresetLite } from '../../api/soundeffects';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'night';

export type MusicConfig = Record<string, Record<string, { type: 'song' | 'playlist'; id: string }>>;
export type SfxConfig = Record<string, Record<string, { presetId: string }>>;

export interface AudioConfigEditorProps {
  value: { musicConfig?: MusicConfig; sfxConfig?: SfxConfig };
  onChange: (next: { musicConfig?: MusicConfig; sfxConfig?: SfxConfig }) => void;
  defaultTimeOfDay?: TimeOfDay | undefined;
}

const timeOfDayOptions: (TimeOfDay | '')[] = ['', 'dawn', 'morning', 'afternoon', 'night'];
const situations = [
  { key: 'base', label: 'Base' },
  { key: 'battleEasy', label: 'Batalla (Fácil)' },
  { key: 'battleMedium', label: 'Batalla (Media)' },
  { key: 'battleHard', label: 'Batalla (Difícil)' },
  { key: 'battleDeadly', label: 'Batalla (Letal)' },
];

function ensureMusicConfig(cfg: MusicConfig | undefined, tod: string): MusicConfig {
  const next: MusicConfig = { ...(cfg || {}) };
  if (!next[tod]) next[tod] = {} as any;
  return next;
}

function ensureSfxConfig(cfg: SfxConfig | undefined, tod: string): SfxConfig {
  const next: SfxConfig = { ...(cfg || {}) };
  if (!next[tod]) next[tod] = {} as any;
  return next;
}

export const AudioConfigEditor: React.FC<AudioConfigEditorProps> = ({ value, onChange, defaultTimeOfDay }) => {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [presets, setPresets] = useState<SoundPresetLite[]>([]);
  const [selectedTod, setSelectedTod] = useState<TimeOfDay | ''>(defaultTimeOfDay || '');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!campaignId) return;
      const [{ associated, reusable }, pls, pzs] = await Promise.all([
        listSongsForCampaign(campaignId),
        listPlaylists(campaignId),
        listSfxPresets(campaignId),
      ]);
      if (!mounted) return;
      setSongs([...(associated || []), ...(reusable || [])]);
      setPlaylists(pls || []);
      setPresets(pzs || []);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  const musicConfig = value.musicConfig || {};
  const sfxConfig = value.sfxConfig || {};
  
  const combinedSongOptions = useMemo(() => songs, [songs]);

  type MusicOption = { type: 'playlist' | 'song'; id: string; label: string; group: 'Playlists' | 'Canciones' };
  const musicOptions: MusicOption[] = useMemo(() => (
    [
      ...playlists.map(pl => ({ type: 'playlist' as const, id: pl.id, label: pl.name, group: 'Playlists' as const })),
      ...combinedSongOptions.map(sg => ({ type: 'song' as const, id: sg.id, label: sg.name, group: 'Canciones' as const })),
    ]
  ), [playlists, combinedSongOptions]);
  
  type PresetOption = { id: string; label: string };
  const presetOptions: PresetOption[] = useMemo(() => presets.map(p => ({ id: p.id, label: p.name })), [presets]);

  const changeMusic = (tod: string, situationKey: string, selection: { type: 'song' | 'playlist'; id: string } | null) => {
    const next = ensureMusicConfig(musicConfig, tod);
    if (!selection) {
      if (next[tod]) delete (next as any)[tod][situationKey];
    } else {
      next[tod][situationKey] = selection;
    }
    // Clean empty situation map
    if (next[tod] && Object.keys(next[tod]).length === 0) delete (next as any)[tod];
    onChange({ musicConfig: Object.keys(next).length ? next : undefined, sfxConfig });
  };

  const changeSfx = (tod: string, situationKey: string, presetId: string | null) => {
    const next = ensureSfxConfig(sfxConfig, tod);
    if (!presetId) {
      if (next[tod]) delete (next as any)[tod][situationKey];
    } else {
      next[tod][situationKey] = { presetId };
    }
    if (next[tod] && Object.keys(next[tod]).length === 0) delete (next as any)[tod];
    onChange({ musicConfig, sfxConfig: Object.keys(next).length ? next : undefined });
  };

  const renderMusicSelect = (tod: string, situationKey: string) => {

    const currentSel = (musicConfig as any)[tod]?.[situationKey] as { type: 'song' | 'playlist'; id: string } | undefined;
    const value = currentSel ? musicOptions.find((o) => o.type === currentSel.type && o.id === currentSel.id) || null : null;

    return (
      <Autocomplete
        fullWidth
        size="small"
        options={musicOptions}
        value={value}
        onChange={(_, opt) => {
          if (!opt) return changeMusic(tod, situationKey, null);
          return changeMusic(tod, situationKey, { type: opt.type, id: opt.id });
        }}
        groupBy={(opt) => opt.group}
        getOptionLabel={(opt) => opt.label}
        isOptionEqualToValue={(o, v) => o.type === v.type && o.id === v.id}
        renderInput={(params) => (
          <TextField {...params} label="Música" placeholder="(ninguna)" />
        )}
      />
    );
  };

  const renderSfxSelect = (tod: string, situationKey: string) => {
    const current = (sfxConfig as any)[tod]?.[situationKey] as { presetId: string } | undefined;
    const value = current ? presetOptions.find((o) => o.id === current.presetId) || null : null;
    return (
      <Autocomplete
        fullWidth
        size="small"
        options={presetOptions}
        value={value}
        onChange={(_, opt) => {
          if (!opt) return changeSfx(tod, situationKey, null);
          return changeSfx(tod, situationKey, opt.id);
        }}
        getOptionLabel={(opt) => opt.label}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={(params) => (
          <TextField {...params} label="Preset SFX" placeholder="(ninguno)" />
        )}
      />
    );
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Audio por momento y situación</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="tod-label" shrink sx={{ pointerEvents: 'none' }}>Momento del día</InputLabel>
          <Select
            labelId="tod-label"
            label="Momento del día"
            value={selectedTod}
            onChange={(e) => setSelectedTod((e.target.value || '') as TimeOfDay | '')}
          >
            {timeOfDayOptions.map((opt) => (
              <MenuItem key={opt || 'none'} value={opt || ''}>{opt || '(no específico)'}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {selectedTod ? (
        <Stack spacing={2}>
          {situations.map((s) => (
            <Box key={s.key}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{s.label}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {renderMusicSelect(selectedTod, s.key)}
                {renderSfxSelect(selectedTod, s.key)}
              </Stack>
              <Divider sx={{ mt: 2 }} />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">Selecciona un momento del día para configurar música y efectos.</Typography>
      )}
    </Box>
  );
};

export default AudioConfigEditor;
