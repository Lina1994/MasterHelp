import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Box, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { listSongsForCampaign, listPlaylists, PlaylistLite, SongLite } from '../../api/soundtrack';
import { listSfxPresets, SoundPresetLite } from '../../api/soundeffects';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'night';
type UiTimeOfDay = 'all' | TimeOfDay;

export type MusicConfig = Record<string, Record<string, { type: 'song' | 'playlist'; id: string }>>;
export type SfxConfig = Record<string, Record<string, { presetId: string }>>;

export interface AudioConfigEditorProps {
  value: { musicConfig?: MusicConfig; sfxConfig?: SfxConfig };
  onChange: (next: { musicConfig?: MusicConfig; sfxConfig?: SfxConfig }) => void;
  defaultTimeOfDay?: TimeOfDay | undefined;
}

const UI_TOD_OPTIONS: UiTimeOfDay[] = ['all', 'dawn', 'morning', 'afternoon', 'night'];
const ALL_TOD: TimeOfDay[] = ['dawn', 'morning', 'afternoon', 'night'];
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
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [presets, setPresets] = useState<SoundPresetLite[]>([]);
  const [selectedTod, setSelectedTod] = useState<UiTimeOfDay>((defaultTimeOfDay as UiTimeOfDay) || 'all');

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

  const BATTLE_KEYS = ['battleEasy', 'battleMedium', 'battleHard', 'battleDeadly'] as const;

  /**
   * Change music selection for a given time-of-day and situation. If the situation is a battle difficulty,
   * the same selection will be auto-applied to other battle difficulties that are currently unset.
   * Existing assignments are preserved and will not be overridden.
   */
  const changeMusic = (tod: UiTimeOfDay, situationKey: string, selection: { type: 'song' | 'playlist'; id: string } | null) => {
    if (tod === 'all') {
      let next = { ...(musicConfig || {}) } as MusicConfig;
      for (const t of ALL_TOD) {
        next = ensureMusicConfig(next, t);
        if (!selection) {
          if (next[t]) delete (next as any)[t][situationKey];
        } else {
          next[t][situationKey] = selection;
          // If applying for a battle difficulty, propagate to other difficulty slots that are unset
          if (BATTLE_KEYS.includes(situationKey as any)) {
            for (const k of BATTLE_KEYS) {
              if (k === situationKey) continue;
              if ((next as any)[t][k] === undefined) {
                (next as any)[t][k] = selection;
              }
            }
          }
        }
        if (next[t] && Object.keys(next[t]).length === 0) delete (next as any)[t];
      }
      onChange({ musicConfig: Object.keys(next).length ? next : undefined, sfxConfig });
      return;
    }
    const next = ensureMusicConfig(musicConfig, tod);
    if (!selection) {
      if (next[tod]) delete (next as any)[tod][situationKey];
    } else {
      next[tod][situationKey] = selection;
      // If applying for a battle difficulty, propagate to other difficulty slots that are unset
      if (BATTLE_KEYS.includes(situationKey as any)) {
        for (const k of BATTLE_KEYS) {
          if (k === situationKey) continue;
          if ((next as any)[tod][k] === undefined) {
            (next as any)[tod][k] = selection;
          }
        }
      }
    }
    if (next[tod] && Object.keys(next[tod]).length === 0) delete (next as any)[tod];
    onChange({ musicConfig: Object.keys(next).length ? next : undefined, sfxConfig });
  };

  /**
   * Change SFX preset for a given time-of-day and situation. If the situation is a battle difficulty,
   * the same preset will be auto-applied to other battle difficulties that are currently unset.
   * Existing assignments are preserved and will not be overridden.
   */
  const changeSfx = (tod: UiTimeOfDay, situationKey: string, presetId: string | null) => {
    if (tod === 'all') {
      let next = { ...(sfxConfig || {}) } as SfxConfig;
      for (const t of ALL_TOD) {
        next = ensureSfxConfig(next, t);
        if (!presetId) {
          if (next[t]) delete (next as any)[t][situationKey];
        } else {
          next[t][situationKey] = { presetId };
          // If applying for a battle difficulty, propagate to other difficulty slots that are unset
          if (BATTLE_KEYS.includes(situationKey as any)) {
            for (const k of BATTLE_KEYS) {
              if (k === situationKey) continue;
              if ((next as any)[t][k] === undefined) {
                (next as any)[t][k] = { presetId };
              }
            }
          }
        }
        if (next[t] && Object.keys(next[t]).length === 0) delete (next as any)[t];
      }
      onChange({ musicConfig, sfxConfig: Object.keys(next).length ? next : undefined });
      return;
    }
    const next = ensureSfxConfig(sfxConfig, tod);
    if (!presetId) {
      if (next[tod]) delete (next as any)[tod][situationKey];
    } else {
      next[tod][situationKey] = { presetId };
      // If applying for a battle difficulty, propagate to other difficulty slots that are unset
      if (BATTLE_KEYS.includes(situationKey as any)) {
        for (const k of BATTLE_KEYS) {
          if (k === situationKey) continue;
          if ((next as any)[tod][k] === undefined) {
            (next as any)[tod][k] = { presetId };
          }
        }
      }
    }
    if (next[tod] && Object.keys(next[tod]).length === 0) delete (next as any)[tod];
    onChange({ musicConfig, sfxConfig: Object.keys(next).length ? next : undefined });
  };

  const renderMusicSelect = (tod: UiTimeOfDay, situationKey: string) => {
    let currentSel: { type: 'song' | 'playlist'; id: string } | undefined;
    if (tod === 'all') {
      const vals = ALL_TOD.map(t => (musicConfig as any)[t]?.[situationKey] as { type: 'song' | 'playlist'; id: string } | undefined);
      const first = vals.find(v => v !== undefined);
      const allSame = first && vals.every(v => v && v.type === first.type && v.id === first.id);
      currentSel = allSame ? first : undefined;
    } else {
      currentSel = (musicConfig as any)[tod]?.[situationKey] as { type: 'song' | 'playlist'; id: string } | undefined;
    }
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

  const renderSfxSelect = (tod: UiTimeOfDay, situationKey: string) => {
    let current: { presetId: string } | undefined;
    if (tod === 'all') {
      const vals = ALL_TOD.map(t => (sfxConfig as any)[t]?.[situationKey] as { presetId: string } | undefined);
      const first = vals.find(v => v !== undefined);
      const allSame = first && vals.every(v => v && v.presetId === first.presetId);
      current = allSame ? first : undefined;
    } else {
      current = (sfxConfig as any)[tod]?.[situationKey] as { presetId: string } | undefined;
    }
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
          <InputLabel id="tod-label" shrink sx={{ pointerEvents: 'none' }}>{t('timeOfDayLabel', { defaultValue: 'Momento del día' })}</InputLabel>
          <Select
            labelId="tod-label"
            label={t('timeOfDayLabel', { defaultValue: 'Momento del día' })}
            value={selectedTod}
            onChange={(e) => setSelectedTod((e.target.value as UiTimeOfDay) || 'all')}
          >
            {UI_TOD_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt === 'all' ? t('timeOfDay.all') : t(`timeOfDay.${opt}`)}
              </MenuItem>
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
