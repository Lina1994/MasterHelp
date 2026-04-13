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
import { useSecondaryWindowSizes } from '../../hooks/useSecondaryWindowSizes';
import { useMapTokens } from '../../hooks/useMapTokens';
import { useActiveEncounter } from '../../components/Encounter/ActiveEncounterContext';
import { useActiveMap } from '../../components/Map/ActiveMapContext';
import { listMaps, MapItemDto, getMapImageUrlSized } from '../../api/maps';
import type { MapTokenPayload } from '../../api/maps';
import { useEncounterMusic } from '../../hooks/useEncounterMusic';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';
import { useBattleState } from '../../hooks/useBattleState';
import { useTurnOrder } from '../../hooks/useTurnOrder';
import { getCampaignMonster } from '../../api/bestiary/bestiaryApi';
import type { CampaignMonsterListItem, CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';
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

function readRuntimeFogEnabled(campaignId: string | undefined, mapId: string | null | undefined): boolean | null {
  if (!campaignId || !mapId) return null;
  try {
    const raw = localStorage.getItem('app.map.fog.enabled');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = parsed?.[`${campaignId}:${mapId}`];
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

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
  monsters: Array<CampaignMonsterListItem & { compositeId: string }>;
  // Ajustes de combate (compartidos con CombatSettingsView)
  prioritizeEncounterMusic: boolean;
  setPrioritizeEncounterMusic: (v: boolean) => void;
  showInitiativeStrip: boolean;
  onToggleInitiativeStrip: (v: boolean) => void;
}

const difficultyColor: Record<EncounterDifficulty, 'default' | 'success' | 'warning' | 'error'> = {
  'Fácil': 'success',
  'Medio': 'default',
  'Difícil': 'warning',
  'Mortal': 'error',
};

export default function CombatView({ 
  encounters, 
  isMaster, 
  campaign, 
  songs, 
  onUpdateEncounter, 
  characters, 
  onPatchCharacterLocal, 
  monsters,
  prioritizeEncounterMusic,
  setPrioritizeEncounterMusic,
  showInitiativeStrip,
  onToggleInitiativeStrip
}: CombatViewProps) {
  const { activeEncounterId, setActiveEncounterId } = useActiveEncounter();
  const [selectedMapName, setSelectedMapName] = useState<string>('Mapa activo');
  const [fogEnabled, setFogEnabled] = useState(false);
  const [participantsDraft, setParticipantsDraft] = useState<EncounterSummary['participants']>([]);
  const [savingInitiative, setSavingInitiative] = useState<Record<string, boolean>>({});
  const [savingHp, setSavingHp] = useState<Record<string, boolean>>({});
  const { activeMapId, setActiveMapId } = useActiveMap();
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const { battleStarted, setBattleStarted, hydrated } = useBattleState(campaign?.id, activeEncounterId);
  const { mode: windowSizeMode, customSizes } = useSecondaryWindowSizes();
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [monsterDetailByPid, setMonsterDetailByPid] = useState<Record<string, CampaignMonsterDetail | null>>({});
  const [viewMode, setViewMode] = useState<'participants' | 'initiative'>('participants');
  
  const participantsRef = React.useRef<EncounterSummary['participants']>([]);
  const turnAlignedRef = React.useRef<boolean>(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const mountTimeRef = React.useRef<number>(Date.now());
  
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
  const { round, index: turnIndex, currentId: currentTurnId, hydrated: turnHydrated, nextTurn: nextTurnHook, previousTurn: previousTurnHook, resetToStart, setIndex: setTurnIndex, setRound: setTurnRound } = useTurnOrder(sessionKey, orderedParticipants);

  // Notas de combate por participante
  const { getNote, upsertNoteForParticipant, updateNoteForParticipant, removeNoteForParticipant, clearAllNotes, incrementForParticipant, advanceTurnForParticipant } = useCombatNotes(campaign?.id, activeEncounterId);

  const baseParticipants = useMemo(() => (participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || [])), [participantsDraft, selectedEncounter]);
  const allies = useMemo(() => baseParticipants.filter((p) => p.role !== 'foe'), [baseParticipants]);
  const foes = useMemo(() => baseParticipants.filter((p) => p.role === 'foe'), [baseParticipants]);

  // Índice por nombre base (sin sufijo de letras) para resolver bestiario en enemigos repetidos
  const monsterIndexByName = useMemo(() => {
    const map = new Map<string, { id: string }>();
    (monsters || []).forEach((m) => {
      const key = (m.name || '').trim().toLowerCase();
      if (m.id && key) {
        if (!map.has(key)) map.set(key, { id: m.id });
      }
    });
    return map;
  }, [monsters]);

  // Debug helper (enable with localStorage.setItem('debugBestiary','1'))
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debugBestiary') === '1') console.debug('[CombatView][Bestiary]', ...args); } catch {} };

  // Wrapper para obtener monstruo desde el bestiario de campaña
  const fetchMonsterFromCampaign = useCallback(async (monsterCampaignId: string, lang: 'en' | 'es'): Promise<CampaignMonsterDetail | null> => {
    if (!campaign?.id) return null;
    try {
      const detail = await getCampaignMonster(campaign.id, monsterCampaignId, lang);
      return detail;
    } catch {
      return null;
    }
  }, [campaign?.id]);

  // stripGroupSuffix moved to utils.ts

  function needsEnglishFallback(md?: CampaignMonsterDetail | null): boolean {
    if (!md) return true;
    // Si faltan bloques clave o están vacíos, intentamos EN: acciones, rasgos, lenguajes, sentidos, habilidades
    const arraysHaveContent = (arr?: Array<{ name?: string; desc?: string }>) => !!(arr && arr.some(x => (x?.name && x?.name.trim()) || (x?.desc && x?.desc.trim())));
    const lacksArrays = !(arraysHaveContent(md.traits) || arraysHaveContent(md.actions) || arraysHaveContent(md.legendaryActions) || arraysHaveContent(md.lairActions) || arraysHaveContent(md.regionalEffects));
    const lacksLangSense = !(md.languages || (md.senses && Object.keys(md.senses).length));
    const lacksSkills = !(md.skills && Object.keys(md.skills).length);
    const lacksAbilities = !(md.abilities && Object.keys(md.abilities).length);
    return lacksArrays || lacksLangSense || lacksSkills || lacksAbilities;
  }

  function mergeMonsterDetails(primary?: CampaignMonsterDetail | null, fallback?: CampaignMonsterDetail | null): CampaignMonsterDetail | null {
    if (!primary && !fallback) return null;
    const a = primary || ({} as CampaignMonsterDetail);
    const b = fallback || ({} as CampaignMonsterDetail);
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
      // Preserve image fields from primary (already fetched with all fields)
      tokenImageUrl: pick(a.tokenImageUrl, b.tokenImageUrl),
      imageUrls: pick(a.imageUrls, b.imageUrls),
    } as CampaignMonsterDetail;
  }

  // indexToLetters moved to utils.ts

  const enemyDisplayNameById = useMemo(() => computeEnemyDisplayNameById(foes), [foes]);
  
  // Convert monster size string to TokenSize
  const normalizeSize = useCallback((sizeStr: string | undefined): import('../../api/maps').TokenSize => {
    if (!sizeStr) return 'medium';
    const normalized = sizeStr.toLowerCase().trim();
    if (normalized === 'tiny') return 'tiny';
    if (normalized === 'small') return 'small';
    if (normalized === 'medium') return 'medium';
    if (normalized === 'large') return 'large';
    if (normalized === 'huge') return 'huge';
    if (normalized === 'gargantuan') return 'gargantuan';
    return 'medium'; // Default fallback
  }, []);
  
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

  // Helper: Calculate rotation to face nearest rival
  const calculateRotationToNearestRival = useCallback((cellKey: string, tokenType: 'ally' | 'enemy', tokenSize: import('../../api/maps').TokenSize | undefined, existingTokens: MapTokenPayload[]): number => {
    const getCenterFromCell = (key: string, size: import('../../api/maps').TokenSize | undefined): { x: number; y: number } => {
      const [colStr, rowStr] = key.split(':');
      const col = parseInt(colStr, 10) || 0;
      const row = parseInt(rowStr, 10) || 0;
      const r = gridSettingsForPlacement.cellSize || 40;
      const tokenSize = size || 'medium';

      if (gridSettingsForPlacement.type === 'square') {
        // For square grids, large tokens are centered at the intersection point
        const offset = (() => {
          switch (tokenSize) {
            case 'tiny':
            case 'small':
            case 'medium':
              return { dx: r / 2, dy: r / 2 }; // Center of single cell
            case 'large':
              return { dx: r, dy: r }; // Intersection of 2x2 (1 cell offset)
            case 'huge':
              return { dx: r * 1.5, dy: r * 1.5 }; // Intersection of 3x3 (1.5 cells)
            case 'gargantuan':
              return { dx: r * 2, dy: r * 2 }; // Intersection of 4x4 (2 cells)
            default:
              return { dx: r / 2, dy: r / 2 };
          }
        })();
        return { x: col * r + offset.dx, y: row * r + offset.dy };
      } else {
        // Hex grid (flat-top)
        const hexR = r;
        const hexH = Math.sqrt(3) * hexR;
        const horizStep = 1.5 * hexR;
        const vertStep = hexH;
        const yOffset = (col % 2 === 0) ? 0 : hexH / 2;
        
        const baseX = col * horizStep + hexR;
        const baseY = row * vertStep + hexH / 2 + yOffset;
        
        switch (tokenSize) {
          case 'tiny':
          case 'small':
          case 'medium':
            return { x: baseX, y: baseY };
          case 'large':
            return { x: baseX + hexR * 0.5, y: baseY };
          case 'huge':
            return { x: baseX, y: baseY };
          case 'gargantuan':
            return { x: baseX + hexR * 0.5, y: baseY };
          default:
            return { x: baseX, y: baseY };
        }
      }
    };

    const tokenCenter = getCenterFromCell(cellKey, tokenSize);
    const targetType = tokenType === 'ally' ? 'enemy' : 'ally';
    let nearestRival: { token: MapTokenPayload; distance: number } | null = null;

    for (const rival of existingTokens) {
      if (rival.type !== targetType) continue;
      const rivalCenter = getCenterFromCell(rival.cellKey, rival.size);
      const dx = rivalCenter.x - tokenCenter.x;
      const dy = rivalCenter.y - tokenCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!nearestRival || distance < nearestRival.distance) {
        nearestRival = { token: rival, distance };
      }
    }

    if (nearestRival) {
      const rivalCenter = getCenterFromCell(nearestRival.token.cellKey, nearestRival.token.size);
      const dx = rivalCenter.x - tokenCenter.x;
      const dy = rivalCenter.y - tokenCenter.y;
      const angleRad = Math.atan2(dx, -dy);
      return (angleRad * 180 / Math.PI + 360) % 360;
    }

    return 0; // Default facing north if no rivals
  }, [gridSettingsForPlacement]);

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
      
      // Get size from monster details if enemy
      let size: import('../../api/maps').TokenSize = 'medium';
      // Check if this is a character (skip size lookup for characters)
      const isCharacter = p.kind === 'character' || charMap.has(p.id);
      if (p.role === 'foe' && !isCharacter) {
        const md = monsterDetailByPid[p.id];
        if (md?.size) {
          size = normalizeSize(md.size);
        }
      }
      
      const rotationDeg = calculateRotationToNearestRival(cellKey, type, size, tokens || []);
      addToken({ id: idStr, type, label, cellKey, rotationDeg, size });
    });
  }, [baseParticipants, allies, foes, addToken, tokens, gridSettingsForPlacement, activeMapNaturalSize, maps, activeMapId, enemyDisplayNameById, calculateRotationToNearestRival, monsterDetailByPid, normalizeSize, charMap]);

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
    
    // Get size from monster details if enemy
    let size: import('../../api/maps').TokenSize = 'medium';
    // Check if this is a character (skip size lookup for characters)
    const isCharacter = p.kind === 'character' || charMap.has(p.id);
    if (p.role === 'foe' && !isCharacter) {
      const md = monsterDetailByPid[p.id];
      if (md?.size) {
        size = normalizeSize(md.size);
      }
    }
    
    const rotationDeg = calculateRotationToNearestRival(cellKey, type, size, tokens || []);
    addToken({ id: idStr, type, label, cellKey, rotationDeg, size });
  }, [addToken, tokens, gridSettingsForPlacement, activeMapNaturalSize, maps, activeMapId, enemyDisplayNameById, calculateRotationToNearestRival, monsterDetailByPid, normalizeSize, charMap]);

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
        if (!campaign?.id) { 
          onToggleInitiativeStrip(false); 
          return; 
        }
        const s = await getSkylineOverlaySettings(campaign.id);
        if (!cancelled) {
          const newValue = !!s.showInitiativeStrip;
          // Only update if value actually changed to avoid unnecessary re-renders
          if (showInitiativeStrip !== newValue) {
            onToggleInitiativeStrip(newValue);
          }
        }
      } catch { 
        if (!cancelled) onToggleInitiativeStrip(false); 
      }
    })();
    return () => { cancelled = true; };
  }, [campaign?.id, onToggleInitiativeStrip, showInitiativeStrip]);

  // Mark as initialized after initial data is fully loaded
  // This prevents premature broadcasts to projection windows during mount
  useEffect(() => {
    // Once initialized, stay initialized (don't reset on encounter change)
    if (isInitialized) return;
    
    if (!hydrated) return;
    if (participantsDraft.length === 0 && selectedEncounter?.participants && selectedEncounter.participants.length > 0) {
      // Participants not yet loaded
      return;
    }
    
    // Check if we have monster details for all enemies
    const base = participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || []);
    const enemies = base.filter(p => p.role === 'foe' && p.kind !== 'character');
    
    if (enemies.length > 0) {
      // Check if all enemies have been processed (either loaded or marked as null)
      const allEnemiesProcessed = enemies.every(e => e.id in monsterDetailByPid);
      if (!allEnemiesProcessed) {
        // Some enemies still loading
        return;
      }
    }
    
    // All data ready - mark as initialized immediately
    // No artificial delay needed since useSkylineInitiativeSync already handles
    // preserving existing valid data during re-mounts
    setIsInitialized(true);
  }, [isInitialized, hydrated, participantsDraft, selectedEncounter?.participants, selectedEncounter?.id, monsterDetailByPid]);

  // Cargar detalles del bestiario para enemigos con fallback a EN si ES está incompleto
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = participantsDraft.length ? participantsDraft : (selectedEncounter?.participants || []);
      for (const p of base) {
        if (p.role !== 'foe') continue;
        // Skip if this is a character (check both kind and charMap)
        const isCharacter = p.kind === 'character' || charMap.has(p.id);
        if (isCharacter) continue;
        const existing = monsterDetailByPid[p.id];
        // If we already have a non-null detail, don't refetch.
        if (existing) continue;
        // If it is explicitly null, we generally don't retry to avoid loops.
        // We only retry when we now have enough data to resolve (e.g. index finished loading).
        if (existing === null) {
          const canRetryNow = !!(p.monsterCampaignId) || (monsterIndexByName.size > 0);
          if (!canRetryNow) continue;
        }
        try {
          dbg('Participant', { id: p.id, name: p.name, campaignId: p.monsterCampaignId });

          let monsterCampaignId: string | undefined = p.monsterCampaignId;

          // Si no tiene campaignId, intentar buscar por nombre en el índice
          if (!monsterCampaignId) {
            const rawName = (p.name || '').trim();
            const exactKey = rawName.toLowerCase();
            let exactRef = monsterIndexByName.get(exactKey);
            
            // Si no encuentra por nombre exacto, intentar sin sufijo de grupo
            if (!exactRef) {
              const strippedName = stripGroupSuffix(rawName).trim();
              if (strippedName && strippedName.toLowerCase() !== exactKey) {
                exactRef = monsterIndexByName.get(strippedName.toLowerCase());
              }
            }

            monsterCampaignId = exactRef?.id;
            dbg('Name lookup', { rawName, found: !!monsterCampaignId });
          }

          if (!monsterCampaignId) {
            // If the monsters index hasn't loaded yet, don't cache null; we'll try again once it's ready.
            if (monsterIndexByName.size === 0) {
              dbg('Resolution deferred (index not ready)');
              continue;
            }
            dbg('Resolution failed, marking null');
            if (!cancelled) setMonsterDetailByPid((prev) => ({ ...prev, [p.id]: null }));
            continue;
          }

          // Obtener detalles del monstruo desde el bestiario de campaña
          let finalMd: CampaignMonsterDetail | null = null;
          dbg('Fetching from campaign bestiary', { monsterCampaignId });
          const esMd = await fetchMonsterFromCampaign(monsterCampaignId, 'es');
          dbg('ES fetch result', esMd ? { traits: esMd.traits?.length, actions: esMd.actions?.length } : 'null');
          
          if (esMd) {
            finalMd = esMd;
            // Si está incompleto, intentar con inglés (aunque en campaña generalmente no aplica)
            if (needsEnglishFallback(finalMd)) {
              dbg('ES incomplete, fetching EN fallback');
              const enMd = await fetchMonsterFromCampaign(monsterCampaignId, 'en');
              dbg('EN fetch result', enMd ? { traits: enMd.traits?.length, actions: enMd.actions?.length } : 'null');
              finalMd = mergeMonsterDetails(esMd, enMd);
              dbg('Merged result', finalMd ? { traits: finalMd.traits?.length, actions: finalMd.actions?.length } : 'null');
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
  }, [participantsDraft, selectedEncounter?.id, monsterIndexByName, fetchMonsterFromCampaign]);

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

  // Sync fog default with the active map's fogEnabledByDefault setting
  useEffect(() => {
    const map = maps.find((m) => m.id === activeMapId);
    const runtime = readRuntimeFogEnabled(campaign?.id, activeMapId);
    if (map?.fogEnabledByDefault) {
      setFogEnabled(true);
      return;
    }
    setFogEnabled(runtime ?? false);
  }, [activeMapId, campaign?.id, maps]);

  const forceFogByDefault = useMemo(() => {
    const map = maps.find((m) => m.id === activeMapId);
    return !!map?.fogEnabledByDefault;
  }, [activeMapId, maps]);

  const handleFogEnabledChange = useCallback((next: boolean) => {
    if (forceFogByDefault && !next) {
      setFogEnabled(true);
      return;
    }
    setFogEnabled(next);
  }, [forceFogByDefault]);

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
    // Check if this is a character (either explicitly marked or found in charMap)
    const isCharacter = p.kind === 'character' || (p.id && charMap.has(p.id));
    if (isCharacter && p.id) {
      const payload: any = {};
      if (kind === 'currentHp') payload.currentHp = value;
      if (kind === 'tempHp') payload.tempHp = value;
      updateCharacterHp(p.id, payload);
    } else {
      if (kind === 'currentHp') setHpLocal(p.id, 'currentHp', value);
      schedulePersistInitiative(p.id);
    }
  }, [setHpLocal, schedulePersistInitiative, updateCharacterHp, charMap]);

  const { startEncounterMusic, restorePreviousMusic } = useEncounterMusic({ campaignId: campaign?.id, selectedEncounter, songs, prioritizeEncounterMusic });
  const { mode: soundtrackMode } = useSoundtrackMode(campaign?.id || null);

  // Roll de iniciativa para un único enemigo usando los detalles ya cargados
  const rollEnemyInitiative = useCallback(async (pid: string) => {
    const p = participantsDraft.find((pp) => pp.id === pid);
    if (!p) return;
    
    let mod = 0;
    const detail = monsterDetailByPid[pid];
    if (detail && detail.abilities?.dex) {
      const dex = detail.abilities.dex;
      mod = Math.floor((dex - 10) / 2);
    }
    
    const d20 = 1 + Math.floor(Math.random() * 20);
    const total = d20 + mod;
    setInitiativeLocal(pid, total);
    schedulePersistInitiative(pid);
  }, [participantsDraft, monsterDetailByPid, setInitiativeLocal, schedulePersistInitiative]);

  // Roll de iniciativa para todos los enemigos
  const rollAllEnemiesInitiative = useCallback(async () => {
    foes.forEach((p) => {
      let mod = 0;
      
      // Check if this enemy is actually a character
      const isCharacter = p.kind === 'character' || charMap.has(p.id);
      
      if (isCharacter) {
        // For enemy characters, use character's DEX modifier
        const char = charMap.get(p.id);
        if (char && typeof char.dex === 'number') {
          mod = Math.floor((char.dex - 10) / 2);
        }
      } else {
        // For monster enemies, use monster detail's DEX modifier
        const detail = monsterDetailByPid[p.id];
        if (detail && detail.abilities?.dex) {
          const dex = detail.abilities.dex;
          mod = Math.floor((dex - 10) / 2);
        }
      }
      
      const d20 = 1 + Math.floor(Math.random() * 20);
      const total = d20 + mod;
      setInitiativeLocal(p.id, total);
    });
    foes.forEach((p) => schedulePersistInitiative(p.id));
  }, [foes, charMap, monsterDetailByPid, setInitiativeLocal, schedulePersistInitiative]);

  // Roll de HP para todos los enemigos
  const rollAllEnemiesHp = useCallback(async (mode: 'avg' | 'dice') => {
    foes.forEach((p) => {
      // Skip character enemies - they already have HP defined
      const isCharacter = p.kind === 'character' || charMap.has(p.id);
      if (isCharacter) return;
      
      const detail = monsterDetailByPid[p.id];
      let value: number | undefined;
      
      if (detail?.hitPoints) {
        if (mode === 'avg') {
          value = detail.hitPoints.average;
        } else {
          // Intentar parsear el roll de dados
          const rollExpr = detail.hitPoints.roll;
          if (rollExpr) {
            const match = rollExpr.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/);
            if (match) {
              const dice = parseInt(match[1]);
              const sides = parseInt(match[2]);
              const mod = match[3] ? parseInt(match[3]) : 0;
              const rolls = Array.from({ length: dice }, () => 1 + Math.floor(Math.random() * sides));
              value = rolls.reduce((a, b) => a + b, 0) + mod;
            }
          }
          // Fallback a average si no se pudo parsear
          if (!value) value = detail.hitPoints.average;
        }
      }
      
      if (typeof value === 'number' && value > 0) {
        setHpLocal(p.id, 'maxHp', value);
        setHpLocal(p.id, 'currentHp', value);
        schedulePersistInitiative(p.id);
      }
    });
  }, [foes, charMap, monsterDetailByPid, setHpLocal, schedulePersistInitiative]);

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

  

  // ── Remote turn navigation (from SkylinePreviewOverlay) ────────────────────
  // Listens for 'turnNavRequest' BC messages posted by the overlay's prev/next
  // turn buttons, so the DM can advance turns without opening CombatPage.
  // We keep the hook functions in refs so the BC effect never needs to
  // re-subscribe when the (non-memoised) useTurnOrder functions change reference.
  const nextTurnRef = React.useRef(nextTurnHook);
  const prevTurnRef = React.useRef(previousTurnHook);
  useEffect(() => { nextTurnRef.current = nextTurnHook; });
  useEffect(() => { prevTurnRef.current = previousTurnHook; });

  useEffect(() => {
    const cid = campaign?.id;
    if (!cid) return;
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('campaign-sync');
        bc.onmessage = (e: MessageEvent) => {
          const data = e?.data;
          if (data?.type === 'turnNavRequest' && data?.campaignId === cid) {
            if (data.action === 'next') nextTurnRef.current();
            else if (data.action === 'previous') prevTurnRef.current();
          }
          // Sent by SkylinePreviewOverlay when the DM uses prev/next from any page.
          // We sync useTurnOrder state so CombatView stays in step if it is open.
          // setTurnIndex / setTurnRound are React useState setters — always stable.
          if (data?.type === 'skylineTurnNavApplied' && data?.campaignId === cid) {
            const { newTurnIndex, newRound } = data;
            if (typeof newTurnIndex === 'number' && typeof newRound === 'number') {
              setTurnIndex(newTurnIndex);
              setTurnRound(newRound);
            }
          }
        };
      }
    } catch {}
    return () => { try { bc?.close(); } catch {} };
  }, [campaign?.id]); // stable: only re-subscribe when campaign changes

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
    monsterDetailByPid,
    showInitiativeStrip,
    isInitialized,
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
          setFogEnabled={handleFogEnabledChange}
          showInitiativeStrip={showInitiativeStrip}
          onToggleInitiativeStrip={onToggleInitiativeStrip}
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
            onFogEnabledChange={handleFogEnabledChange}
            highlightTokenId={currentTurnId || null}
            onPrepareTokens={prepareTokens}
            tokenCandidates={tokenCandidates}
            existingTokenIds={existingTokenIds}
            onCreateTokenForCandidate={onCreateTokenForCandidate}
            useCustomSizes={windowSizeMode === 'custom'}
            customPlayersSize={customSizes.players}
            customSkylineSize={customSizes.skyline}
            tokenImageResolver={(id: string) => {
              // Try to find ally character first
              const c = charMap.get(id);
              if (c) {
                // Prefer explicit token image, fallback to character image
                return c.tokenImageUrl || c.characterImageUrl || undefined;
              }
              // Try to find enemy monster detail
              const md = monsterDetailByPid[id];
              if (md?.tokenImageUrl) {
                return md.tokenImageUrl;
              }
              return undefined;
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
            monsterDetailByPid={monsterDetailByPid}
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
