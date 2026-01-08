/**
 * CombatePage reúne la gestión de encuentros y la vista de combate en una sola pantalla.
 * Usa el contexto de campaña activa para decidir el contenido y el nivel de permisos
 * (máster con control total; jugador en modo lectura/seguimiento).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OutboundIcon from '@mui/icons-material/Outbound';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MapIcon from '@mui/icons-material/Map';
import ShieldIcon from '@mui/icons-material/Shield';
import GroupsIcon from '@mui/icons-material/Groups';
import CasinoIcon from '@mui/icons-material/Casino';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import ProjectedMapMirror from '../components/Map/ProjectedMapMirror';
import { useActiveMap } from '../components/Map/ActiveMapContext';
import { useActiveEncounter } from '../components/Encounter/ActiveEncounterContext';
import { listMaps, MapItemDto, getMapImageUrlSized } from '../api/maps';
import AuthImage from '../components/common/AuthImage';
import ImageIcon from '@mui/icons-material/Image';
import { getCurrentUser } from '../utils/getCurrentUser';
import { Campaign } from '../components/Campaign/types';
import { useNavigate } from 'react-router-dom';
import { EncounterSummary, EncounterDifficulty, listEncounters, createEncounter as apiCreateEncounter, updateEncounter as apiUpdateEncounter, deleteEncounter as apiDeleteEncounter } from '../api/encounters';
import { CharacterPayload, listCharacters, updateCharacter } from '../api/characters';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { listSongsForCampaign, SongLite } from '../api/soundtrack';
import { fetchMonster, fetchMonsters } from '../api/monsters';
import { MonsterDetail, MonsterIndexItem } from '../types/monsters';
import { getCampaignManuals } from '../api/campaigns/manuals';
import { useGlobalPlayer } from '../components/player/GlobalPlayerContext';
import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';

interface EncounterListProps {
  encounters: EncounterSummary[];
  isMaster: boolean;
  onCreate: () => void;
  onEdit: (enc: EncounterSummary) => void;
  onDelete: (enc: EncounterSummary) => void;
}

interface CombatViewProps {
  encounters: EncounterSummary[];
  isMaster: boolean;
  campaign: Campaign;
  songs: SongLite[];
  onUpdateEncounter: (enc: EncounterSummary) => void;
  characters: CharacterPayload[];
  onPatchCharacterLocal: (id: string, patch: Partial<CharacterPayload>) => void;
  monsters: Array<MonsterIndexItem & { manualId: string; compositeId: string }>;
}

const placeholderEncounters: EncounterSummary[] = [
  {
    id: 'enc-1',
    name: 'Patrulla goblin',
    difficulty: 'Fácil',
    musicLabel: 'Ambiental crepuscular',
    participants: [
      { id: 'pc-1', name: 'Aria (PJ)', kind: 'character', role: 'ally', level: 3 },
      { id: 'npc-1', name: 'Goblin explorador', kind: 'enemy', role: 'foe', cr: 0.25 },
      { id: 'npc-2', name: 'Goblin arquero', kind: 'enemy', role: 'foe', cr: 0.5 },
    ],
  },
  {
    id: 'enc-2',
    name: 'Troll de puente',
    difficulty: 'Difícil',
    musicLabel: 'Batalla intensa (noche)',
    participants: [
      { id: 'pc-2', name: 'Dorn (PJ)', kind: 'character', role: 'ally', level: 4 },
      { id: 'pc-3', name: 'Lyra (PJ)', kind: 'character', role: 'ally', level: 4 },
      { id: 'npc-3', name: 'Troll hambriento', kind: 'enemy', role: 'foe', cr: 5 },
    ],
  },
];

const difficultyColor: Record<EncounterDifficulty, 'default' | 'success' | 'warning' | 'error'> = {
  Fácil: 'success',
  Medio: 'default',
  Difícil: 'warning',
  Mortal: 'error',
};

type EncounterMetrics = {
  totalXp: number;
  adjustedXp: number;
  multiplier: number;
  monsterCount: number;
  pcCount: number;
  thresholds: { easy: number; medium: number; hard: number; deadly: number };
  suggested: EncounterDifficulty;
};

const xpByCr: Record<string, number> = {
  '0': 10,
  '0.125': 25,
  '0.25': 50,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

const thresholdsByLevel: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

function xpForCr(cr?: number): number {
  if (cr === undefined || Number.isNaN(cr)) return 0;
  const key = cr === 0 ? '0' : cr.toString();
  if (xpByCr[key] !== undefined) return xpByCr[key];
  const rounded = Math.max(0, Math.min(30, Number(cr.toFixed(3))));
  return xpByCr[rounded.toString()] ?? 0;
}

function multiplierFor(count: number): number {
  if (count <= 0) return 1;
  if (count === 1) return 1;
  if (count === 2) return 1.5;
  if (count >= 3 && count <= 6) return 2;
  if (count >= 7 && count <= 10) return 2.5;
  if (count >= 11 && count <= 14) return 3;
  return 4;
}

function computeEncounterMetrics(participants: EncounterSummary['participants']): EncounterMetrics {
  const monsters = participants.filter((p) => p.role === 'foe');
  const pcs = participants.filter((p) => p.role !== 'foe');
  const totalXp = monsters.reduce((acc, m) => acc + xpForCr(m.cr), 0);
  const multiplier = multiplierFor(monsters.length);
  const adjustedXp = Math.round(totalXp * multiplier);

  const thresholds = pcs.reduce((acc, pc) => {
    const lvl = Math.max(1, Math.min(20, pc.level ?? 1));
    const th = thresholdsByLevel[lvl];
    return {
      easy: acc.easy + th.easy,
      medium: acc.medium + th.medium,
      hard: acc.hard + th.hard,
      deadly: acc.deadly + th.deadly,
    };
  }, { easy: 0, medium: 0, hard: 0, deadly: 0 });

  const suggested: EncounterDifficulty = (() => {
    if (adjustedXp >= thresholds.deadly && thresholds.deadly > 0) return 'Mortal';
    if (adjustedXp >= thresholds.hard && thresholds.hard > 0) return 'Difícil';
    if (adjustedXp >= thresholds.medium && thresholds.medium > 0) return 'Medio';
    return 'Fácil';
  })();

  return { totalXp, adjustedXp, multiplier, monsterCount: monsters.length, pcCount: pcs.length, thresholds, suggested };
}

function EncounterList({ encounters, isMaster, onCreate, onEdit, onDelete }: EncounterListProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Encuentros</Typography>
        {isMaster && (
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => onCreate()}>
            Nuevo encuentro
          </Button>
        )}
      </Stack>
      {encounters.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Aún no hay encuentros. Crea el primero para comenzar a preparar el combate.</Typography>
      ) : (
        <List dense>
          {encounters.map((enc) => (
            <ListItem key={enc.id} alignItems="flex-start" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1">{enc.name}</Typography>
                    <Chip size="small" label={enc.difficulty} color={difficultyColor[enc.difficulty]} />
                    {enc.musicLabel && <Chip size="small" icon={<LibraryMusicIcon fontSize="small" />} label={enc.musicLabel} />}
                  </Stack>
                }
                secondary={
                  <Stack spacing={0.5} mt={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {enc.participants.length} integrantes · {enc.participants.filter((p) => p.kind === 'enemy').length} enemigos
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {enc.participants.map((p) => (
                        <Chip
                          key={p.id}
                          size="small"
                          label={`${p.name}${p.level ? ` · Nivel ${p.level}` : ''}${p.cr ? ` · CR ${p.cr}` : ''}`}
                          icon={p.kind === 'enemy' ? <ShieldIcon fontSize="small" /> : <GroupsIcon fontSize="small" />}
                        />
                      ))}
                    </Stack>
                  </Stack>
                }
              />
              {isMaster && (
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="edit" size="small" onClick={() => onEdit(enc)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" size="small" sx={{ ml: 1 }} onClick={() => onDelete(enc)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

function CombatView({ encounters, isMaster, campaign, songs, onUpdateEncounter, characters, onPatchCharacterLocal, monsters }: CombatViewProps) {
  const { play } = useGlobalPlayer();
  const { activeEncounterId, setActiveEncounterId } = useActiveEncounter();
  const [selectedMapName, setSelectedMapName] = useState<string>('Mapa activo');
  const [prioritizeEncounterMusic, setPrioritizeEncounterMusic] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(true);
  const [participantsDraft, setParticipantsDraft] = useState<EncounterSummary['participants']>([]);
  const [savingInitiative, setSavingInitiative] = useState<Record<string, boolean>>({});
  const [savingHp, setSavingHp] = useState<Record<string, boolean>>({});
  const { activeMapId, setActiveMapId } = useActiveMap();
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const participantsRef = React.useRef<EncounterSummary['participants']>([]);
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

  useEffect(() => {
    // Ensure turnIndex remains valid when the ordered list changes
    if (turnIndex >= orderedParticipants.length) {
      setTurnIndex(orderedParticipants.length > 0 ? 0 : 0);
    }
    if (orderedParticipants.length === 0) {
      setRound(1);
      setTurnIndex(0);
    }
  }, [orderedParticipants.length]);

  const currentTurnId = orderedParticipants[turnIndex]?.id;

  const baseParticipants = useMemo(() => (participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || [])), [participantsDraft, selectedEncounter]);
  const allies = useMemo(() => baseParticipants.filter((p) => p.role !== 'foe'), [baseParticipants]);
  const foes = useMemo(() => baseParticipants.filter((p) => p.role === 'foe'), [baseParticipants]);

  function indexToLetters(idx: number): string {
    // 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, etc.
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

  // Load maps for current campaign and reflect active map name
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

  // setHp defined after schedulePersistInitiative

  const persistParticipants = useCallback(async () => {
    if (!selectedEncounter || !campaign?.id) return;
    // Use ref to avoid stale captures of participantsDraft in debounced saves
    const payload = { participants: (participantsRef.current || []).map((p) => ({ ...p })) };
    try {
      const saved = await apiUpdateEncounter(campaign.id, selectedEncounter.id, payload as any);
      onUpdateEncounter(saved);
      // refresh local draft from server to keep canonical order/values
      setParticipantsDraft(saved.participants || []);
    } catch (e) {
      // silently ignore here; UI will keep local until next refresh
    }
  }, [campaign?.id, selectedEncounter?.id, onUpdateEncounter]);

  const pendingSaveTimers = React.useRef<Record<string, any>>({});
  const schedulePersistInitiative = useCallback((pid: string) => {
    // Debounce per participant to avoid flooding backend
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
  const buildSongStreamEndpoint = useCallback((songId: string) => {
    return campaign?.id
      ? `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream?campaignId=${campaign.id}`
      : `${api.defaults.baseURL}/soundtrack/songs/${songId}/stream`;
  }, [campaign?.id]);

  function dexMod(score?: number) {
    if (!score || Number.isNaN(score)) return 0;
    return Math.floor((score - 10) / 2);
  }

  const rollEnemyInitiative = useCallback(async (pid: string) => {
    const p = participantsDraft.find((pp) => pp.id === pid);
    if (!p) return;
    let mod = 0;
    if (p.monsterManualId && p.monsterSlug) {
      try {
        const detail = await fetchMonster(p.monsterManualId, p.monsterSlug, 'es').catch(() => fetchMonster(p.monsterManualId!, p.monsterSlug!, 'en'));
        mod = dexMod(detail?.abilities?.dex);
      } catch {}
    }
    const d20 = 1 + Math.floor(Math.random() * 20);
    const total = d20 + mod;
    setInitiativeLocal(pid, total);
    // Use the same debounced save path as manual edits to avoid stale state
    schedulePersistInitiative(pid);
  }, [participantsDraft, schedulePersistInitiative]);

  /**
   * Calcula la iniciativa de todos los enemigos a la vez.
   * Respeta el modificador de Destreza individual de cada enemigo
   * (consultando su ficha en el bestiario cuando esté disponible).
   */
  const rollAllEnemiesInitiative = useCallback(async () => {
    const tasks = foes.map(async (p) => {
      let mod = 0;
      if (p.monsterManualId && p.monsterSlug) {
        try {
          const detail = await fetchMonster(p.monsterManualId, p.monsterSlug, 'es').catch(() => fetchMonster(p.monsterManualId!, p.monsterSlug!, 'en'));
          mod = dexMod(detail?.abilities?.dex);
        } catch {}
      }
      const d20 = 1 + Math.floor(Math.random() * 20);
      const total = d20 + mod;
      setInitiativeLocal(p.id, total);
    });
    await Promise.all(tasks);
    // Persistir todas las iniciativas calculadas (se usarán los guardados con debounce)
    foes.forEach((p) => schedulePersistInitiative(p.id));
  }, [foes, schedulePersistInitiative, setInitiativeLocal]);

  function parseDiceRoll(expr?: string): { dice: number; sides: number; mod: number } | null {
    if (!expr) return null;
    const m = expr.match(/^(\d+)\s*[dD]\s*(\d+)(\s*[+-]\s*\d+)?\s*$/);
    if (!m) return null;
    const dice = Number(m[1]);
    const sides = Number(m[2]);
    const mod = m[3] ? Number(m[3].replace(/\s+/g, '')) : 0;
    if (!Number.isFinite(dice) || !Number.isFinite(sides) || dice <= 0 || sides <= 0) return null;
    return { dice, sides, mod };
  }

  const rollAllEnemiesHp = useCallback(async (mode: 'avg' | 'dice') => {
    const tasks = foes.map(async (p) => {
      let hpAvg: number | undefined;
      let hpRollExpr: string | undefined;
      let manualId = p.monsterManualId;
      let slug = p.monsterSlug;
      if (!manualId || !slug) {
        const byName = (monsters || []).find((m) => m.name.trim().toLowerCase() === (p.name || '').trim().toLowerCase());
        if (byName) { manualId = byName.manualId; slug = byName.slug; }
      }
      if (manualId && slug) {
        try {
          const detail = await fetchMonster(manualId, slug, 'es').catch(() => fetchMonster(manualId!, slug!, 'en'));
          hpAvg = detail?.hitPoints?.average;
          hpRollExpr = detail?.hitPoints?.roll;
        } catch {}
      }
      let value: number | undefined;
      if (mode === 'avg') {
        value = typeof hpAvg === 'number' ? hpAvg : undefined;
      } else {
        const parsed = parseDiceRoll(hpRollExpr);
        if (parsed) {
          const rolls = Array.from({ length: parsed.dice }, () => 1 + Math.floor(Math.random() * parsed.sides));
          value = rolls.reduce((a, b) => a + b, 0) + parsed.mod;
        } else if (typeof hpAvg === 'number') {
          value = hpAvg;
        }
      }
      if (typeof value === 'number' && value > 0) {
        setHpLocal(p.id, 'maxHp', value);
        setHpLocal(p.id, 'currentHp', value);
      }
    });
    await Promise.all(tasks);
    foes.forEach((p) => schedulePersistInitiative(p.id));
  }, [foes, schedulePersistInitiative, setHpLocal, monsters]);

  const handleStartBattle = useCallback(async () => {
    // Initialize turn and round counters when starting battle
    setRound(1);
    setTurnIndex(0);
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

  const nextTurn = useCallback(() => {
    const len = orderedParticipants.length;
    if (len === 0) return;
    if (turnIndex + 1 >= len) {
      setTurnIndex(0);
      setRound((r) => r + 1);
    } else {
      setTurnIndex((i) => i + 1);
    }
  }, [turnIndex, orderedParticipants.length]);

  const previousTurn = useCallback(() => {
    const len = orderedParticipants.length;
    if (len === 0) return;
    if (turnIndex - 1 < 0) {
      setTurnIndex(len - 1);
      setRound((r) => Math.max(1, r - 1));
    } else {
      setTurnIndex((i) => i - 1);
    }
  }, [turnIndex, orderedParticipants.length]);

  const resetRound = useCallback(() => {
    // Resets to first turn and increments round
    if (orderedParticipants.length === 0) return;
    setTurnIndex(0);
    setRound((r) => r + 1);
  }, [orderedParticipants.length]);

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">Combate</Typography>
          {/* Selector de mapa integrado */}
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
                if (!m) return <em>Mapa activo</em>;
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
          {/* Selector de encuentro integrado */}
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
                if (!chosen) return <em>Sin encuentro</em>;
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

      {/* Eliminado: selector dedicado; integrados arriba */}

      {/* Participantes por bando con barra de vida e iniciativa editable */}
      <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems={"center"} sx={{ mb: 1 }}>
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
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); /* immediate handled by setHp */ } }}
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
                            {savingInitiative[p.id] && <Chip size="small" label="Guardando..." />}
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

      {/* Lista unificada, ordenada por iniciativa */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Orden por iniciativa</Typography>
          <Chip size="small" label={`Ronda ${round}`} />
          {orderedParticipants.length > 0 && (
            <Chip size="small" label={`Turno ${turnIndex + 1}/${orderedParticipants.length}`} />
          )}
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

      {/* Controles de batalla */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Controles de batalla</Typography>
          <Chip size="small" label={`Ronda ${round}`} />
          {orderedParticipants.length > 0 && (
            <Chip size="small" label={`Turno ${turnIndex + 1}/${orderedParticipants.length}`} />
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleStartBattle}>Empezar batalla</Button>
          <Button variant="outlined" startIcon={<OutboundIcon />}>Escapar batalla</Button>
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={resetRound}>Resetear ronda</Button>
          <Button variant="contained" color="success" startIcon={<EmojiEventsIcon />}>Batalla ganada</Button>
          <Button variant="outlined" onClick={previousTurn}>Turno anterior</Button>
          <Button variant="outlined" onClick={nextTurn}>Turno siguiente</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Estos botones controlarán música, experiencia y estados cuando se conecten los endpoints de combate.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Fichas y estados</Typography>
        <Alert severity="info">
          Pendiente de integrar tokens, fichas y estados sincronizados con la ventana de jugadores y la niebla de guerra.
        </Alert>
      </Paper>
    </Stack>
  );
}

function computeIsMaster(campaign: Campaign | null, currentUserId?: number) {
  if (!campaign || !currentUserId) return false;
  if (campaign.owner?.id === currentUserId) return true;
  return campaign.players?.some((p) => p.user?.id === currentUserId && p.role === 'master') || false;
}

const CombatPage: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const user = getCurrentUser();
  const isMaster = useMemo(() => computeIsMaster(activeCampaign, user?.id), [activeCampaign, user?.id]);
  const [tab, setTab] = useState<'encounters' | 'combat'>('combat');
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [songs, setSongs] = useState<SongLite[]>([]);
  const [monsters, setMonsters] = useState<Array<MonsterIndexItem & { manualId: string; compositeId: string }>>([]);
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; open: boolean; encounter: EncounterSummary | null }>({ mode: 'create', open: false, encounter: null });
  const [deleteTarget, setDeleteTarget] = useState<EncounterSummary | null>(null);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) {
      setEncounters([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await listEncounters(cid);
        setEncounters(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'No se pudieron cargar los encuentros');
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setCharacters([]); return; }
    // Cargar personajes para permitir asociarlos como participantes
    listCharacters(cid).then(setCharacters).catch(() => setCharacters([]));
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setSongs([]); return; }
    listSongsForCampaign(cid)
      .then(({ associated, reusable }) => setSongs([...(associated || []), ...(reusable || [])]))
      .catch(() => setSongs([]));
  }, [activeCampaign?.id]);

  useEffect(() => {
    const cid = activeCampaign?.id;
    if (!cid) { setMonsters([]); return; }
    (async () => {
      try {
        let manualIds = activeCampaign?.selectedManualIds?.length
          ? activeCampaign.selectedManualIds
          : [];
        if (!manualIds.length) {
          try {
            manualIds = await getCampaignManuals(cid);
          } catch {
            manualIds = [];
          }
        }
        const ids = manualIds.length ? manualIds : ['dnd5e-2014'];
        const fetchOne = async (mid: string, lang: 'es' | 'en') => {
          const r = await fetchMonsters(mid, { lang, page: 1, pageSize: 500 });
          return r.items || [];
        };
        const combined: Record<string, MonsterIndexItem & { manualId: string; compositeId: string }> = {};
        for (const mid of ids) {
          let items: MonsterIndexItem[] = [];
          try { items = await fetchOne(mid, 'es'); } catch {}
          if (!items.length) {
            try { items = await fetchOne(mid, 'en'); } catch {}
          }
          items.forEach((m) => {
            const compositeId = `${mid}:${m.slug}`;
            combined[compositeId] = { ...m, manualId: mid, compositeId };
          });
        }
        const list = Object.values(combined).sort((a, b) => a.name.localeCompare(b.name));
        setMonsters(list);
      } catch {
        setMonsters([]);
      }
    })();
  }, [activeCampaign?.id, activeCampaign?.selectedManualIds]);

  const handleOpenCreate = () => setDialogState({ mode: 'create', open: true, encounter: null });
  const handleOpenEdit = (enc: EncounterSummary) => setDialogState({ mode: 'edit', open: true, encounter: enc });
  const handleCloseDialog = () => setDialogState({ ...dialogState, open: false });

  const handleSaved = (saved: EncounterSummary, mode: 'create' | 'edit') => {
    setEncounters((prev) => {
      if (mode === 'create') return [...prev, saved];
      return prev.map((p) => (p.id === saved.id ? saved : p));
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !activeCampaign?.id) return;
    try {
      await apiDeleteEncounter(activeCampaign.id, deleteTarget.id);
      setEncounters((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!activeCampaign?.id) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Combate</Typography>
        <Typography variant="body2" color="text.secondary">
          Selecciona una campaña para gestionar encuentros o usar la vista de combate.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Combate</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="encounters" label="Encuentros" />
        <Tab value="combat" label="Combate" />
      </Tabs>
      {tab === 'encounters' && (
        <Stack spacing={2}>
          {!isMaster && <Alert severity="info">Como jugador puedes consultar encuentros, pero solo el máster puede crearlos o editarlos.</Alert>}
          {loading && <Alert severity="info">Cargando encuentros...</Alert>}
          {error && <Alert severity="warning">{error}</Alert>}
          <EncounterList encounters={encounters} isMaster={isMaster} onCreate={handleOpenCreate} onEdit={handleOpenEdit} onDelete={(enc) => setDeleteTarget(enc)} />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Próximo paso: conectar CRUD de encuentros (bestiario + personajes), calculadora de dificultad y selección de música por dificultad y momento del día.
            </Typography>
          </Paper>
        </Stack>
      )}
      {tab === 'combat' && (
        <CombatView
          encounters={encounters.length ? encounters : []}
          isMaster={isMaster}
          campaign={activeCampaign}
          songs={songs}
          onUpdateEncounter={(enc) => setEncounters((prev) => prev.map((e) => e.id === enc.id ? enc : e))}
          characters={characters}
          onPatchCharacterLocal={(id, patch) => setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))}
          monsters={monsters}
        />
      )}

      {isMaster && (
        <EncounterFormDialog
          open={dialogState.open}
          mode={dialogState.mode}
          encounter={dialogState.encounter}
          onClose={handleCloseDialog}
          onSaved={handleSaved}
          campaignId={activeCampaign.id}
          characters={characters}
          songs={songs}
          monsters={monsters}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar encuentro"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        confirmColor="error"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
};

function GotoMapsButton() {
  const navigate = useNavigate();
  return (
    <Button startIcon={<MapIcon />} size="small" variant="text" onClick={() => navigate('/maps')}>
      Ir a Mapas
    </Button>
  );
}

export default CombatPage;

type EncounterFormDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  encounter: EncounterSummary | null;
  onClose: () => void;
  onSaved: (enc: EncounterSummary, mode: 'create' | 'edit') => void;
  campaignId: string;
  characters: CharacterPayload[];
  songs: SongLite[];
  monsters: Array<MonsterIndexItem & { manualId: string; compositeId: string }>;
};

function EncounterFormDialog({ open, mode, encounter, onClose, onSaved, campaignId, characters, songs, monsters }: EncounterFormDialogProps) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<EncounterDifficulty>('Medio');
  const [autoDifficulty, setAutoDifficulty] = useState(true);
  const [musicLabel, setMusicLabel] = useState('');
  const [musicSongId, setMusicSongId] = useState<string | ''>('');
  const [participants, setParticipants] = useState<EncounterSummary['participants']>([]);
  const [saving, setSaving] = useState(false);
  const [monsterPreview, setMonsterPreview] = useState<MonsterDetail | null>(null);
  const [monsterPreviewLoading, setMonsterPreviewLoading] = useState(false);

  const metrics = useMemo(() => computeEncounterMetrics(participants), [participants]);

  useEffect(() => {
    if (open && encounter) {
      setName(encounter.name);
      setDifficulty(encounter.difficulty);
      setAutoDifficulty(false);
      setMusicLabel(encounter.musicLabel || '');
      setMusicSongId(encounter.musicSongId || '');
      setParticipants(encounter.participants || []);
    } else if (open) {
      setName('');
      setDifficulty('Medio');
      setAutoDifficulty(true);
      setMusicLabel('');
      setMusicSongId('');
      setParticipants([]);
    }
  }, [open, encounter]);

  useEffect(() => {
    if (autoDifficulty) {
      setDifficulty(metrics.suggested);
    }
  }, [metrics.suggested, autoDifficulty]);

  const upsertParticipantById = (pid: string, patch: Partial<EncounterSummary['participants'][number]>) => {
    setParticipants((prev) => prev.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  };

  const addCharacter = (charId: string, asEnemy = false) => {
    const ch = characters.find((c) => c.id === charId);
    if (!ch) return;
    setParticipants((prev) => [...prev, {
      id: ch.id!,
      name: ch.name,
      kind: asEnemy ? 'enemy' : 'character',
      role: asEnemy ? 'foe' : 'ally',
      level: ch.level,
    }]);
  };

  const makeUuid = () => {
    try {
      if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
    } catch {}
    // simple fallback uuid v4-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const addEnemy = (monster?: MonsterIndexItem & { manualId?: string; compositeId?: string }) => {
    const id = makeUuid();
    setParticipants((prev) => [...prev, {
      id,
      name: monster?.name || 'Enemigo',
      kind: 'enemy',
      role: 'foe',
      cr: monster?.challengeRating ? Number(monster.challengeRating) : 0,
      monsterManualId: monster?.manualId,
      monsterSlug: monster?.slug,
    }]);
  };

  const duplicateParticipantById = (pid: string) => {
    const original = participants.find((p) => p.id === pid);
    if (!original) return;
    const id = makeUuid();
    const clone = { ...original, id };
    setParticipants((prev) => [...prev, clone]);
  };

  const removeParticipantById = (pid: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== pid));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      difficulty,
      musicLabel: musicLabel.trim() || undefined,
      musicSongId: musicSongId || undefined,
      participants: participants.map((p) => {
        const cleanLevel = Number.isFinite(p.level) ? p.level : undefined;
        const cleanCr = Number.isFinite(p.cr) ? p.cr : undefined;
        const cleanInit = Number.isFinite(p.initiative) ? p.initiative : undefined;
        const cleanMaxHp = Number.isFinite(p.maxHp) ? p.maxHp : undefined;
        const cleanCurrentHp = Number.isFinite(p.currentHp) ? p.currentHp : undefined;
        return {
          ...p,
          level: cleanLevel,
          cr: cleanCr,
          initiative: cleanInit,
          maxHp: cleanMaxHp,
          currentHp: cleanCurrentHp,
        };
      }),
    } as const;
    try {
      let saved: EncounterSummary;
      if (mode === 'create') {
        saved = await apiCreateEncounter(campaignId, payload as any);
      } else if (encounter) {
        saved = await apiUpdateEncounter(campaignId, encounter.id, payload as any);
      } else {
        return;
      }
      onSaved(saved, mode);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al guardar el encuentro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Nuevo encuentro' : 'Editar encuentro'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <FormControl size="small" fullWidth>
            <InputLabel id="difficulty-label">Dificultad</InputLabel>
            <Select
              labelId="difficulty-label"
              label="Dificultad"
              value={difficulty}
              onChange={(e) => { setAutoDifficulty(false); setDifficulty(e.target.value as EncounterDifficulty); }}
            >
              {(['Fácil','Medio','Difícil','Mortal'] as EncounterDifficulty[]).map((d) => (
                <MenuItem key={d} value={d}>{d}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            XP base {metrics.totalXp || 0} · x{metrics.multiplier} ({metrics.monsterCount} enemigos) = {metrics.adjustedXp || 0} ajustados.{' '}
            Umbrales {metrics.pcCount || 0} PJ: Fácil {metrics.thresholds.easy || 0} / Medio {metrics.thresholds.medium || 0} / Difícil {metrics.thresholds.hard || 0} / Mortal {metrics.thresholds.deadly || 0}.{' '}
            Sugerido: {metrics.suggested}{autoDifficulty ? ' (auto)' : ''}.
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel id="music-label" shrink>Música asociada</InputLabel>
            <Select
              labelId="music-label"
              label="Música asociada"
              value={musicSongId}
              onChange={(e) => {
                const val = e.target.value as string;
                setMusicSongId(val);
                const selected = songs.find((s) => s.id === val);
                setMusicLabel(selected?.name || '');
              }}
              displayEmpty
              renderValue={(val) => {
                if (!val) return <em>Sin música</em>;
                const selected = songs.find((s) => s.id === val);
                return selected?.name || musicLabel || <em>Sin música</em>;
              }}
            >
              <MenuItem value=""><em>Sin música</em></MenuItem>
              {songs.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle1">Participantes</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="add-character-label" shrink>Añadir personaje (aliado)</InputLabel>
              <Select
                labelId="add-character-label"
                label="Añadir personaje (aliado)"
                onChange={(e) => { addCharacter(e.target.value as string, false); (e.target as any).value = ''; }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona personaje</em>)}
              >
                <MenuItem value="" disabled>Selecciona personaje</MenuItem>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} {c.level ? `(Nivel ${c.level})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="add-character-foe-label" shrink>Personaje como enemigo</InputLabel>
              <Select
                labelId="add-character-foe-label"
                label="Personaje como enemigo"
                onChange={(e) => { addCharacter(e.target.value as string, true); (e.target as any).value = ''; }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona personaje</em>)}
              >
                <MenuItem value="" disabled>Selecciona personaje</MenuItem>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} {c.level ? `(Nivel ${c.level})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="add-monster-label" shrink>Enemigo del bestiario</InputLabel>
              <Select
                labelId="add-monster-label"
                label="Enemigo del bestiario"
                onChange={async (e) => {
                  const composite = e.target.value as string;
                  const m = monsters.find((mm) => mm.compositeId === composite);
                  if (m) {
                    addEnemy(m);
                    setMonsterPreviewLoading(true);
                    try {
                      const detail = await fetchMonster(m.manualId, m.slug, 'es').catch(async () => fetchMonster(m.manualId, m.slug, 'en'));
                      setMonsterPreview(detail);
                    } catch { setMonsterPreview(null); } finally { setMonsterPreviewLoading(false); }
                  }
                  (e.target as any).value = '';
                }}
                value=""
                displayEmpty
                renderValue={(val) => (val ? val : <em>Selecciona enemigo</em>)}
              >
                <MenuItem value="" disabled>Selecciona enemigo</MenuItem>
                {monsters.map((m) => (
                  <MenuItem key={m.compositeId} value={m.compositeId}>{m.name}{m.challengeRating ? ` (CR ${m.challengeRating})` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => addEnemy()}>Enemigo manual</Button>
          </Stack>

          {monsterPreview && (
            <Card variant="outlined" sx={{ p: 1 }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2">{monsterPreview.name} {monsterPreview.challengeRating ? `(CR ${monsterPreview.challengeRating})` : ''}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {monsterPreview.size || '—'} · {monsterPreview.type || 'criatura'}{monsterPreview.alignment ? `, ${monsterPreview.alignment}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AC {monsterPreview.armorClass?.value ?? '—'} · HP {monsterPreview.hitPoints?.average ?? '—'} {monsterPreview.hitPoints?.roll ? `(${monsterPreview.hitPoints.roll})` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">Velocidad: {monsterPreview.speed ? Object.entries(monsterPreview.speed).map(([k,v]) => `${k} ${v}ft`).join(', ') : '—'}</Typography>
                {monsterPreview.traits?.length ? (
                  <Typography variant="body2" color="text.secondary">{monsterPreview.traits.slice(0,2).map(t => t.name).join(' · ')}</Typography>
                ) : null}
              </CardContent>
            </Card>
          )}
          {monsterPreviewLoading && <Typography variant="body2" color="text.secondary">Cargando ficha...</Typography>}

          <Stack spacing={2}>
            <Typography variant="subtitle2">Aliados</Typography>
            {participants.filter(p => p.role !== 'foe').map((p) => (
              <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                  <TextField
                    label="Nombre"
                    size="small"
                    value={p.name}
                    onChange={(e) => upsertParticipantById(p.id, { name: e.target.value })}
                    sx={{ minWidth: 200 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`kind-${p.id}`}>Tipo</InputLabel>
                    <Select
                      labelId={`kind-${p.id}`}
                      label="Tipo"
                      value={p.kind}
                      onChange={(e) => upsertParticipantById(p.id, { kind: e.target.value as any })}
                    >
                      <MenuItem value="character">Personaje</MenuItem>
                      <MenuItem value="enemy">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`role-${p.id}`}>Rol</InputLabel>
                    <Select
                      labelId={`role-${p.id}`}
                      label="Rol"
                      value={p.role || ''}
                      onChange={(e) => upsertParticipantById(p.id, { role: e.target.value as any })}
                    >
                      <MenuItem value="ally">Aliado</MenuItem>
                      <MenuItem value="foe">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Nivel"
                    size="small"
                    type="number"
                    inputProps={{ min: 1, max: 30 }}
                    value={p.level ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { level: Number(e.target.value) })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Iniciativa"
                    size="small"
                    type="number"
                    inputProps={{ min: -10, max: 50 }}
                    value={p.initiative ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { initiative: Number(e.target.value) })}
                    sx={{ width: 140 }}
                  />
                  <Button color="error" size="small" onClick={() => removeParticipantById(p.id)}>Quitar</Button>
                </Stack>
              </Paper>
            ))}
            <Typography variant="subtitle2">Enemigos</Typography>
            {participants.filter(p => p.role === 'foe').map((p) => (
              <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                  <TextField
                    label="Nombre"
                    size="small"
                    value={p.name}
                    onChange={(e) => upsertParticipantById(p.id, { name: e.target.value })}
                    sx={{ minWidth: 200 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`kind-${p.id}`}>Tipo</InputLabel>
                    <Select
                      labelId={`kind-${p.id}`}
                      label="Tipo"
                      value={p.kind}
                      onChange={(e) => upsertParticipantById(p.id, { kind: e.target.value as any })}
                    >
                      <MenuItem value="character">Personaje</MenuItem>
                      <MenuItem value="enemy">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id={`role-${p.id}`}>Rol</InputLabel>
                    <Select
                      labelId={`role-${p.id}`}
                      label="Rol"
                      value={p.role || ''}
                      onChange={(e) => upsertParticipantById(p.id, { role: e.target.value as any })}
                    >
                      <MenuItem value="ally">Aliado</MenuItem>
                      <MenuItem value="foe">Enemigo</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="CR"
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: 0.25 }}
                    value={p.cr ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { cr: Number(e.target.value) })}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Iniciativa"
                    size="small"
                    type="number"
                    inputProps={{ min: -10, max: 50 }}
                    value={p.initiative ?? ''}
                    onChange={(e) => upsertParticipantById(p.id, { initiative: Number(e.target.value) })}
                    sx={{ width: 140 }}
                  />
                  <IconButton aria-label="Duplicar" size="small" color="primary" onClick={() => duplicateParticipantById(p.id)} title="Duplicar este enemigo">
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Button color="error" size="small" onClick={() => removeParticipantById(p.id)}>Quitar</Button>
                </Stack>
              </Paper>
            ))}
            {participants.length === 0 && (
              <Typography variant="body2" color="text.secondary">Añade personajes o enemigos para calcular dificultad y preparar iniciativa.</Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
