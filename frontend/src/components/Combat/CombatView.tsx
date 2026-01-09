import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Box,
  LinearProgress,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import ImageIcon from '@mui/icons-material/Image';
import CasinoIcon from '@mui/icons-material/Casino';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OutboundIcon from '@mui/icons-material/Outbound';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AuthImage from '../../components/common/AuthImage';
import ProjectedMapMirror from '../../components/Map/ProjectedMapMirror';
import { useActiveEncounter } from '../../components/Encounter/ActiveEncounterContext';
import { useActiveMap } from '../../components/Map/ActiveMapContext';
import { listMaps, MapItemDto, getMapImageUrlSized } from '../../api/maps';
import { useGlobalPlayer } from '../../components/player/GlobalPlayerContext';
import { api } from '../../apiBase';
import { getAuthHeaders } from '../../utils/auth';
import { useEncounterAudio } from '../../hooks/useEncounterAudio';
import { useBattleState } from '../../hooks/useBattleState';
import { useTurnOrder } from '../../hooks/useTurnOrder';
import { rollEnemyInitiative as rollEnemyInitiativeUtil, rollAllEnemiesInitiative as rollAllEnemiesInitiativeUtil } from '../../utils/initiative';
import { rollAllEnemiesHp as rollAllEnemiesHpUtil } from '../../utils/hpRoll';
import { fetchMonster } from '../../api/monsters';
import { updateCharacter } from '../../api/characters';
import { EncounterSummary, EncounterDifficulty, updateEncounter as apiUpdateEncounter } from '../../api/encounters';
import { SongLite } from '../../api/soundtrack';
import { CharacterPayload } from '../../api/characters';
import { MonsterIndexItem } from '../../types/monsters';
import { Campaign } from '../../components/Campaign/types';
import GotoMapsButton from './GotoMapsButton';

/**
 * CombatView: vista de combate con selección de mapa/encuentro,
 * controles de música y gestión de participantes (HP, iniciativa).
 * Mantiene la API de props usada por CombatPage para evitar regresiones.
 */
export interface CombatViewProps {
  encounters: EncounterSummary[];
  isMaster: boolean;
  campaign: Campaign;
  songs: SongLite[];
  onUpdateEncounter: (enc: EncounterSummary) => void;
  characters: CharacterPayload[];
  onPatchCharacterLocal: (id: string, patch: Partial<CharacterPayload>) => void;
  monsters: Array<MonsterIndexItem & { manualId: string; compositeId: string }>;
}

const difficultyColor: Record<EncounterDifficulty, 'default' | 'success' | 'warning' | 'error'> = {
  'Fácil': 'success',
  'Medio': 'default',
  'Difícil': 'warning',
  'Mortal': 'error',
};

export default function CombatView({ encounters, isMaster, campaign, songs, onUpdateEncounter, characters, onPatchCharacterLocal, monsters }: CombatViewProps) {
  const { play, current, stop } = useGlobalPlayer();
  const { activeEncounterId, setActiveEncounterId } = useActiveEncounter();
  const [selectedMapName, setSelectedMapName] = useState<string>('Mapa activo');
  const [prioritizeEncounterMusic, setPrioritizeEncounterMusic] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [participantsDraft, setParticipantsDraft] = useState<EncounterSummary['participants']>([]);
  const [savingInitiative, setSavingInitiative] = useState<Record<string, boolean>>({});
  const [savingHp, setSavingHp] = useState<Record<string, boolean>>({});
  const { activeMapId, setActiveMapId } = useActiveMap();
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const { battleStarted, setBattleStarted, hydrated } = useBattleState(campaign?.id, activeEncounterId);
  const [prevTrack, setPrevTrack] = useState<{ id: string; name: string; size?: number; mimeType?: string } | null>(null);
  const participantsRef = React.useRef<EncounterSummary['participants']>([]);
  const turnAlignedRef = React.useRef<boolean>(false);
  const charMap = useMemo(() => {
    const map = new Map<string, CharacterPayload>();
    (characters || []).forEach((c) => { if (c.id) map.set(c.id, c); });
    return map;
  }, [characters]);

  const selectedEncounter = useMemo(() => encounters.find((e) => e.id === activeEncounterId) || null, [encounters, activeEncounterId]);
  const handleSelectEncounter = useCallback((id: string) => {
    setActiveEncounterId(id);
  }, [setActiveEncounterId]);
  const orderedParticipants = useMemo(() => {
    const base = participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || []);
    const list = base.filter((p) => typeof p.initiative === 'number' && !Number.isNaN(p.initiative as any));
    return list.sort((a, b) => (b.initiative! - a.initiative!));
  }, [selectedEncounter, participantsDraft]);

  const sessionKey = useMemo(() => {
    const cid = campaign?.id;
    return cid && activeEncounterId ? `${cid}:${activeEncounterId}` : null;
  }, [campaign?.id, activeEncounterId]);
  const { round, index: turnIndex, currentId: currentTurnId, hydrated: turnHydrated, nextTurn: nextTurnHook, previousTurn: previousTurnHook, resetToStart } = useTurnOrder(sessionKey, orderedParticipants);

  const baseParticipants = useMemo(() => (participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || [])), [participantsDraft, selectedEncounter]);
  const allies = useMemo(() => baseParticipants.filter((p) => p.role !== 'foe'), [baseParticipants]);
  const foes = useMemo(() => baseParticipants.filter((p) => p.role === 'foe'), [baseParticipants]);

  function indexToLetters(idx: number): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let n = idx;
    let out = '';
    do {
      out = letters[n % 26] + out;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return out;
  }

  const enemyDisplayNameById = useMemo(() => {
    const map: Record<string, string> = {};
    const groups = new Map<string, EncounterSummary['participants'][number][]>();
    foes.forEach((p) => {
      const key = (p.name || '').trim().toLowerCase();
      const arr = groups.get(key) || [];
      arr.push(p);
      groups.set(key, arr);
    });
    groups.forEach((arr) => {
      if (arr.length <= 1) {
        const only = arr[0];
        if (only) map[only.id] = only.name;
      } else {
        arr.forEach((p, idx) => { map[p.id] = `${p.name} ${indexToLetters(idx)}`; });
      }
    });
    return map;
  }, [foes]);

  useEffect(() => {
    setParticipantsDraft(selectedEncounter?.participants || []);
  }, [selectedEncounter?.id]);

  useEffect(() => {
    const cid = campaign?.id;
    let cancelled = false;
    (async () => {
      if (!cid) { setMaps([]); setSelectedMapName('Mapa activo'); return; }
      try {
        const data = await listMaps({ campaignId: cid });
        if (!cancelled) setMaps(data || []);
      } catch { if (!cancelled) setMaps([]); }
    })();
    return () => { cancelled = true; };
  }, [campaign?.id]);

  useEffect(() => {
    const current = maps.find(m => m.id === activeMapId);
    setSelectedMapName(current?.name || 'Mapa activo');
  }, [activeMapId, maps]);

  useEffect(() => {
    participantsRef.current = participantsDraft;
  }, [participantsDraft]);

  const setInitiativeLocal = useCallback((pid: string, value: number | undefined) => {
    setParticipantsDraft((prev) => prev.map((p) => (p.id === pid ? { ...p, initiative: typeof value === 'number' && !Number.isNaN(value) ? value : undefined } : p)));
  }, []);

  const setHpLocal = useCallback((pid: string, field: 'currentHp' | 'maxHp', value: number | undefined) => {
    setParticipantsDraft((prev) => prev.map((p) => (p.id === pid ? { ...p, [field]: typeof value === 'number' && !Number.isNaN(value) ? value : undefined } : p)));
  }, []);

  const updateCharacterHp = useCallback(async (pid: string, patch: { currentHp?: number; tempHp?: number }) => {
    try {
      setSavingHp((s) => ({ ...s, [pid]: true }));
      await updateCharacter(pid, patch);
      onPatchCharacterLocal(pid, patch as any);
    } finally {
      setSavingHp((s) => ({ ...s, [pid]: false }));
    }
  }, [onPatchCharacterLocal]);

  const persistParticipants = useCallback(async () => {
    if (!selectedEncounter || !campaign?.id) return;
    const payload = { participants: (participantsRef.current || []).map((p) => ({ ...p })) };
    try {
      const saved = await apiUpdateEncounter(campaign.id, selectedEncounter.id, payload as any);
      onUpdateEncounter(saved);
      setParticipantsDraft(saved.participants || []);
    } catch (e) {
      // silent
    }
  }, [campaign?.id, selectedEncounter?.id, onUpdateEncounter]);

  const pendingSaveTimers = React.useRef<Record<string, any>>({});
  const schedulePersistInitiative = useCallback((pid: string) => {
    const existing = pendingSaveTimers.current[pid];
    if (existing) clearTimeout(existing);
    setSavingInitiative((s) => ({ ...s, [pid]: true }));
    pendingSaveTimers.current[pid] = setTimeout(async () => {
      try { await persistParticipants(); } finally {
        setSavingInitiative((s) => ({ ...s, [pid]: false }));
        delete pendingSaveTimers.current[pid];
      }
    }, 400);
  }, [persistParticipants]);

  const setHp = useCallback((p: EncounterSummary['participants'][number], kind: 'currentHp' | 'tempHp', value: number | undefined) => {
    if (p.kind === 'character' && p.id) {
      const payload: any = {};
      if (kind === 'currentHp') payload.currentHp = value;
      if (kind === 'tempHp') payload.tempHp = value;
      updateCharacterHp(p.id, payload);
    } else {
      if (kind === 'currentHp') setHpLocal(p.id, 'currentHp', value);
      schedulePersistInitiative(p.id);
    }
  }, [setHpLocal, schedulePersistInitiative, updateCharacterHp]);

  const findSong = useCallback((songId?: string) => songs.find((s) => s.id === songId), [songs]);
  const { buildSongStreamEndpoint } = useEncounterAudio(campaign?.id);

  const rollEnemyInitiative = useCallback(async (pid: string) => {
    await rollEnemyInitiativeUtil(pid, participantsDraft, fetchMonster, setInitiativeLocal, schedulePersistInitiative);
  }, [participantsDraft, schedulePersistInitiative]);

  const rollAllEnemiesInitiative = useCallback(async () => {
    await rollAllEnemiesInitiativeUtil(foes, fetchMonster, setInitiativeLocal, schedulePersistInitiative);
  }, [foes, schedulePersistInitiative, setInitiativeLocal]);

  const rollAllEnemiesHp = useCallback(async (mode: 'avg' | 'dice') => {
    await rollAllEnemiesHpUtil(mode, foes, monsters, fetchMonster, setHpLocal, schedulePersistInitiative);
  }, [foes, schedulePersistInitiative, setHpLocal, monsters]);

  const handleStartBattle = useCallback(async () => {
    resetToStart();
    setBattleStarted(true);
    if (current) {
      setPrevTrack({ id: current.id, name: current.name, size: current.size, mimeType: current.mimeType });
    } else {
      setPrevTrack(null);
    }
    if (!selectedEncounter || !prioritizeEncounterMusic) return;
    const songId = selectedEncounter.musicSongId;
    const meta = songId ? findSong(songId) : undefined;
    if (!songId || !meta) return;
    await play(
      { id: songId, name: meta.name, mimeType: meta.mimeType, size: meta.size },
      async () => {
        const res = await api.get(buildSongStreamEndpoint(songId), { headers: getAuthHeaders(), responseType: 'blob' });
        return URL.createObjectURL(res.data as Blob);
      },
    );
  }, [selectedEncounter, prioritizeEncounterMusic, findSong, play, buildSongStreamEndpoint]);

  const endBattle = useCallback(async () => {
    setBattleStarted(false);
    resetToStart();
    if (prevTrack) {
      try {
        await play(
          { id: prevTrack.id, name: prevTrack.name, mimeType: prevTrack.mimeType, size: prevTrack.size },
          async () => {
            const res = await api.get(buildSongStreamEndpoint(prevTrack.id), { headers: getAuthHeaders(), responseType: 'blob' });
            return URL.createObjectURL(res.data as Blob);
          },
        );
      } catch {
        stop();
      }
    } else {
      stop();
    }
  }, [prevTrack, play, stop, buildSongStreamEndpoint]);

  const nextTurn = useCallback(() => {
    nextTurnHook();
  }, [nextTurnHook]);

  const previousTurn = useCallback(() => {
    previousTurnHook();
  }, [previousTurnHook]);

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">Combate</Typography>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="select-map-inline-label">Mapa</InputLabel>
            <Select
              labelId="select-map-inline-label"
              label="Mapa"
              value={activeMapId || ''}
              onChange={(e) => setActiveMapId(e.target.value as string)}
              displayEmpty
              renderValue={(val) => {
                const m = maps.find((x) => x.id === val);
                if (!m) return <em>Mapa activo</em> as any;
                return (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 24, height: 24, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.imageAvailable ? (
                        <AuthImage src={getMapImageUrlSized(m.id, 'thumb')} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="small" />} />
                      ) : (
                        <ImageIcon fontSize="small" />
                      )}
                    </Box>
                    <Typography variant="body2" noWrap>{m.name}</Typography>
                    {m.musicConfig && <LibraryMusicIcon fontSize="small" color="primary" />}
                  </Stack>
                );
              }}
            >
              {maps.length === 0 && (
                <MenuItem value="" disabled>
                  <em>Sin mapas</em>
                </MenuItem>
              )}
              {maps.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 24, height: 24, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.imageAvailable ? (
                        <AuthImage src={getMapImageUrlSized(m.id, 'thumb')} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="small" />} />
                      ) : (
                        <ImageIcon fontSize="small" />
                      )}
                    </Box>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{m.name}</Typography>
                    {m.musicConfig && <LibraryMusicIcon fontSize="small" color="primary" />}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="select-encounter-inline-label">Encuentro</InputLabel>
            <Select
              labelId="select-encounter-inline-label"
              label="Encuentro"
              value={activeEncounterId || ''}
              onChange={(e) => handleSelectEncounter(e.target.value as string)}
              displayEmpty
              renderValue={(val) => {
                const chosen = encounters.find((e) => e.id === val);
                if (!chosen) return <em>Sin encuentro</em> as any;
                return (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" noWrap>{chosen.name}</Typography>
                    <Chip size="small" label={chosen.difficulty} color={difficultyColor[chosen.difficulty]} />
                  </Stack>
                );
              }}
            >
              {encounters.length === 0 && (
                <MenuItem value="" disabled>
                  <em>Sin encuentros</em>
                </MenuItem>
              )}
              {encounters.map((enc) => (
                <MenuItem key={enc.id} value={enc.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{enc.name}</Typography>
                    <Chip size="small" label={enc.difficulty} color={difficultyColor[enc.difficulty]} />
                    <Typography variant="caption" color="text.secondary">{enc.participants.length} integrantes</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={prioritizeEncounterMusic} onChange={(_, v) => setPrioritizeEncounterMusic(v)} />}
            label="Priorizar música de encuentro"
          />
          <FormControlLabel
            control={<Switch checked={fogEnabled} onChange={(_, v) => setFogEnabled(v)} />}
            label="Niebla de guerra"
          />
          <GotoMapsButton />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Vista previa vinculada a la ventana de jugadores. Permite seleccionar otro mapa y encuentro sin salir de esta pantalla.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <ProjectedMapMirror />
        </Box>
      </Paper>

      {/* Lista unificada, ordenada por iniciativa y controles de batalla */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems={'center'} sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Participantes</Typography>
          {!isMaster && <Chip size="small" label="Solo lectura" />}
        </Stack>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Aliados</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {allies.map((p) => {
                const char = p.kind === 'character' ? charMap.get(p.id) : undefined;
                const ch = (char?.currentHp ?? p.currentHp);
                const mx = (char?.maxHp ?? p.maxHp);
                const temp = (char?.tempHp);
                const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
                const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
                const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;
                return (
                  <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body1">{p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                        {percent !== undefined ? (
                          <Stack spacing={0.5}>
                            <LinearProgress variant="determinate" value={percent} />
                            <Typography variant="caption" color="text.secondary">HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{typeof temp === 'number' ? ` · Temp ${temp}` : ''}</Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">HP —</Typography>
                        )}
                        {isMaster ? (
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <TextField
                              size="small"
                              type="number"
                              label="HP"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={hasCh ? Number(ch) : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHp(p, 'currentHp', val);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); } }}
                            />
                            {p.kind === 'character' && (
                              <TextField
                                size="small"
                                type="number"
                                label="Temp"
                                inputProps={{ min: 0, style: { width: 64 } }}
                                value={typeof temp === 'number' ? temp : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  setHp(p, 'tempHp', val);
                                }}
                              />
                            )}
                            <TextField
                              size="small"
                              type="number"
                              label="Ini"
                              inputProps={{ min: -10, max: 50, style: { width: 64 } }}
                              value={p.initiative ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setInitiativeLocal(p.id, val);
                                schedulePersistInitiative(p.id);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                            />
                            {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Chip size="small" label={`Ini ${p.initiative ?? '—'}`} variant="outlined" />
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Enemigos</Typography>
              {isMaster && (
                <Button size="small" variant="outlined" startIcon={<CasinoIcon />} onClick={rollAllEnemiesInitiative}>
                  Calcular iniciativa (todos)
                </Button>
              )}
              {isMaster && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button size="small" variant="outlined" startIcon={<FavoriteIcon />} onClick={() => rollAllEnemiesHp('avg')}>
                    Calcular HP (media)
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<FavoriteIcon />} onClick={() => rollAllEnemiesHp('dice')}>
                    Calcular HP (dados)
                  </Button>
                </Stack>
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {foes.map((p) => {
                const ch = typeof p.currentHp === 'number' ? p.currentHp : undefined;
                const mx = typeof p.maxHp === 'number' ? p.maxHp : undefined;
                const percent = ch !== undefined && mx && mx > 0 ? Math.max(0, Math.min(100, (ch / mx) * 100)) : undefined;
                return (
                  <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body1">{p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                        {percent !== undefined ? (
                          <Stack spacing={0.5}>
                            <LinearProgress variant="determinate" value={percent} />
                            <Typography variant="caption" color="text.secondary">HP {ch}/{mx}</Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">HP —</Typography>
                        )}
                        {isMaster ? (
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <TextField
                              size="small"
                              type="number"
                              label="HP"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={p.currentHp ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHpLocal(p.id, 'currentHp', val);
                                schedulePersistInitiative(p.id);
                              }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Ini"
                              inputProps={{ min: -10, max: 50, style: { width: 64 } }}
                              value={p.initiative ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setInitiativeLocal(p.id, val);
                                schedulePersistInitiative(p.id);
                              }}
                            />
                            {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Chip size="small" label={`Ini ${p.initiative ?? '—'}`} variant="outlined" />
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Orden por iniciativa</Typography>
          <Chip size="small" label={`Ronda ${round}`} />
          {orderedParticipants.length > 0 && (
            <Chip size="small" label={`Turno ${turnIndex + 1}/${orderedParticipants.length}`} />
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {!battleStarted && (
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleStartBattle}>Empezar batalla</Button>
          )}
          {battleStarted && (
            <>
              <Button variant="outlined" startIcon={<OutboundIcon />} onClick={endBattle}>Escapar batalla</Button>
              <Button variant="contained" color="success" startIcon={<EmojiEventsIcon />} onClick={endBattle}>Batalla ganada</Button>
            </>
          )}
          <Button variant="outlined" onClick={previousTurn}>Turno anterior</Button>
          <Button variant="outlined" onClick={nextTurn}>Turno siguiente</Button>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {orderedParticipants.map((p, idx) => {
            const isEnemy = p.role === 'foe';
            const isAlly = !isEnemy;
            const char = isAlly && p.kind === 'character' ? charMap.get(p.id) : undefined;
            const ch = isAlly ? (char?.currentHp ?? p.currentHp) : (typeof p.currentHp === 'number' ? p.currentHp : undefined);
            const mx = isAlly ? (char?.maxHp ?? p.maxHp) : (typeof p.maxHp === 'number' ? p.maxHp : undefined);
            const temp = isAlly ? (char?.tempHp) : undefined;
            const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
            const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
            const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;
            return (
              <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, borderColor: idx === 0 ? 'primary.main' : 'divider', borderWidth: 1, borderStyle: 'solid' }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">{isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                      {p.id === currentTurnId && <Chip size="small" label="Turno actual" color="primary" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{(isEnemy ? 'Enemigo' : 'Aliado')} · Ini {p.initiative ?? '—'}</Typography>
                    {percent !== undefined ? (
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={percent} />
                        <Typography variant="caption" color="text.secondary">
                          HP {hasCh ? ch : '—'}/{hasMx ? mx : '—'}{isAlly && typeof temp === 'number' ? ` · Temp ${temp}` : ''}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">HP —</Typography>
                    )}
                    {isMaster ? (
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {isAlly ? (
                          <>
                            <TextField
                              size="small"
                              type="number"
                              label="HP"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={hasCh ? Number(ch) : ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHp(p, 'currentHp', val);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); } }}
                            />
                            {p.kind === 'character' && (
                              <TextField
                                size="small"
                                type="number"
                                label="Temp"
                                inputProps={{ min: 0, style: { width: 64 } }}
                                value={typeof temp === 'number' ? temp : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  setHp(p, 'tempHp', val);
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <TextField
                              size="small"
                              type="number"
                              label="HP"
                              inputProps={{ min: 0, style: { width: 64 } }}
                              value={p.currentHp ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHpLocal(p.id, 'currentHp', val);
                                schedulePersistInitiative(p.id);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="HP Max"
                              inputProps={{ min: 1, style: { width: 64 } }}
                              value={p.maxHp ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                setHpLocal(p.id, 'maxHp', val);
                                schedulePersistInitiative(p.id);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); schedulePersistInitiative(p.id); } }}
                            />
                          </>
                        )}
                        {(savingInitiative[p.id] || savingHp[p.id]) && <Chip size="small" label="Guardando..." />}
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}
