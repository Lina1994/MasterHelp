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
import type { TokenCandidate } from '../../components/Map/ProjectedMapMirrorTools';
import { useMapTokens } from '../../hooks/useMapTokens';
import { useActiveEncounter } from '../../components/Encounter/ActiveEncounterContext';
import { useActiveMap } from '../../components/Map/ActiveMapContext';
import { listMaps, MapItemDto, getMapImageUrlSized } from '../../api/maps';
import { useEncounterMusic } from '../../hooks/useEncounterMusic';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';
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
import { useSkylineInitiativeSync } from '../../hooks/useSkylineInitiativeSync';
import CombatNotesBox from './CombatNotesBox';
import CombatHeader from './CombatHeader';
import InitiativePanel from './InitiativePanel';
import ParticipantsPanel from './ParticipantsPanel';
import DetailCard from './DetailCard';
import { useCombatNotes } from '../../hooks/useCombatNotes';
import { computeEnemyDisplayNameById, prettySkill, prettySense, stripGroupSuffix } from './utils';
import type { GridSettings } from '../../components/Map/MapGridOverlay';
import { allocateTokenCells } from '../../utils/tokenPlacement';

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

  // Notas de combate por participante
  const { getNote, upsertNoteForParticipant, updateNoteForParticipant, removeNoteForParticipant, clearAllNotes, incrementForParticipant, advanceTurnForParticipant } = useCombatNotes(campaign?.id, activeEncounterId);

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

  // stripGroupSuffix moved to utils.ts

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

  // indexToLetters moved to utils.ts

  const enemyDisplayNameById = useMemo(() => computeEnemyDisplayNameById(foes), [foes]);
  // Tokens: allow preparing tokens for current encounter participants
  const { tokens, addToken } = useMapTokens(campaign?.id, activeMapId || undefined);
  const [activeMapNaturalSize, setActiveMapNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const gridSettingsForPlacement = useMemo<GridSettings>(() => {
    try {
      const raw = localStorage.getItem('app.map.grid.settings');
      const parsed = raw ? (JSON.parse(raw) as Partial<GridSettings>) : {};
      return {
        enabled: !!parsed.enabled,
        type: (parsed.type === 'hex' ? 'hex' : 'square'),
        cellSize: typeof parsed.cellSize === 'number' && parsed.cellSize > 0 ? parsed.cellSize : 40,
        color: typeof parsed.color === 'string' ? parsed.color : '#FFFFFF',
        opacity: typeof parsed.opacity === 'number' ? parsed.opacity : 0.4,
        lineWidth: typeof parsed.lineWidth === 'number' ? parsed.lineWidth : 1,
      };
    } catch {
      return { enabled: false, type: 'square', cellSize: 40, color: '#FFFFFF', opacity: 0.4, lineWidth: 1 };
    }
  }, [campaign?.id]);

  const prepareTokens = useCallback((which: 'all' | 'allies' | 'foes') => {
    const list = which === 'all' ? baseParticipants : which === 'allies' ? allies : foes;
    const occupied = new Set<string>((tokens || []).map(t => t.cellKey));

    const projectionSize = (() => {
      try {
        const raw = localStorage.getItem('app.projection.size');
        const v = raw ? JSON.parse(raw) : null;
        const w = Number(v?.width);
        const h = Number(v?.height);
        return (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) ? { width: w, height: h } : null;
      } catch {
        return null;
      }
    })();

    const activeTransform = (() => {
      const m = maps.find(mm => mm.id === activeMapId);
      const t = (m as any)?.transform || null;
      return {
        zoom: Number.isFinite(Number(t?.zoom)) ? Number(t.zoom) : 1,
        rotationDeg: Number.isFinite(Number(t?.rotationDeg)) ? Number(t.rotationDeg) : 0,
        translateXPct: Number.isFinite(Number(t?.translateXPct)) ? Number(t.translateXPct) : 0,
        translateYPct: Number.isFinite(Number(t?.translateYPct)) ? Number(t.translateYPct) : 0,
      };
    })();

    const visibleRectPx = (() => {
      const W = activeMapNaturalSize?.w;
      const H = activeMapNaturalSize?.h;
      if (!W || !H) return null;
      if (!projectionSize) return null;

      const zoom = Math.max(0.05, activeTransform.zoom || 1);
      let vw = projectionSize.width / zoom;
      let vh = projectionSize.height / zoom;

      const rot = ((((activeTransform.rotationDeg || 0) % 360) + 360) % 360);
      if (rot === 90 || rot === 270) {
        const tmp = vw; vw = vh; vh = tmp;
      }

      // Translation is stored as percent of the map element size.
      // Positive translate moves the map right/down on screen, so the visible center in map coords shifts left/up.
      const centerX = (W / 2) - (activeTransform.translateXPct / 100) * W;
      const centerY = (H / 2) - (activeTransform.translateYPct / 100) * H;

      return {
        minX: centerX - vw / 2,
        maxX: centerX + vw / 2,
        minY: centerY - vh / 2,
        maxY: centerY + vh / 2,
      };
    })();

    const placements = allocateTokenCells({
      gridSettings: gridSettingsForPlacement,
      count: list.length,
      occupiedCellKeys: occupied,
      widthPx: activeMapNaturalSize?.w,
      heightPx: activeMapNaturalSize?.h,
      anchorCellKey: '0:0',
      visibleRectPx,
    });

    list.forEach((p, idx) => {
      const type = p.role === 'foe' ? 'enemy' as const : 'ally' as const;
      const label = (p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name) as string;
      const idStr = (p && (p as any).id) ? `${(p as any).id}` : (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const cellKey = placements[idx] || '0:0';
      addToken({ id: idStr, type, label, cellKey });
    });
  }, [baseParticipants, allies, foes, addToken, tokens, gridSettingsForPlacement, activeMapNaturalSize, maps, activeMapId, enemyDisplayNameById]);

  const createTokenForParticipant = useCallback((p: EncounterSummary['participants'][number]) => {
    if (!p) return;
    const type = p.role === 'foe' ? 'enemy' as const : 'ally' as const;
    const label = (p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name) as string;
    const idStr = p.id ? `${p.id}` : (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const occupied = new Set<string>((tokens || []).map(t => t.cellKey));
    const projectionSize = (() => {
      try {
        const raw = localStorage.getItem('app.projection.size');
        const v = raw ? JSON.parse(raw) : null;
        const w = Number(v?.width);
        const h = Number(v?.height);
        return (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) ? { width: w, height: h } : null;
      } catch {
        return null;
      }
    })();
    const activeTransform = (() => {
      const m = maps.find(mm => mm.id === activeMapId);
      const t = (m as any)?.transform || null;
      return {
        zoom: Number.isFinite(Number(t?.zoom)) ? Number(t.zoom) : 1,
        rotationDeg: Number.isFinite(Number(t?.rotationDeg)) ? Number(t.rotationDeg) : 0,
        translateXPct: Number.isFinite(Number(t?.translateXPct)) ? Number(t.translateXPct) : 0,
        translateYPct: Number.isFinite(Number(t?.translateYPct)) ? Number(t.translateYPct) : 0,
      };
    })();
    const visibleRectPx = (() => {
      const W = activeMapNaturalSize?.w;
      const H = activeMapNaturalSize?.h;
      if (!W || !H) return null;
      if (!projectionSize) return null;
      const zoom = Math.max(0.05, activeTransform.zoom || 1);
      let vw = projectionSize.width / zoom;
      let vh = projectionSize.height / zoom;
      const rot = ((((activeTransform.rotationDeg || 0) % 360) + 360) % 360);
      if (rot === 90 || rot === 270) {
        const tmp = vw; vw = vh; vh = tmp;
      }
      const centerX = (W / 2) - (activeTransform.translateXPct / 100) * W;
      const centerY = (H / 2) - (activeTransform.translateYPct / 100) * H;
      return { minX: centerX - vw / 2, maxX: centerX + vw / 2, minY: centerY - vh / 2, maxY: centerY + vh / 2 };
    })();
    const cellKey = allocateTokenCells({
      gridSettings: gridSettingsForPlacement,
      count: 1,
      occupiedCellKeys: occupied,
      widthPx: activeMapNaturalSize?.w,
      heightPx: activeMapNaturalSize?.h,
      anchorCellKey: '0:0',
      visibleRectPx,
    })[0] || '0:0';
    addToken({ id: idStr, type, label, cellKey });
  }, [addToken, tokens, gridSettingsForPlacement, activeMapNaturalSize, maps, activeMapId, enemyDisplayNameById]);

  const tokenCandidates = useMemo(() => {
    return {
      allies: allies.map((p) => ({ id: p.id, label: p.name, type: 'ally' as const })),
      foes: foes.map((p) => ({ id: p.id, label: enemyDisplayNameById[p.id] || p.name, type: 'enemy' as const })),
    };
  }, [allies, foes, enemyDisplayNameById]);

  const existingTokenIds = useMemo(() => {
    return new Set<string>((tokens || []).map((t) => t.id));
  }, [tokens]);

  const onCreateTokenForCandidate = useCallback((candidate: TokenCandidate) => {
    const p = baseParticipants.find((pp) => pp.id === candidate.id);
    if (p) createTokenForParticipant(p);
  }, [baseParticipants, createTokenForParticipant]);

  useEffect(() => {
    setParticipantsDraft(selectedEncounter?.participants || []);
  }, [selectedEncounter?.id, selectedEncounter?.participants]);

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
        const existing = monsterDetailByPid[p.id];
        // If we already have a non-null detail, don't refetch.
        if (existing) continue;
        // If it is explicitly null, we generally don't retry to avoid loops.
        // We only retry when we now have enough data to resolve (e.g. index finished loading).
        if (existing === null) {
          const canRetryNow = !!(p.monsterManualId && p.monsterSlug) || (monsterIndexByName.size > 0);
          if (!canRetryNow) continue;
        }
        try {
          dbg('Participant', { id: p.id, name: p.name, manualId: p.monsterManualId, slug: p.monsterSlug });

          const candidates: Array<{ manualId: string; slug: string; reason: string }> = [];
          const seen = new Set<string>();
          const pushCandidate = (manualId?: string, slug?: string, reason?: string) => {
            if (!manualId || !slug) return;
            const key = `${manualId}:${slug}`;
            if (seen.has(key)) return;
            seen.add(key);
            candidates.push({ manualId, slug, reason: reason || 'unknown' });
          };

          // 1) Prefer stored reference.
          pushCandidate(p.monsterManualId, p.monsterSlug, 'stored');

          // 2) Try exact name lookup (helps legacy encounters without monsterManualId/slug).
          const rawName = (p.name || '').trim();
          const exactKey = rawName.toLowerCase();
          const exactRef = monsterIndexByName.get(exactKey);
          pushCandidate(exactRef?.manualId, exactRef?.slug, 'name:exact');

          // 3) Try stripping a trailing group suffix ("Zombie A", "Zombie AA", etc.).
          const strippedName = stripGroupSuffix(rawName).trim();
          if (strippedName && strippedName.toLowerCase() !== exactKey) {
            const strippedRef = monsterIndexByName.get(strippedName.toLowerCase());
            pushCandidate(strippedRef?.manualId, strippedRef?.slug, 'name:stripped');
          }

          if (!candidates.length) {
            // If the monsters index hasn't loaded yet, don't cache null; we'll try again once it's ready.
            if (monsterIndexByName.size === 0 && !(p.monsterManualId && p.monsterSlug)) {
              dbg('Resolution deferred (index not ready)', { rawName, strippedName });
              continue;
            }
            dbg('Resolution failed, marking null', { rawName, strippedName });
            if (!cancelled) setMonsterDetailByPid((prev) => ({ ...prev, [p.id]: null }));
            continue;
          }

          let finalMd: MonsterDetail | null = null;
          for (const c of candidates) {
            dbg('Trying candidate', c);
            const esMd = await fetchMonster(c.manualId, c.slug, 'es').catch(() => null);
            dbg('ES fetch result', esMd ? { traits: esMd.traits?.length, actions: esMd.actions?.length, senses: esMd.senses ? Object.keys(esMd.senses).length : 0, skills: esMd.skills ? Object.keys(esMd.skills).length : 0 } : 'null');
            if (esMd) {
              finalMd = esMd as any;
              if (needsEnglishFallback(finalMd)) {
                dbg('ES incomplete, fetching EN fallback');
                const enMd = await fetchMonster(c.manualId, c.slug, 'en').catch(() => null);
                dbg('EN fetch result', enMd ? { traits: enMd.traits?.length, actions: enMd.actions?.length, senses: enMd.senses ? Object.keys(enMd.senses).length : 0, skills: enMd.skills ? Object.keys(enMd.skills).length : 0 } : 'null');
                finalMd = mergeMonsterDetails(esMd as any, enMd as any);
                dbg('Merged result', finalMd ? { traits: finalMd.traits?.length, actions: finalMd.actions?.length, sampleTrait: finalMd.traits?.[0], sampleAction: finalMd.actions?.[0] } : 'null');
              }
              break;
            }
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

  const { startEncounterMusic, restorePreviousMusic } = useEncounterMusic({ campaignId: campaign?.id, selectedEncounter, songs, prioritizeEncounterMusic });
  const { mode: soundtrackMode } = useSoundtrackMode(campaign?.id || null);

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
    if (soundtrackMode === 'automatic') {
      await startEncounterMusic();
    }
  }, [resetToStart, setBattleStarted, startEncounterMusic, soundtrackMode]);

  const endBattle = useCallback(async () => {
    setBattleStarted(false);
    resetToStart();
    // Al finalizar (escapar o ganar), limpiar notas del combate
    try { clearAllNotes(); } catch {}
    if (soundtrackMode === 'automatic') {
      await restorePreviousMusic();
    }
  }, [resetToStart, setBattleStarted, clearAllNotes, restorePreviousMusic, soundtrackMode]);

  const nextTurn = useCallback(() => {
    nextTurnHook();
  }, [nextTurnHook]);

  const previousTurn = useCallback(() => {
    previousTurnHook();
  }, [previousTurnHook]);

  // Contador por participante: incrementar cuando ese participante recibe turno
  const prevTurnIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!battleStarted) return;
    const curr = currentTurnId || null;
    const prev = prevTurnIdRef.current;
    if (curr && curr !== prev) {
      try { advanceTurnForParticipant(curr); } catch {}
      prevTurnIdRef.current = curr;
    }
  }, [battleStarted, currentTurnId, advanceTurnForParticipant]);

  

  // Skyline sync (server persist + initiative strip broadcast)
  useSkylineInitiativeSync({
    campaignId: campaign?.id,
    battleStarted,
    encounterId: activeEncounterId || null,
    round,
    turnIndex,
    currentTurnId: currentTurnId || null,
    orderedParticipants,
    enemyDisplayNameById,
    charMap,
    showInitiativeStrip,
  });
  /**
   * Renderiza una ficha de detalle compacta para un participante de combate.
   * Muestra nombre, rol, iniciativa y barra de HP (incluye Temp HP para aliados).
   * colorKey controla el color de acento de la ficha.
   */
  

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <CombatHeader
          maps={maps}
          activeMapId={activeMapId}
          setActiveMapId={setActiveMapId}
          encounters={encounters}
          activeEncounterId={activeEncounterId}
          onSelectEncounter={handleSelectEncounter}
          prioritizeEncounterMusic={prioritizeEncounterMusic}
          setPrioritizeEncounterMusic={setPrioritizeEncounterMusic}
          fogEnabled={fogEnabled}
          setFogEnabled={setFogEnabled}
          showInitiativeStrip={showInitiativeStrip}
          onToggleInitiativeStrip={async (v) => {
            setShowInitiativeStrip(v);
            try {
              if (campaign?.id) {
                await setSkylineOverlaySettings(campaign.id, { showInitiativeStrip: v });
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
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Vista previa vinculada a la ventana de jugadores. Permite seleccionar otro mapa y encuentro sin salir de esta pantalla.
        </Typography>
        <Box sx={{ mt: 2 }}>
          {/* Hidden image loader to get natural map size for token autoplacement */}
          {activeMapId && (
            <AuthImage
              src={getMapImageUrlSized(activeMapId, 'full')}
              alt=""
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              onLoad={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                if (w && h) setActiveMapNaturalSize({ w, h });
              }}
            />
          )}
          <ProjectedMapMirror
            fogEnabled={fogEnabled}
            highlightTokenId={currentTurnId || null}
            onPrepareTokens={prepareTokens}
            tokenCandidates={tokenCandidates}
            existingTokenIds={existingTokenIds}
            onCreateTokenForCandidate={onCreateTokenForCandidate}
            tokenImageResolver={(id: string) => {
              const c = charMap.get(id);
              if (!c) return undefined;
              // Prefer explicit token image, fallback to character image
              return c.tokenImageUrl || c.characterImageUrl || undefined;
            }}
          />
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
          <ParticipantsPanel
            isMaster={isMaster}
            allies={allies}
            foes={foes}
            charMap={charMap}
            enemyDisplayNameById={enemyDisplayNameById}
            savingInitiative={savingInitiative}
            savingHp={savingHp}
            setHp={setHp}
            setHpLocal={setHpLocal}
            setInitiativeLocal={setInitiativeLocal}
            schedulePersistInitiative={schedulePersistInitiative}
            rollAllEnemiesInitiative={rollAllEnemiesInitiative}
            rollAllEnemiesHp={rollAllEnemiesHp}
            onCreateTokenForParticipant={createTokenForParticipant}
          />
        )}
        {viewMode === 'initiative' && (
          <>
            <InitiativePanel
              round={round}
              turnIndex={turnIndex}
              orderedParticipants={orderedParticipants}
              currentTurnId={currentTurnId || null}
              selectedParticipantId={selectedParticipantId}
              setSelectedParticipantId={(id) => setSelectedParticipantId(id)}
              battleStarted={!!battleStarted}
              onStartBattle={handleStartBattle}
              onEndBattle={endBattle}
              onPreviousTurn={previousTurn}
              onNextTurn={nextTurn}
              isMaster={isMaster}
              charMap={charMap}
              enemyDisplayNameById={enemyDisplayNameById}
              monsterDetailByPid={monsterDetailByPid}
              savingInitiative={savingInitiative}
              savingHp={savingHp}
              setHp={setHp}
              setHpLocal={setHpLocal}
              setInitiativeLocal={setInitiativeLocal}
              schedulePersistInitiative={schedulePersistInitiative}
            />
          {/* Fichas de detalle: mostrar abajo de la lista de iniciativa */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <DetailCard
              participant={orderedParticipants.find(p => p.id === currentTurnId) || null}
              colorKey="primary"
              charMap={charMap}
              monsterDetailByPid={monsterDetailByPid}
              enemyDisplayNameById={enemyDisplayNameById}
            />
            <DetailCard
              participant={orderedParticipants.find(p => p.id === selectedParticipantId) || null}
              colorKey="secondary"
              charMap={charMap}
              monsterDetailByPid={monsterDetailByPid}
              enemyDisplayNameById={enemyDisplayNameById}
            />
          </Stack>
          {/* Notas por participante: izquierda turno actual, derecha seleccionado */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <CombatNotesBox
              participantId={currentTurnId || null}
              note={getNote(currentTurnId)}
              battleStarted={!!battleStarted}
              currentRound={round}
              currentTurnIndex={turnIndex}
              onUpsert={upsertNoteForParticipant}
              onUpdate={updateNoteForParticipant}
              onRemove={removeNoteForParticipant}
            />
            <CombatNotesBox
              participantId={selectedParticipantId}
              note={getNote(selectedParticipantId)}
              battleStarted={!!battleStarted}
              currentRound={round}
              currentTurnIndex={turnIndex}
              onUpsert={upsertNoteForParticipant}
              onUpdate={updateNoteForParticipant}
              onRemove={removeNoteForParticipant}
            />
          </Stack>
          </>
        )}
      </Paper>
    </Stack>
  );
}
