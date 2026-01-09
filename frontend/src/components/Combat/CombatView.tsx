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
  Tabs,
  Tab,
  Divider,
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
import { MonsterDetail, MonsterIndexItem } from '../../types/monsters';
import { Campaign } from '../../components/Campaign/types';
import GotoMapsButton from './GotoMapsButton';
import { getSkylineOverlaySettings, setSkylineOverlaySettings } from '../../api/campaigns/skylineOverlay';
import { setCampaignBattleState } from '../../api/campaigns/battleState';

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
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [monsterDetailByPid, setMonsterDetailByPid] = useState<Record<string, MonsterDetail | null>>({});
  const [viewMode, setViewMode] = useState<'participants' | 'initiative'>('participants');
  const [showInitiativeStrip, setShowInitiativeStrip] = useState<boolean>(false);
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

  // Índice por nombre base (sin sufijo de letras) para resolver bestiario en enemigos repetidos
  const monsterIndexByName = useMemo(() => {
    const map = new Map<string, { manualId: string; slug: string }>();
    (monsters || []).forEach((m) => {
      const key = (m.name || '').trim().toLowerCase();
      if (m.manualId && m.slug && key) {
        if (!map.has(key)) map.set(key, { manualId: m.manualId, slug: m.slug });
      }
    });
    return map;
  }, [monsters]);

  // Debug helper (enable with localStorage.setItem('debugBestiary','1'))
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debugBestiary') === '1') console.debug('[CombatView][Bestiary]', ...args); } catch {} };

  function stripGroupSuffix(name: string): string {
    // El algoritmo de nombres repetidos añade " A", "B", "AA", etc. al final.
    // Eliminamos un bloque final de letras mayúsculas precedido por espacio.
    const base = (name || '').trim();
    return base.replace(/\s+[A-Z]+$/, '');
  }

  function needsEnglishFallback(md?: MonsterDetail | null): boolean {
    if (!md) return true;
    // Si faltan bloques clave o están vacíos, intentamos EN: acciones, rasgos, lenguajes, sentidos, habilidades
    const arraysHaveContent = (arr?: Array<{ name?: string; desc?: string }>) => !!(arr && arr.some(x => (x?.name && x?.name.trim()) || (x?.desc && x?.desc.trim())));
    const lacksArrays = !(arraysHaveContent(md.traits) || arraysHaveContent(md.actions) || arraysHaveContent(md.legendaryActions) || arraysHaveContent(md.lairActions) || arraysHaveContent(md.regionalEffects));
    const lacksLangSense = !(md.languages || (md.senses && Object.keys(md.senses).length));
    const lacksSkills = !(md.skills && Object.keys(md.skills).length);
    const lacksAbilities = !(md.abilities && Object.keys(md.abilities).length);
    return lacksArrays || lacksLangSense || lacksSkills || lacksAbilities;
  }

  function mergeMonsterDetails(primary?: MonsterDetail | null, fallback?: MonsterDetail | null): MonsterDetail | null {
    if (!primary && !fallback) return null;
    const a = primary || ({} as MonsterDetail);
    const b = fallback || ({} as MonsterDetail);
    const pick = <T,>(pa: T | undefined, fb: T | undefined): T | undefined => (pa !== undefined && pa !== null ? pa : fb);
    const pickArr = <T,>(pa?: T[] | null, fb?: T[] | null): T[] | undefined => (pa && pa.length ? pa : (fb && fb.length ? fb : undefined));
    const combineArr = (pa?: Array<{ name?: string; desc?: string }>, fb?: Array<{ name?: string; desc?: string }>) => {
      const out: Array<{ name?: string; desc?: string }> = [];
      const len = Math.max(pa?.length || 0, fb?.length || 0);
      for (let i = 0; i < len; i++) {
        const ai = pa?.[i];
        const bi = fb?.[i];
        const aText = (ai as any)?.text;
        const bText = (bi as any)?.text;
        const name = (ai?.name && ai.name.trim()) ? ai.name : (bi?.name || ai?.name);
        const desc = (ai?.desc && ai.desc.trim()) ? ai.desc : ((aText && String(aText).trim()) ? String(aText) : (bi?.desc || (bText ? String(bText) : ai?.desc)));
        if ((name && name.trim()) || (desc && desc.trim())) {
          out.push({ name, desc });
        }
      }
      // Si aún está vacío, usa el que tenga contenido
      if (!out.length) return pa?.length ? pa : (fb || []);
      return out;
    };
    const abilities: any = { str: pick(a.abilities?.str, b.abilities?.str), dex: pick(a.abilities?.dex, b.abilities?.dex), con: pick(a.abilities?.con, b.abilities?.con), int: pick(a.abilities?.int, b.abilities?.int), wis: pick(a.abilities?.wis, b.abilities?.wis), cha: pick(a.abilities?.cha, b.abilities?.cha) };
    const savingThrows: any = {};
    const allSaves = { ...(b.savingThrows || {}), ...(a.savingThrows || {}) } as any;
    Object.keys(allSaves).forEach((k) => { (savingThrows as any)[k] = allSaves[k]; });
    const skills = { ...(b.skills || {}), ...(a.skills || {}) };
    const senses = { ...(b.senses || {}), ...(a.senses || {}) };
    const speed = { ...(b.speed || {}), ...(a.speed || {}) } as any;
    return {
      ...(b as any),
      ...(a as any),
      abilities,
      savingThrows,
      skills,
      senses,
      speed,
      armorClass: pick(a.armorClass, b.armorClass),
      hitPoints: pick(a.hitPoints, b.hitPoints),
      languages: pick(a.languages, b.languages),
      environment: pickArr(a.environment, b.environment),
      notes: pickArr(a.notes, b.notes),
      traits: combineArr(a.traits, b.traits),
      actions: combineArr(a.actions, b.actions),
      reactions: combineArr(a.reactions, b.reactions),
      legendaryActions: combineArr(a.legendaryActions, b.legendaryActions),
      lairActions: combineArr(a.lairActions, b.lairActions),
      regionalEffects: combineArr(a.regionalEffects, b.regionalEffects),
    } as MonsterDetail;
  }

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

  // If battle is started when entering Combat, default to initiative view once hydrated
  useEffect(() => {
    if (!hydrated) return;
    if (battleStarted) {
      setViewMode((prev) => (prev === 'participants' ? 'initiative' : prev));
    }
  }, [hydrated, battleStarted]);

  // Load skyline overlay settings (initiative strip) when campaign changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!campaign?.id) { setShowInitiativeStrip(false); return; }
        const s = await getSkylineOverlaySettings(campaign.id);
        if (!cancelled) setShowInitiativeStrip(!!s.showInitiativeStrip);
      } catch { if (!cancelled) setShowInitiativeStrip(false); }
    })();
    return () => { cancelled = true; };
  }, [campaign?.id]);

  // Cargar detalles del bestiario para enemigos con fallback a EN si ES está incompleto
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || []);
      for (const p of base) {
        if (p.role !== 'foe') continue;
        if (p.kind === 'character') continue; // si es personaje, no hace falta bestiario
        if (monsterDetailByPid[p.id] !== undefined) continue;
        try {
          dbg('Participant', { id: p.id, name: p.name, manualId: p.monsterManualId, slug: p.monsterSlug });
          let manualId = p.monsterManualId;
          let slug = p.monsterSlug;
          if (!manualId || !slug) {
            const baseName = stripGroupSuffix(p.name || '');
            const key = baseName.trim().toLowerCase();
            const ref = monsterIndexByName.get(key);
            if (ref) { manualId = ref.manualId; slug = ref.slug; }
            dbg('Resolved by base name', { baseName, ref });
          }
          if (!manualId || !slug) {
            // No se pudo resolver; marcamos como null para evitar bucles
            dbg('Resolution failed, marking null');
            if (!cancelled) setMonsterDetailByPid((prev) => ({ ...prev, [p.id]: null }));
            continue;
          }
          const esMd = await fetchMonster(manualId, slug, 'es').catch(() => null);
          dbg('ES fetch result', esMd ? { traits: esMd.traits?.length, actions: esMd.actions?.length, senses: esMd.senses ? Object.keys(esMd.senses).length : 0, skills: esMd.skills ? Object.keys(esMd.skills).length : 0 } : 'null');
          let finalMd: MonsterDetail | null = esMd as any;
          if (needsEnglishFallback(finalMd)) {
            dbg('ES incomplete, fetching EN fallback');
            const enMd = await fetchMonster(manualId, slug, 'en').catch(() => null);
            dbg('EN fetch result', enMd ? { traits: enMd.traits?.length, actions: enMd.actions?.length, senses: enMd.senses ? Object.keys(enMd.senses).length : 0, skills: enMd.skills ? Object.keys(enMd.skills).length : 0 } : 'null');
            finalMd = mergeMonsterDetails(esMd as any, enMd as any);
            dbg('Merged result', finalMd ? { traits: finalMd.traits?.length, actions: finalMd.actions?.length, sampleTrait: finalMd.traits?.[0], sampleAction: finalMd.actions?.[0] } : 'null');
          }
          if (!cancelled) setMonsterDetailByPid((prev) => ({ ...prev, [p.id]: finalMd }));
        } catch (err: any) {
          dbg('Error fetching/merging', err?.message || err);
          if (!cancelled) setMonsterDetailByPid((prev) => ({ ...prev, [p.id]: null }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [participantsDraft, selectedEncounter?.id, monsterDetailByPid, monsterIndexByName]);

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
        try {
          await api.post(`/soundtrack/songs/${songId}/played`, null, { headers: getAuthHeaders(), params: campaign?.id ? { campaignId: campaign.id } : undefined });
        } catch {}
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

  // Persist battle state to server for Skyline web
  useEffect(() => {
    const cid = campaign?.id;
    if (!cid) return;
    // Debounce updates slightly
    const t = setTimeout(() => {
      // Build initiative strip items in the same order used for broadcast
      const maxItems = 10;
      const turnIdx = Math.max(0, Math.min(orderedParticipants.length - 1, turnIndex));
      const orderedByTurn = [...orderedParticipants.slice(turnIdx), ...orderedParticipants.slice(0, turnIdx)];
      const items = orderedByTurn.slice(0, maxItems).map((p) => ({
        id: p.id,
        name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
        imageUrl: (p.role !== 'foe' && p.kind === 'character') ? (charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null) : null,
      }));
      const payload: any = {
        started: !!battleStarted,
        encounterId: activeEncounterId || null,
        round,
        turnIndex: turnIndex,
        currentTurnId: currentTurnId || null,
        items,
      };
      setCampaignBattleState(cid, payload).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [campaign?.id, battleStarted, activeEncounterId, round, turnIndex, currentTurnId, orderedParticipants, enemyDisplayNameById, charMap]);

  // Broadcast initiative strip updates to Skyline
  useEffect(() => {
    const cid = campaign?.id;
    if (!cid) return;
    const enabled = showInitiativeStrip && battleStarted;
    const maxItems = 10;
    const turnIdx = Math.max(0, Math.min(orderedParticipants.length - 1, turnIndex));
    const orderedByTurn = enabled ? [...orderedParticipants.slice(turnIdx), ...orderedParticipants.slice(0, turnIdx)] : [];
    const payload = {
      type: 'initiativeStripUpdated',
      campaignId: cid,
      battleStarted,
      enabled: showInitiativeStrip,
      currentTurnId: currentTurnId || null,
      items: orderedByTurn.slice(0, maxItems).map((p) => ({
        id: p.id,
        name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
        imageUrl: (p.role !== 'foe' && p.kind === 'character') ? (charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null) : null,
      })),
      at: Date.now(),
    } as const;
    try { localStorage.setItem('app.skyline.initiativeStrip', JSON.stringify(payload)); } catch {}
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage(payload);
        bc.close();
      }
    } catch {}
  }, [campaign?.id, showInitiativeStrip, battleStarted, orderedParticipants, turnIndex, currentTurnId, enemyDisplayNameById, charMap]);

  /**
   * Renderiza una ficha de detalle compacta para un participante de combate.
   * Muestra nombre, rol, iniciativa y barra de HP (incluye Temp HP para aliados).
   * colorKey controla el color de acento de la ficha.
   */
  const DetailCard: React.FC<{ participant?: EncounterSummary['participants'][number] | null; colorKey?: 'primary' | 'secondary' }> = ({ participant, colorKey = 'primary' }) => {
    if (!participant) {
      return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, flex: '1 1 320px', minWidth: 280 }}>
          <Typography variant="body2" color="text.secondary">Sin selección</Typography>
        </Paper>
      );
    }
    const isEnemy = participant.role === 'foe';
    const isAlly = !isEnemy;
    const char = isAlly && participant.kind === 'character' ? charMap.get(participant.id) : undefined;
    const ch = isAlly ? (char?.currentHp ?? participant.currentHp) : (typeof participant.currentHp === 'number' ? participant.currentHp : undefined);
    const mx = isAlly ? (char?.maxHp ?? participant.maxHp) : (typeof participant.maxHp === 'number' ? participant.maxHp : undefined);
    const temp = isAlly ? (char?.tempHp) : undefined;
    const hasCh = typeof ch === 'number' && !Number.isNaN(ch as any);
    const hasMx = typeof mx === 'number' && !Number.isNaN(mx as any) && (mx as number) > 0;
    const percent = hasCh && hasMx ? Math.max(0, Math.min(100, (Number(ch) / Number(mx)) * 100)) : undefined;

    const md = isEnemy && participant.kind !== 'character' ? monsterDetailByPid[participant.id] : undefined;
    const armorClass = isAlly ? char?.armorClass : md?.armorClass?.value;
    const speedStrAlly = char?.speed;
    const speedStrEnemy = md?.speed ? Object.entries(md.speed).filter(([_, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v} ft`).join(', ') : undefined;

    const skillNameEs: Record<string, string> = {
      athletics: 'Atletismo', acrobatics: 'Acrobacias', sleightOfHand: 'Juego de manos', stealth: 'Sigilo',
      arcana: 'Arcanos', history: 'Historia', investigation: 'Investigación', nature: 'Naturaleza', religion: 'Religión',
      animalHandling: 'Manejo de animales', insight: 'Perspicacia', medicine: 'Medicina', perception: 'Percepción', survival: 'Supervivencia',
      deception: 'Engaño', intimidation: 'Intimidación', performance: 'Interpretación', persuasion: 'Persuasión'
    };
    const prettySkill = (k: string) => {
      const key = k.trim().replace(/\s+/g, '').toLowerCase();
      // Intentar normalizar claves comunes
      const mapAlt: Record<string, string> = { 'sleightofhand': 'sleightOfHand', 'animalhandling': 'animalHandling', 'passiveperception': 'perception' };
      const norm = mapAlt[key] || key;
      return skillNameEs[norm] || k;
    };
    const senseNameEs: Record<string, string> = {
      darkvision: 'Visión en la oscuridad', blindsight: 'Vista ciega', tremorsense: 'Sentido de vibración', truesight: 'Vista verdadera', passivePerception: 'Percepción pasiva'
    } as any;
    const prettySense = (k: string) => senseNameEs[k as any] || k;

    return (
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, borderColor: `${colorKey}.main`, borderWidth: 1, borderStyle: 'solid', flex: '1 1 320px', minWidth: 280 }}>
        <Stack spacing={0.75}>
          <Typography variant="body1">{isEnemy ? (enemyDisplayNameById[participant.id] || participant.name) : participant.name}</Typography>
          <Typography variant="caption" color="text.secondary">{(isEnemy ? 'Enemigo' : 'Aliado')} · Ini {participant.initiative ?? '—'}</Typography>
          {/* Sección: Datos de combate clave */}
          <Typography variant="caption" color="text.secondary">
            {typeof armorClass === 'number' ? `CA ${armorClass}` : ''}{participant.initiative !== undefined ? ` · Ini ${participant.initiative}` : ''}{(isAlly && speedStrAlly) ? ` · Vel ${speedStrAlly}` : ''}{(isEnemy && speedStrEnemy) ? ` · Vel ${speedStrEnemy}` : ''}
          </Typography>
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
          {/* Sección: Meta */}
          {isAlly && (
            <>
              <Divider />
              <Typography variant="subtitle2">Ficha del aliado</Typography>
              <Typography variant="caption" color="text.secondary">
                {(char?.className ? `Clase ${char.className}` : '')}{typeof char?.level === 'number' ? ` · Nivel ${char.level}` : ''}{char?.race ? ` · Raza ${char.race}` : ''}{char?.background ? ` · Trasfondo ${char.background}` : ''}{char?.alignment ? ` · Alineamiento ${char.alignment}` : ''}{char?.playerName ? ` · Jugador ${char.playerName}` : ''}
              </Typography>
              {/* Atributos */}
              {char && (
                <Typography variant="caption" color="text.secondary">
                  {typeof char.str === 'number' ? `STR ${char.str}` : ''}{typeof char.dex === 'number' ? ` · DEX ${char.dex}` : ''}{typeof char.con === 'number' ? ` · CON ${char.con}` : ''}{typeof char.int === 'number' ? ` · INT ${char.int}` : ''}{typeof char.wis === 'number' ? ` · WIS ${char.wis}` : ''}{typeof char.cha === 'number' ? ` · CHA ${char.cha}` : ''}
                </Typography>
              )}
              {/* Competencia y hechicería */}
              {char && (
                <Typography variant="caption" color="text.secondary">
                  {typeof char.proficiencyBonus === 'number' ? `PB +${char.proficiencyBonus}` : ''}{char.spellcastingAbility ? ` · Lanzamiento ${char.spellcastingAbility.toUpperCase()}` : ''}{typeof char.spellSaveDC === 'number' ? ` · CD Hechizo ${char.spellSaveDC}` : ''}{typeof char.spellAttackBonus === 'number' ? ` · Ataque Hechizo +${char.spellAttackBonus}` : ''}{char.hitDice ? ` · Dados de golpe ${char.hitDice}` : ''}
                </Typography>
              )}
              {/* Apariencia */}
              {char && (
                <Typography variant="caption" color="text.secondary">
                  {char.age ? `Edad ${char.age}` : ''}{char.height ? ` · Altura ${char.height}` : ''}{char.weight ? ` · Peso ${char.weight}` : ''}{char.eyes ? ` · Ojos ${char.eyes}` : ''}{char.skin ? ` · Piel ${char.skin}` : ''}{char.hair ? ` · Pelo ${char.hair}` : ''}
                </Typography>
              )}
              {/* Listas largas */}
              {char?.otherProficienciesAndLanguages && (
                <Typography variant="caption" color="text.secondary">Proficiencias e idiomas: {char.otherProficienciesAndLanguages}</Typography>
              )}
              {char?.equipment && (
                <Typography variant="caption" color="text.secondary">Equipo: {char.equipment}</Typography>
              )}
              {char?.traitsAndFeatures && (
                <Typography variant="caption" color="text.secondary">Rasgos y características: {char.traitsAndFeatures}</Typography>
              )}
              {char?.alliesAndOrganizations && (
                <Typography variant="caption" color="text.secondary">Aliados y organizaciones: {char.alliesAndOrganizations}</Typography>
              )}
              {char?.backstory && (
                <Typography variant="caption" color="text.secondary">Historia: {char.backstory}</Typography>
              )}
              {char?.treasure && (
                <Typography variant="caption" color="text.secondary">Tesoro: {char.treasure}</Typography>
              )}
              {/* Hechizos */}
              {(char?.cantrips?.length || (char?.spellsByLevel && Object.keys(char.spellsByLevel).length)) ? (
                <Stack spacing={0.5}>
                  {char?.cantrips?.length ? (
                    <Typography variant="caption" color="text.secondary">Trucos: {char.cantrips.join(', ')}</Typography>
                  ) : null}
                  {char?.spellsByLevel ? (
                    Object.entries(char.spellsByLevel).map(([lvl, names]) => (
                      <Typography key={lvl} variant="caption" color="text.secondary">Nivel {lvl}: {names.join(', ')}</Typography>
                    ))
                  ) : null}
                </Stack>
              ) : null}
            </>
          )}

          {isEnemy && (
            <>
              <Divider />
              <Typography variant="subtitle2">Ficha del enemigo</Typography>
              <Typography variant="caption" color="text.secondary">
                {md?.size ? `${md.size} ` : ''}{md?.type || ''}{md?.alignment ? `, ${md.alignment}` : ''}{md?.challengeRating ? ` • CR ${md.challengeRating}` : ''}{typeof md?.proficiencyBonus === 'number' ? ` • PB +${md.proficiencyBonus}` : ''}
              </Typography>
              {/* AC, HP, velocidad */}
              <Typography variant="caption" color="text.secondary">
                {typeof md?.armorClass?.value === 'number' ? `CA ${md.armorClass.value}${md.armorClass.type ? ` (${md.armorClass.type})` : ''}` : ''}{md?.hitPoints?.average ? ` · HP medio ${md.hitPoints.average}` : ''}{md?.hitPoints?.roll ? ` · HP dados ${md.hitPoints.roll}` : ''}{speedStrEnemy ? ` · Vel ${speedStrEnemy}` : ''}
              </Typography>
              {/* Habilidades y salvaciones */}
              {md?.abilities && (
                <Typography variant="caption" color="text.secondary">
                  {typeof md.abilities.str === 'number' ? `STR ${md.abilities.str}` : ''}{typeof md.abilities.dex === 'number' ? ` · DEX ${md.abilities.dex}` : ''}{typeof md.abilities.con === 'number' ? ` · CON ${md.abilities.con}` : ''}{typeof md.abilities.int === 'number' ? ` · INT ${md.abilities.int}` : ''}{typeof md.abilities.wis === 'number' ? ` · WIS ${md.abilities.wis}` : ''}{typeof md.abilities.cha === 'number' ? ` · CHA ${md.abilities.cha}` : ''}
                </Typography>
              )}
              {md?.savingThrows && (
                <Typography variant="caption" color="text.secondary">
                  Salvaciones: {Object.entries(md.savingThrows).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}
                </Typography>
              )}
              {md?.skills && Object.keys(md.skills).length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Habilidades: {Object.entries(md.skills).map(([k, v]) => `${prettySkill(k)} +${v}`).join(', ')}
                </Typography>
              )}
              {/* Resistencias e inmunidades */}
              {md?.damageVulnerabilities?.length ? (
                <Typography variant="caption" color="text.secondary">Vulnerabilidades: {md.damageVulnerabilities.join(', ')}</Typography>
              ) : null}
              {md?.damageResistances?.length ? (
                <Typography variant="caption" color="text.secondary">Resistencias: {md.damageResistances.join(', ')}</Typography>
              ) : null}
              {md?.damageImmunities?.length ? (
                <Typography variant="caption" color="text.secondary">Inmunidades: {md.damageImmunities.join(', ')}</Typography>
              ) : null}
              {md?.conditionImmunities?.length ? (
                <Typography variant="caption" color="text.secondary">Inmunidades de estado: {md.conditionImmunities.join(', ')}</Typography>
              ) : null}
              {/* Sentidos e idiomas */}
              {md?.senses && (
                <Typography variant="caption" color="text.secondary">
                  Sentidos: {Object.entries(md.senses).map(([k, v]) => `${prettySense(k)}: ${v}`).join(', ')}
                </Typography>
              )}
              {md?.languages && (
                <Typography variant="caption" color="text.secondary">Idiomas: {md.languages}</Typography>
              )}
              {/* Entorno y notas */}
              {md?.environment?.length ? (
                <Typography variant="caption" color="text.secondary">Entorno: {md.environment.join(', ')}</Typography>
              ) : null}
              {md?.notes?.length ? (
                <Stack spacing={0.25}>
                  {md.notes.map((n, i) => (
                    <Typography key={i} variant="caption" color="text.secondary">Nota: {n}</Typography>
                  ))}
                </Stack>
              ) : null}
              {/* Rasgos y acciones completas */}
              {md?.traits?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Rasgos:</Typography>
                  {md.traits.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
              {md?.actions?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Acciones:</Typography>
                  {md.actions.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
              {md?.reactions?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Reacciones:</Typography>
                  {md.reactions.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
              {md?.legendaryActions?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Acciones legendarias:</Typography>
                  {md.legendaryActions.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
              {md?.lairActions?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Acciones de guarida:</Typography>
                  {md.lairActions.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
              {md?.regionalEffects?.length ? (
                <Stack spacing={0.25}>
                  <Typography variant="caption" color="text.secondary">Efectos regionales:</Typography>
                  {md.regionalEffects.map((t, i) => {
                    const text = (t as any)?.text || t.desc;
                    const name = t.name;
                    return (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {name ? `${name}: ` : ''}{text}
                      </Typography>
                    );
                  })}
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </Paper>
    );
  };

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
              value={(activeMapId && maps.some(m => m.id === activeMapId)) ? activeMapId : ''}
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
              value={(activeEncounterId && encounters.some(e => e.id === activeEncounterId)) ? activeEncounterId : ''}
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
          <FormControlLabel
            control={<Switch checked={showInitiativeStrip} onChange={async (_, v) => {
              setShowInitiativeStrip(v);
              try {
                if (campaign?.id) {
                  await setSkylineOverlaySettings(campaign.id, { showInitiativeStrip: v });
                  // Notify other windows
                  try { localStorage.setItem('app.skyline.settingsUpdated', JSON.stringify({ campaignId: campaign.id, showInitiativeStrip: v, at: Date.now() })); } catch {}
                  try {
                    if ('BroadcastChannel' in window) {
                      const bc = new BroadcastChannel('campaign-sync');
                      bc.postMessage({ type: 'skylineSettingsChanged', campaignId: campaign.id, settings: { showInitiativeStrip: v } });
                      bc.close();
                    }
                  } catch {}
                }
              } catch {}
            }} />}
            label="Tira de iniciativa en Skyline"
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

      {/* Sección unificada con pestañas para alternar Participantes y Orden por iniciativa */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={viewMode} onChange={(_, val) => setViewMode(val)}>
            <Tab value="participants" label="Participantes" />
            <Tab value="initiative" label="Orden por iniciativa" />
          </Tabs>
        </Box>
        {viewMode === 'participants' && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems={'center'}>
              <Typography variant="subtitle1">Participantes</Typography>
              {!isMaster && <Chip size="small" label="Solo lectura" />}
            </Stack>
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
        )}
        {viewMode === 'initiative' && (
          <>
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
            const isCurrentTurn = p.id === currentTurnId;
            const isSelected = p.id === selectedParticipantId;
            const borderColor = isCurrentTurn ? 'primary.main' : (isSelected ? 'secondary.main' : 'divider');
            return (
              <Box key={p.id} sx={{ flex: '1 1 280px', minWidth: 240, maxWidth: 360 }}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, borderRadius: 1, borderColor, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedParticipantId(p.id);
                    try {
                      const baseName = stripGroupSuffix(p.name || '');
                      const md = isEnemy && p.kind !== 'character' ? (monsterDetailByPid[p.id] || null) : null;
                      const mdSummary = md ? {
                        traits: md.traits?.length || 0,
                        actions: md.actions?.length || 0,
                        reactions: md.reactions?.length || 0,
                        legendaryActions: md.legendaryActions?.length || 0,
                        lairActions: md.lairActions?.length || 0,
                        regionalEffects: md.regionalEffects?.length || 0,
                        senses: md.senses ? Object.keys(md.senses).length : 0,
                        skills: md.skills ? Object.keys(md.skills).length : 0,
                        languages: md.languages ? 1 : 0,
                        sampleTrait: md.traits?.[0],
                        sampleAction: md.actions?.[0],
                      } : null;
                      const char = isAlly && p.kind === 'character' ? charMap.get(p.id) : undefined;
                      const ch = isAlly ? (char?.currentHp ?? p.currentHp) : (typeof p.currentHp === 'number' ? p.currentHp : undefined);
                      const mx = isAlly ? (char?.maxHp ?? p.maxHp) : (typeof p.maxHp === 'number' ? p.maxHp : undefined);
                      const temp = isAlly ? (char?.tempHp) : undefined;
                      console.log('[CombatView][Select]', {
                        participant: {
                          id: p.id,
                          name: p.name,
                          displayName: isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name,
                          role: p.role,
                          kind: p.kind,
                          initiative: p.initiative,
                          currentHp: ch,
                          maxHp: mx,
                          tempHp: temp,
                        },
                        enemyResolution: isEnemy ? {
                          manualId: (p as any).monsterManualId,
                          slug: (p as any).monsterSlug,
                          baseName,
                          detailLoaded: !!md,
                          detailSummary: mdSummary,
                        } : undefined,
                      });
                    } catch {}
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedParticipantId(p.id);
                      try {
                        const baseName = stripGroupSuffix(p.name || '');
                        const md = isEnemy && p.kind !== 'character' ? (monsterDetailByPid[p.id] || null) : null;
                        const mdSummary = md ? {
                          traits: md.traits?.length || 0,
                          actions: md.actions?.length || 0,
                          reactions: md.reactions?.length || 0,
                          legendaryActions: md.legendaryActions?.length || 0,
                          lairActions: md.lairActions?.length || 0,
                          regionalEffects: md.regionalEffects?.length || 0,
                          senses: md.senses ? Object.keys(md.senses).length : 0,
                          skills: md.skills ? Object.keys(md.skills).length : 0,
                          languages: md.languages ? 1 : 0,
                          sampleTrait: md.traits?.[0],
                          sampleAction: md.actions?.[0],
                        } : null;
                        const char = isAlly && p.kind === 'character' ? charMap.get(p.id) : undefined;
                        const ch = isAlly ? (char?.currentHp ?? p.currentHp) : (typeof p.currentHp === 'number' ? p.currentHp : undefined);
                        const mx = isAlly ? (char?.maxHp ?? p.maxHp) : (typeof p.maxHp === 'number' ? p.maxHp : undefined);
                        const temp = isAlly ? (char?.tempHp) : undefined;
                        console.log('[CombatView][Select]', {
                          participant: {
                            id: p.id,
                            name: p.name,
                            displayName: isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name,
                            role: p.role,
                            kind: p.kind,
                            initiative: p.initiative,
                            currentHp: ch,
                            maxHp: mx,
                            tempHp: temp,
                          },
                          enemyResolution: isEnemy ? {
                            manualId: (p as any).monsterManualId,
                            slug: (p as any).monsterSlug,
                            baseName,
                            detailLoaded: !!md,
                            detailSummary: mdSummary,
                          } : undefined,
                        });
                      } catch {}
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">{isEnemy ? (enemyDisplayNameById[p.id] || p.name) : p.name}</Typography>
                      {isCurrentTurn && <Chip size="small" label="Turno actual" color="primary" />}
                      {isSelected && !isCurrentTurn && <Chip size="small" label="Seleccionado" color="secondary" />}
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
          {/* Fichas de detalle: mostrar abajo de la lista de iniciativa */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <DetailCard participant={orderedParticipants.find(p => p.id === currentTurnId) || null} colorKey="primary" />
            <DetailCard participant={orderedParticipants.find(p => p.id === selectedParticipantId) || null} colorKey="secondary" />
          </Stack>
          </>
        )}
      </Paper>
    </Stack>
  );
}
