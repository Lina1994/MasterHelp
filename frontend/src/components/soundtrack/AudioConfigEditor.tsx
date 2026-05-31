import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Box, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
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
  mode?: 'basic' | 'advanced';
}

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

function sameMusicSelection(left: { type: 'song' | 'playlist'; id: string } | null, right: { type: 'song' | 'playlist'; id: string } | null) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.type === right.type && left.id === right.id;
}

function resolveUniformMusicConfig(config: MusicConfig | undefined) {
  let resolved: { type: 'song' | 'playlist'; id: string } | null = null;
  for (const tod of ALL_TOD) {
    for (const situation of situations) {
      const current = (config as any)?.[tod]?.[situation.key] as { type: 'song' | 'playlist'; id: string } | undefined;
      if (!sameMusicSelection(resolved, current ?? null)) {
        if (resolved !== null || current) return { value: null, mixed: true };
      }
      if (!resolved && current) resolved = current;
      if (resolved && !current) return { value: null, mixed: true };
    }
  }
  return { value: resolved, mixed: false };
}

function resolveUniformSfxConfig(config: SfxConfig | undefined) {
  let resolved: { presetId: string } | null = null;
  for (const tod of ALL_TOD) {
    for (const situation of situations) {
      const current = (config as any)?.[tod]?.[situation.key] as { presetId: string } | undefined;
      if ((resolved?.presetId ?? null) !== (current?.presetId ?? null)) {
        if (resolved !== null || current) return { value: null, mixed: true };
      }
      if (!resolved && current) resolved = current;
      if (resolved && !current) return { value: null, mixed: true };
    }
  }
  return { value: resolved, mixed: false };
}

function buildGlobalMusicConfig(selection: { type: 'song' | 'playlist'; id: string } | null): MusicConfig | undefined {
  if (!selection) return undefined;
  return Object.fromEntries(
    ALL_TOD.map((tod) => [tod, Object.fromEntries(situations.map((situation) => [situation.key, selection]))]),
  ) as MusicConfig;
}

function buildGlobalSfxConfig(selection: { presetId: string } | null): SfxConfig | undefined {
  if (!selection) return undefined;
  return Object.fromEntries(
    ALL_TOD.map((tod) => [tod, Object.fromEntries(situations.map((situation) => [situation.key, selection]))]),
  ) as SfxConfig;
}

export const AudioConfigEditor: React.FC<AudioConfigEditorProps> = ({ value, onChange, mode = 'advanced' }) => {
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id;
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [presets, setPresets] = useState<SoundPresetLite[]>([]);

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
  const changeMusic = (tod: TimeOfDay, situationKey: string, selection: { type: 'song' | 'playlist'; id: string } | null) => {
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
  const changeSfx = (tod: TimeOfDay, situationKey: string, presetId: string | null) => {
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

  const renderMusicSelect = (tod: TimeOfDay, situationKey: string) => {
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

  const renderSfxSelect = (tod: TimeOfDay, situationKey: string) => {
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

  const globalMusic = useMemo(() => resolveUniformMusicConfig(value.musicConfig), [value.musicConfig]);
  const globalSfx = useMemo(() => resolveUniformSfxConfig(value.sfxConfig), [value.sfxConfig]);

  if (mode === 'basic') {
    const musicValue = globalMusic.value ? musicOptions.find((option) => option.type === globalMusic.value?.type && option.id === globalMusic.value?.id) || null : null;
    const sfxValue = globalSfx.value ? presetOptions.find((option) => option.id === globalSfx.value?.presetId) || null : null;

    return (
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Audio global del mapa</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            fullWidth
            size="small"
            options={musicOptions}
            value={musicValue}
            onChange={(_, option) => onChange({
              musicConfig: buildGlobalMusicConfig(option ? { type: option.type, id: option.id } : null),
              sfxConfig: value.sfxConfig,
            })}
            groupBy={(option) => option.group}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(left, right) => left.type === right.type && left.id === right.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Musica para todo el mapa"
                placeholder="(ninguna)"
                helperText={globalMusic.mixed ? 'Este mapa ya tiene musica distinta por momento y/o situacion. Si eliges una opcion aqui, se sobrescribira todo.' : 'Se aplicara a todos los momentos y situaciones del mapa.'}
              />
            )}
          />
          <Autocomplete
            fullWidth
            size="small"
            options={presetOptions}
            value={sfxValue}
            onChange={(_, option) => onChange({
              musicConfig: value.musicConfig,
              sfxConfig: buildGlobalSfxConfig(option ? { presetId: option.id } : null),
            })}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(left, right) => left.id === right.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="SFX para todo el mapa"
                placeholder="(ninguno)"
                helperText={globalSfx.mixed ? 'Este mapa ya tiene SFX distintos por momento y/o situacion. Si eliges una opcion aqui, se sobrescribira todo.' : 'Se aplicara a todos los momentos y situaciones del mapa.'}
              />
            )}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Audio por momento y situación</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 150, fontWeight: 'bold', bgcolor: 'background.default' }}>
                Situación
              </TableCell>
              {ALL_TOD.map((tod) => (
                <TableCell key={tod} align="center" sx={{ fontWeight: 'bold', bgcolor: 'background.default', whiteSpace: 'nowrap' }}>
                  {t(`timeOfDay.${tod}`)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {situations.map((s) => (
              <TableRow key={s.key}>
                <TableCell component="th" scope="row" sx={{ verticalAlign: 'middle' }}>
                  <Typography variant="body2" fontWeight={500}>{s.label}</Typography>
                </TableCell>
                {ALL_TOD.map((tod) => (
                  <TableCell key={tod} sx={{ verticalAlign: 'top', py: 1, px: 1 }}>
                    <Stack spacing={1}>
                      {renderMusicSelect(tod, s.key)}
                      {renderSfxSelect(tod, s.key)}
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AudioConfigEditor;
