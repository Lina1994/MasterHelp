import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LayersIcon from '@mui/icons-material/Layers';
import SearchIcon from '@mui/icons-material/Search';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import ArticleIcon from '@mui/icons-material/Article';
import AddLinkIcon from '@mui/icons-material/AddLink';
import CastIcon from '@mui/icons-material/Cast';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../Campaign/CampaignContext';
import { getCurrentUser } from '../../utils/getCurrentUser';
import { listCharacters, type CharacterPayload } from '../../api/characters';
import { listMaps, type MapItemDto } from '../../api/maps';
import { setActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import CharacterSheetModal from './CharacterSheetModal';
import WorldpediaEntityViewer from '../Worldpedia/WorldpediaEntityViewer';
import {
  listAffinityLinks,
  createAffinityLink,
  updateAffinityLink,
  deleteAffinityLink,
  type AffinityLinkPayload,
} from '../../api/affinityLinks';

/* ─────────────────────── constants ─────────────────────── */

const NODE_RADIUS = 36;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
/** Extra padding around zone bounding boxes. */
const ZONE_PAD = 48;
/** Palette for zone fill/stroke colours. */
const ZONE_COLORS = [
  '#64b5f6', '#ef9a9a', '#a5d6a7', '#ffcc80', '#ce93d8',
  '#80deea', '#f48fb1', '#ffe082', '#bcaaa4', '#b0bec5',
];

/** Predefined palette for link colours. */
const LINK_COLORS = [
  '#90caf9', '#ef5350', '#66bb6a', '#ffa726', '#ab47bc',
  '#26c6da', '#ec407a', '#d4e157', '#8d6e63', '#78909c',
];

/** Sentiment scale: value → emoji mapping (from -3 to 3). */
const SENTIMENTS: { value: number; emoji: string; label: string }[] = [
  { value: -3, emoji: '😡', label: 'Odio' },
  { value: -2, emoji: '😤', label: 'Rencor' },
  { value: -1, emoji: '😒', label: 'Desconfianza' },
  { value: 0,  emoji: '😐', label: 'Indiferencia' },
  { value: 1,  emoji: '🤝', label: 'Respeto' },
  { value: 2,  emoji: '😊', label: 'Admiración' },
  { value: 3,  emoji: '❤️', label: 'Amor' },
];

/** Returns the emoji for a given sentiment value. */
function sentimentEmoji(value: number): string {
  return SENTIMENTS.find((s) => s.value === value)?.emoji ?? '😐';
}

/* ─────────────────────── types ─────────────────────── */

interface NodePos {
  id: string;
  x: number;
  y: number;
}

/* ─────────────────────── helpers ─────────────────────── */

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/** Generates initial positions, clustering characters by primaryMapId when present. */
/**
 * Minimum centre-to-centre distance between any two nodes.
 * Edge-to-edge gap = NODE_RADIUS * 2 = one full token diameter.
 */
const MIN_NODE_C2C = NODE_RADIUS * 6; // 216 px  (edge-to-edge gap ≈ 2 token diameters)

/**
 * Minimum edge-to-edge gap between any two zone bounding boxes, and between
 * any non-member character node edge and a zone bounding box edge.
 * = one full token diameter.
 */
const MIN_ZONE_GAP = NODE_RADIUS * 4; // 144 px

/**
 * Computes the minimum ring radius so that N nodes placed on the ring
 * have adjacent centres at least MIN_NODE_C2C apart.
 */
function minRingRadius(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(MIN_NODE_C2C / (2 * Math.sin(Math.PI / n)));
}

/**
 * Generates initial positions for all characters.
 *
 * Layout guarantees:
 *  1. PCs form a central "player zone". Their bbox is exclusive — no NPC node
 *     or NPC zone bbox may come closer than MIN_ZONE_GAP to its boundary.
 *  2. Only NPCs are grouped into map-based zones.  Zone bboxes must not
 *     overlap each other, and adjacent zone bboxes must have at least
 *     MIN_ZONE_GAP between their edges.
 *  3. An unzoned (non-member) character node must not overlap any zone bbox,
 *     not even partially; its edge must be at least MIN_ZONE_GAP outside it.
 *  4. Adjacent nodes within any ring / cluster have edge-to-edge >= one token
 *     diameter (MIN_NODE_C2C guarantees centre-to-centre >= 4×NODE_RADIUS).
 */
function layoutNodes(characters: CharacterPayload[], width: number, height: number): NodePos[] {
  const cx = width / 2;
  const cy = height / 2;
  const positions: NodePos[] = [];

  const pcs  = characters.filter((c) => c.kind === 'pc');
  const npcs = characters.filter((c) => c.kind === 'npc');

  // ── 1. PCs: central ring ────────────────────────────────────────────────
  const pcRingR = minRingRadius(pcs.length);
  pcs.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(pcs.length, 1) - Math.PI / 2;
    positions.push({ id: c.id!, x: cx + pcRingR * Math.cos(angle), y: cy + pcRingR * Math.sin(angle) });
  });

  // Outer boundary of the PC zone bbox.  NPC zone bbox inner edges must be
  // at least MIN_ZONE_GAP beyond this radius.
  const pcZoneBBoxR = pcRingR + NODE_RADIUS + ZONE_PAD;

  // ── 2. Group NPCs by zone ─────────────────────────────────────────────
  const npcZoneMap = new Map<string, CharacterPayload[]>();
  const unzonedNpcs: CharacterPayload[] = [];
  for (const ch of npcs) {
    const specific = (ch.associatedMapIds ?? []).filter((id) => id !== '__ALL__');
    const effectiveMapId = ch.primaryMapId ?? (specific.length === 1 ? specific[0] : null);
    if (effectiveMapId) {
      const arr = npcZoneMap.get(effectiveMapId) ?? [];
      arr.push(ch);
      npcZoneMap.set(effectiveMapId, arr);
    } else {
      unzonedNpcs.push(ch);
    }
  }
  const npcZones = Array.from(npcZoneMap.values());

  // ── 3. NPC zone clusters ───────────────────────────────────────────────
  if (npcZones.length > 0) {
    // "Extent" of each zone = how far its bbox boundary reaches from the zone centre.
    const zoneExtents = npcZones.map((chars) => minRingRadius(chars.length) + NODE_RADIUS + ZONE_PAD);
    const maxExtent   = Math.max(...zoneExtents);

    // Constraint (a): NPC zone bbox must be at least MIN_ZONE_GAP outside PC zone bbox.
    //   zoneOrbitR - maxExtent >= pcZoneBBoxR + MIN_ZONE_GAP
    //   => zoneOrbitR >= pcZoneBBoxR + maxExtent + MIN_ZONE_GAP
    const orbitFromPcZone = pcZoneBBoxR + maxExtent + MIN_ZONE_GAP;

    // Constraint (b): Adjacent NPC zone bboxes must be at least MIN_ZONE_GAP apart.
    //   Adjacent centres on the orbit ring: 2·R·sin(π/n)
    //   Edge-to-edge gap = 2·R·sin(π/n) − extent_i − extent_j ≥ MIN_ZONE_GAP
    //   Worst case (both have maxExtent):
    //   R ≥ (maxExtent + MIN_ZONE_GAP / 2) / sin(π / n)
    const orbitFromAdjacentZones = npcZones.length >= 2
      ? (maxExtent + MIN_ZONE_GAP / 2) / Math.sin(Math.PI / npcZones.length)
      : 0;

    const zoneOrbitR = Math.max(orbitFromPcZone, orbitFromAdjacentZones);

    npcZones.forEach((chars, idx) => {
      const angle = (2 * Math.PI * idx) / npcZones.length - Math.PI / 2;
      const zoneCx = cx + zoneOrbitR * Math.cos(angle);
      const zoneCy = cy + zoneOrbitR * Math.sin(angle);
      const clusterR = minRingRadius(chars.length);
      // Rotate the internal ring so characters spread *perpendicular* to the
      // center→zone axis.  This way affinity lines to PCs fan out instead of
      // stacking on top of each other.
      // E.g. zone directly above (angle = -π/2): startAngle = -π/2 + π/2 = 0
      //   → chars arranged left/right, not top/bottom → no vertical overlap.
      const startAngle = angle + Math.PI / 2;
      chars.forEach((ch, i) => {
        const a = (2 * Math.PI * i) / Math.max(chars.length, 1) + startAngle;
        positions.push({ id: ch.id!, x: zoneCx + clusterR * Math.cos(a), y: zoneCy + clusterR * Math.sin(a) });
      });
    });

    // ── 4. Unzoned NPCs: outer ring, strictly outside all zone bboxes ────
    // Worst case: an unzoned node aligns angularly with a zone centre.
    // Its inner edge (toward centre) = unzonedOrbitR − NODE_RADIUS.
    // That zone's outer bbox edge (from canvas centre) = zoneOrbitR + maxExtent.
    // Required: unzonedOrbitR − NODE_RADIUS ≥ zoneOrbitR + maxExtent + MIN_ZONE_GAP
    // => unzonedOrbitR ≥ zoneOrbitR + maxExtent + NODE_RADIUS + MIN_ZONE_GAP
    if (unzonedNpcs.length > 0) {
      const unzonedOrbitR = Math.max(
        minRingRadius(unzonedNpcs.length),
        pcZoneBBoxR     + NODE_RADIUS + MIN_ZONE_GAP,
        zoneOrbitR + maxExtent + NODE_RADIUS + MIN_ZONE_GAP,
      );
      unzonedNpcs.forEach((ch, i) => {
        const angle = (2 * Math.PI * i) / Math.max(unzonedNpcs.length, 1) - Math.PI / 2;
        positions.push({ id: ch.id!, x: cx + unzonedOrbitR * Math.cos(angle), y: cy + unzonedOrbitR * Math.sin(angle) });
      });
    }
  } else {
    // No NPC zones — place unzoned NPCs on a ring outside the PC zone.
    if (unzonedNpcs.length > 0) {
      const unzonedOrbitR = Math.max(
        minRingRadius(unzonedNpcs.length),
        pcZoneBBoxR + NODE_RADIUS + MIN_ZONE_GAP,
      );
      unzonedNpcs.forEach((ch, i) => {
        const angle = (2 * Math.PI * i) / Math.max(unzonedNpcs.length, 1) - Math.PI / 2;
        positions.push({ id: ch.id!, x: cx + unzonedOrbitR * Math.cos(angle), y: cy + unzonedOrbitR * Math.sin(angle) });
      });
    }
  }

  return positions;
}

/** Returns the initials from a character name (up to 2 chars). */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/* ─────────────────────── layout persistence (localStorage) ─────────────── */

/**
 * Attempts to load saved character positions for the given campaign from
 * localStorage.  Returns null if nothing is stored or the data is malformed.
 */
function loadSavedLayout(campaignId: string | number): NodePos[] | null {
  try {
    const raw = localStorage.getItem(`affinity_layout_${campaignId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as NodePos[];
  } catch {
    return null;
  }
}

/**
 * Persists current character positions for the given campaign to localStorage.
 */
function saveLayout(campaignId: string | number, positions: NodePos[]): void {
  try {
    localStorage.setItem(`affinity_layout_${campaignId}`, JSON.stringify(positions));
  } catch {
    // Ignore storage quota errors
  }
}

/* ─────────────────────── component ─────────────────────── */

/**
 * Interactive affinity chart (Xenoblade-style) that displays characters as
 * draggable nodes connected by labelled relationship lines.
 *
 * - PCs are placed in a central ring; NPCs surround them.
 * - Lines can be created, edited (label + colour), and deleted.
 * - Nodes can be repositioned by dragging.
 */
export default function AffinityChart() {
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { fetchCampaigns } = useCampaignsContext();
  const campaignId = activeCampaign?.id ?? null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

  /* ── data state ── */
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [links, setLinks] = useState<AffinityLinkPayload[]>([]);
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [positions, setPositions] = useState<NodePos[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── zones visibility toggle ── */
  const [showZones, setShowZones] = useState(true);

  /* ── drag state ── */
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  /** Tracks pointer position on node press to distinguish click from drag. */
  const pointerDownRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  /** Zone drag: tracks which characters move together and the world-space anchor. */
  const zoneDragRef = useRef<{
    charIds: string[];
    startWorldX: number;
    startWorldY: number;
    startPositions: NodePos[];
  } | null>(null);
  /** Set to true when the user repositions nodes/zones; triggers localStorage save. */
  const dirtyRef = useRef(false);

  /* ── radial menu + sheet ── */
  const [radialMenuCharId, setRadialMenuCharId] = useState<string | null>(null);
  const [sheetCharId, setSheetCharId] = useState<string | null>(null);
  const [skylineLoading, setSkylineLoading] = useState(false);

  /* ── dialogs ── */
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editLink, setEditLink] = useState<AffinityLinkPayload | null>(null);
  const [addCharA, setAddCharA] = useState('');
  const [addCharB, setAddCharB] = useState('');
  const [addLabelAtoB, setAddLabelAtoB] = useState('');
  const [addLabelBtoA, setAddLabelBtoA] = useState('');
  const [addSentiment, setAddSentiment] = useState(0);
  const [addColor, setAddColor] = useState(LINK_COLORS[0]);
  const [editLabelAtoB, setEditLabelAtoB] = useState('');
  const [editLabelBtoA, setEditLabelBtoA] = useState('');
  const [editSentiment, setEditSentiment] = useState(0);
  const [editColor, setEditColor] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  /* ── right-click linking mode ── */
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

  /* ── search ── */
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null);

  /* ── hover / highlight state ── */
  const [hoveredCharId, setHoveredCharId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  /* ── zoom / pan state (merged so wheel updates are always atomic) ── */
  const [viewport, setViewport] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const { zoom, pan } = viewport;
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  /* ── canvas dimensions ── */
  const containerRef = useRef<HTMLDivElement>(null);
  /** Tracks sorted zone assignments to detect when re-layout is needed. */
  const zoneSignatureRef = useRef<string>('');
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  /* ── load data ── */
  const loadData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [chars, lnks, mps] = await Promise.all([
        listCharacters(campaignId),
        listAffinityLinks(campaignId),
        listMaps({ campaignId }),
      ]);
      setCharacters(chars);
      setLinks(lnks);
      setMaps(mps);
      // Detect zone-assignment changes (primaryMapId or associatedMapIds)
      const newZoneSig = chars
        .map((c) => {
          const specific = (c.associatedMapIds || []).filter((id) => id !== '__ALL__').join(',');
          return `${c.id}:${c.primaryMapId ?? ''}:${specific}`;
        })
        .sort()
        .join('|');
      const zoneChanged = newZoneSig !== zoneSignatureRef.current;
      zoneSignatureRef.current = newZoneSig;
      // Recompute positions when: characters added/removed, OR zone assignments changed
      setPositions((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const allExist = chars.every((c) => existingIds.has(c.id!));
        if (allExist && prev.length === chars.length && !zoneChanged) return prev;
        // Always compute a fresh geometric layout as a baseline for new characters
        const fresh = layoutNodes(chars, canvasSize.w, canvasSize.h);
        // Override fresh positions with any previously saved user arrangement
        const saved = loadSavedLayout(campaignId!);
        if (!saved) return fresh;
        const savedMap = new Map(saved.map((p) => [p.id, p]));
        return fresh.map((fp) => savedMap.get(fp.id) ?? fp);
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading affinity data');
    } finally {
      setLoading(false);
    }
  }, [campaignId, canvasSize.w, canvasSize.h]);

  useEffect(() => { loadData(); }, [loadData]);

  /** Save positions to localStorage whenever the user finishes a drag/zone-move. */
  useEffect(() => {
    if (!campaignId || !dirtyRef.current || positions.length === 0) return;
    saveLayout(campaignId, positions);
    dirtyRef.current = false;
  }, [positions, campaignId]);

  /**
   * Computed zones: one per unique primaryMapId that has ≥1 character.
   * Each zone's bounding box is derived from current node positions.
   */
  const zones = useMemo(() => {
    const seen = new Map<string, { map: MapItemDto; charIds: string[]; colorIdx: number }>();
    let colorIdx = 0;
    // Only NPCs contribute to map-based zones; PCs always form the central player zone.
    for (const ch of characters.filter((c) => c.kind === 'npc')) {
      const specificMaps = (ch.associatedMapIds || []).filter((id) => id !== '__ALL__');
      const effectiveMapId =
        ch.primaryMapId ||
        (specificMaps.length === 1 ? specificMaps[0] : null);
      if (!effectiveMapId) continue;
      const map = maps.find((m) => m.id === effectiveMapId);
      if (!map) continue;
      if (!seen.has(effectiveMapId)) {
        seen.set(effectiveMapId, { map, charIds: [], colorIdx: colorIdx++ });
      }
      seen.get(effectiveMapId)!.charIds.push(ch.id!);
    }
    return Array.from(seen.values());
  }, [characters, maps]);

  /* ── observe container size ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ w: width, h: height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── zoom via mouse wheel (native listener to allow preventDefault) ── */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    // Normalise delta: cap to avoid huge jumps on trackpads with pixel-mode delta
    const rawDelta = e.deltaMode === 0 ? e.deltaY : e.deltaY * 16;
    const clampedDelta = Math.max(-80, Math.min(80, rawDelta));
    const factor = clampedDelta > 0 ? 0.9 : 1.1;
    setViewport((prev) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      if (nextZoom === prev.zoom) return prev;
      const ratio = nextZoom / prev.zoom;
      return {
        zoom: nextZoom,
        pan: {
          x: cursorX - ratio * (cursorX - prev.pan.x),
          y: cursorY - ratio * (cursorY - prev.pan.y),
        },
      };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /* ── drag handlers (world-space aware) ── */
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent canvas pan from starting
    if (e.button === 2) return;
    if (linkSourceId && nodeId !== linkSourceId) {
      setAddCharA(linkSourceId);
      setAddCharB(nodeId);
      setAddDialogOpen(true);
      setLinkSourceId(null);
      return;
    }
    if (linkSourceId && nodeId === linkSourceId) {
      setLinkSourceId(null);
      return;
    }
    const pos = positions.find((p) => p.id === nodeId);
    if (!pos) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;
    dragRef.current = { nodeId, offsetX: worldX - pos.x, offsetY: worldY - pos.y };
    pointerDownRef.current = { nodeId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /** Right-click on a character to initiate linking mode. */
  const handleContextMenu = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setLinkSourceId(nodeId);
  };

  /**
   * Pointer down on a zone background div — begins moving all member characters
   * together as a group.  Pointer capture ensures smooth dragging even when the
   * cursor leaves the zone element.
   */
  const handleZonePointerDown = (charIds: string[], e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent canvas pan
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;
    zoneDragRef.current = {
      charIds,
      startWorldX: worldX,
      startWorldY: worldY,
      startPositions: positions.slice(),
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /** Cancel linking mode on ESC. */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkSourceId(null);
        setRadialMenuCharId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /** Pointer down on canvas background — start pan or cancel linking/radial menu. */
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    setRadialMenuCharId(null);
    if (e.button === 0 && linkSourceId) {
      setLinkSourceId(null);
      return;
    }
    if (e.button === 0 || e.button === 1) {
      // Capture the current pan at drag start (read from viewport state at this render)
      panDragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      if (e.button === 1) e.preventDefault();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - pan.x) / zoom;
      const worldY = (e.clientY - rect.top - pan.y) / zoom;
      const { nodeId, offsetX, offsetY } = dragRef.current;
      setPositions((prev) =>
        prev.map((p) => (p.id === nodeId ? { ...p, x: worldX - offsetX, y: worldY - offsetY } : p)),
      );
    } else if (zoneDragRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - pan.x) / zoom;
      const worldY = (e.clientY - rect.top - pan.y) / zoom;
      const dx = worldX - zoneDragRef.current.startWorldX;
      const dy = worldY - zoneDragRef.current.startWorldY;
      const charIdSet = new Set(zoneDragRef.current.charIds);
      const start = zoneDragRef.current.startPositions;
      setPositions(start.map((p) => (charIdSet.has(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p)));
    } else if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      const nextPan = { x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy };
      setViewport((prev) => ({ ...prev, pan: nextPan }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const down = pointerDownRef.current;
    if (down) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        // Click: toggle radial menu for this node
        setRadialMenuCharId((prev) => prev === down.nodeId ? null : down.nodeId);
      } else {
        // Drag ended: close any open menu and persist layout
        setRadialMenuCharId(null);
        dirtyRef.current = true;
      }
      pointerDownRef.current = null;
    }
    if (zoneDragRef.current) {
      dirtyRef.current = true; // zone was moved — persist on next render
      zoneDragRef.current = null;
    }
    dragRef.current = null;
    panDragRef.current = null;
  };

  /* ── zoom control helpers ── */
  const handleZoomIn = () => {
    setViewport((prev) => ({ ...prev, zoom: Math.min(MAX_ZOOM, prev.zoom * 1.2) }));
  };

  const handleZoomOut = () => {
    setViewport((prev) => ({ ...prev, zoom: Math.max(MIN_ZOOM, prev.zoom / 1.2) }));
  };

  const handleResetView = () => {
    if (positions.length === 0) {
      setViewport({ zoom: 1, pan: { x: 0, y: 0 } });
      return;
    }
    // Compute bounding box of all nodes and center it in the canvas at zoom 1
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setViewport({
      zoom: 1,
      pan: {
        x: canvasSize.w / 2 - centerX,
        y: canvasSize.h / 2 - centerY,
      },
    });
  };

  /**
   * Centers the viewport on the searched character node.
   *
   * @param charId - UUID of the character to center on.
   */
  const handleSearchSelect = (charId: string | null) => {
    setSearchHighlightId(charId);
    if (!charId) return;
    const pos = positions.find((p) => p.id === charId);
    if (!pos) return;
    const cw = canvasSize.w;
    const ch = canvasSize.h;
    // Center the node in the canvas keeping current zoom
    setViewport((prev) => ({
      zoom: prev.zoom,
      pan: {
        x: cw / 2 - pos.x * prev.zoom,
        y: ch / 2 - pos.y * prev.zoom,
      },
    }));
  };

  /* ── skyline toggle ── */
  /**
   * Sends or removes the given character from the Skyline overlay.
   * Only the campaign owner/master should invoke this.
   *
   * @param charId - UUID of the character to toggle.
   */
  const handleSkylineToggle = async (charId: string) => {
    if (!campaignId) return;
    setSkylineLoading(true);
    setRadialMenuCharId(null);
    try {
      const isActive = (activeCampaign as any)?.activeSkylineCharacter?.id === charId;
      await setActiveSkylineCharacterId(campaignId, isActive ? null : charId);
      await fetchCampaigns();
      localStorage.setItem(
        'app.skyline.activeCharacterUpdated',
        JSON.stringify({ campaignId, at: Date.now() }),
      );
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'activeSkylineChanged', campaignId });
        bc.close();
      }
      try { (window as any).electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId }); } catch (_) { /* desktop only */ }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al actualizar Skyline');
    } finally {
      setSkylineLoading(false);
    }
  };

  /* ── link CRUD ── */
  const handleCreateLink = async () => {
    if (!campaignId || !addCharA || !addCharB || addCharA === addCharB) return;
    setSaving(true);
    try {
      await createAffinityLink({
        campaignId,
        characterAId: addCharA,
        characterBId: addCharB,
        labelAtoB: addLabelAtoB,
        labelBtoA: addLabelBtoA,
        sentiment: addSentiment,
        color: addColor,
        notes: addNotes || undefined,
      });
      setAddDialogOpen(false);
      setAddCharA('');
      setAddCharB('');
      setAddLabelAtoB('');
      setAddLabelBtoA('');
      setAddSentiment(0);
      setAddColor(LINK_COLORS[0]);
      setAddNotes('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating link');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLink = async () => {
    if (!editLink) return;
    setSaving(true);
    try {
      await updateAffinityLink(editLink.id, {
        labelAtoB: editLabelAtoB,
        labelBtoA: editLabelBtoA,
        sentiment: editSentiment,
        color: editColor,
        notes: editNotes || undefined,
      });
      setEditLink(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating link');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    setSaving(true);
    try {
      await deleteAffinityLink(linkId);
      setEditLink(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting link');
    } finally {
      setSaving(false);
    }
  };

  const openEditLink = (link: AffinityLinkPayload) => {
    setEditLink(link);
    setEditLabelAtoB(link.labelAtoB);
    setEditLabelBtoA(link.labelBtoA);
    setEditSentiment(link.sentiment);
    setEditColor(link.color);
    setEditNotes(link.notes ?? '');
  };

  /* ── highlight helpers ── */
  /** Returns true if a link should be highlighted (full opacity). */
  const isLinkHighlighted = (link: AffinityLinkPayload): boolean => {
    if (hoveredLinkId === link.id) return true;
    if (hoveredCharId && (link.characterA.id === hoveredCharId || link.characterB.id === hoveredCharId)) return true;
    return false;
  };

  /* ── position lookup ── */
  const posOf = (charId: string) => positions.find((p) => p.id === charId);

  /* ── render ── */
  if (!campaignId) {
    return <Alert severity="info">{t('select_campaign', 'Selecciona una campaña para ver el afinigrama.')}</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5">{t('affinity_chart', 'Afinigrama')}</Typography>
        {linkSourceId ? (
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
            {t('linking_mode', 'Haz clic en otro personaje para crear un vínculo (ESC para cancelar)')}
          </Typography>
        ) : (
          <Autocomplete
            options={characters}
            getOptionLabel={(c) => c.name}
            size="small"
            sx={{ width: 240 }}
            onChange={(_e, value) => handleSearchSelect(value?.id ?? null)}
            onInputChange={(_e, val) => { if (!val) setSearchHighlightId(null); }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('search_character', 'Buscar personaje...')}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar
                    src={option.tokenKind === 'image' && option.tokenImageUrl ? option.tokenImageUrl : undefined}
                    sx={{ width: 24, height: 24, fontSize: '0.65rem', bgcolor: option.tokenColor || '#607d8b' }}
                  >
                    {!(option.tokenKind === 'image' && option.tokenImageUrl) && option.name.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{option.kind === 'pc' ? 'PC' : 'NPC'}</Typography>
                </Stack>
              </li>
            )}
          />
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box
        ref={containerRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 320px)',
          minHeight: 500,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          userSelect: 'none',
          touchAction: 'none',
          cursor: linkSourceId ? 'crosshair' : 'grab',
          '&:active': { cursor: linkSourceId ? 'crosshair' : 'grabbing' },
        }}
      >
        {/* Loading overlay */}
        {loading && !characters.length && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <CircularProgress />
          </Box>
        )}
        {/* Empty state overlay */}
        {!loading && characters.length === 0 && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Alert severity="info" sx={{ width: '100%' }}>
              {t('no_characters_affinity', 'No hay personajes en esta campaña para mostrar en el afinigrama.')}
            </Alert>
          </Box>
        )}
        {/* Transformed content layer (zoom + pan) — only when there are characters */}
        {characters.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
          {/* SVG lines layer */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
          >
            {/* Player zone background — always rendered separately from map zones */}
            {showZones && (() => {
              const pcPts = characters
                .filter((c) => c.kind === 'pc')
                .map((c) => posOf(c.id!))
                .filter(Boolean) as NodePos[];
              if (pcPts.length === 0) return null;
              const pMinX = Math.min(...pcPts.map((p) => p.x)) - NODE_RADIUS - ZONE_PAD;
              const pMinY = Math.min(...pcPts.map((p) => p.y)) - NODE_RADIUS - ZONE_PAD;
              const pMaxX = Math.max(...pcPts.map((p) => p.x)) + NODE_RADIUS + ZONE_PAD;
              const pMaxY = Math.max(...pcPts.map((p) => p.y)) + NODE_RADIUS + ZONE_PAD;
              return (
                <g key="__pc_zone__">
                  <rect
                    x={pMinX} y={pMinY} width={pMaxX - pMinX} height={pMaxY - pMinY}
                    rx={20} ry={20}
                    fill="#ffa726" fillOpacity={0.06}
                    stroke="#ffa726" strokeOpacity={0.30}
                    strokeWidth={2} strokeDasharray="8 4"
                    pointerEvents="none"
                  />
                  <text
                    x={pMinX + 14} y={pMinY + 24}
                    fill="#ffa726" fontSize={13} fontWeight={700}
                    opacity={0.85} style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {t('players', 'Jugadores')}
                  </text>
                </g>
              );
            })()}
            {/* Map-based NPC zone backgrounds */}
            {showZones && zones.map(({ map, charIds, colorIdx }) => {
              const pts = charIds.map((id) => posOf(id)).filter(Boolean) as NodePos[];
              if (pts.length === 0) return null;
              const minX = Math.min(...pts.map((p) => p.x)) - NODE_RADIUS - ZONE_PAD;
              const minY = Math.min(...pts.map((p) => p.y)) - NODE_RADIUS - ZONE_PAD;
              const maxX = Math.max(...pts.map((p) => p.x)) + NODE_RADIUS + ZONE_PAD;
              const maxY = Math.max(...pts.map((p) => p.y)) + NODE_RADIUS + ZONE_PAD;
              const zw = maxX - minX;
              const zh = maxY - minY;
              const color = ZONE_COLORS[colorIdx % ZONE_COLORS.length];
              return (
                <g key={map.id}>
                  <rect
                    x={minX} y={minY} width={zw} height={zh}
                    rx={20} ry={20}
                    fill={color} fillOpacity={0.06}
                    stroke={color} strokeOpacity={0.30}
                    strokeWidth={2} strokeDasharray="8 4"
                    pointerEvents="none"
                  />
                  <text
                    x={minX + 14} y={minY + 24}
                    fill={color} fontSize={13} fontWeight={700}
                    opacity={0.85} style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {map.name}
                  </text>
                </g>
              );
            })}
            {links.map((link) => {
              const a = posOf(link.characterA.id!);
              const b = posOf(link.characterB.id!);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              // Label positions: 30% from each end
              const labelAx = a.x + (b.x - a.x) * 0.28;
              const labelAy = a.y + (b.y - a.y) * 0.28;
              const labelBx = a.x + (b.x - a.x) * 0.72;
              const labelBy = a.y + (b.y - a.y) * 0.72;
              const highlighted = isLinkHighlighted(link);
              return (
                <g key={link.id} opacity={highlighted ? 1 : 0.5}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={link.color || '#90caf9'}
                    strokeWidth={highlighted ? 3.5 : 2.5}
                    strokeLinecap="round"
                  />
                  {/* Invisible fat line for hover & click */}
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={18}
                    style={{ pointerEvents: 'stroke', cursor: isMaster ? 'pointer' : 'default' }}
                    onClick={() => isMaster && openEditLink(link)}
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                  />
                  {/* Label A→B (near character A) */}
                  {link.labelAtoB && (
                    <text
                      x={labelAx}
                      y={labelAy - 8}
                      textAnchor="middle"
                      fill={link.color || '#90caf9'}
                      fontSize={10}
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {link.labelAtoB}
                    </text>
                  )}
                  {/* Label B→A (near character B) */}
                  {link.labelBtoA && (
                    <text
                      x={labelBx}
                      y={labelBy - 8}
                      textAnchor="middle"
                      fill={link.color || '#90caf9'}
                      fontSize={10}
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {link.labelBtoA}
                    </text>
                  )}
                  {/* Sentiment emoji at midpoint */}
                  <text
                    x={mx}
                    y={my + 5}
                    textAnchor="middle"
                    fontSize={18}
                    style={{ pointerEvents: 'none' }}
                  >
                    {sentimentEmoji(link.sentiment)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Zone label drag-handles — small pill positioned over the zone name text.
              Dragging the label moves all characters in the zone together.
              Position mirrors the SVG <text> at (minX+14, minY+24). */}
          {showZones && (() => {
            const pcIds = characters.filter((c) => c.kind === 'pc').map((c) => c.id!);
            const pcPts = pcIds.map((id) => posOf(id)).filter(Boolean) as NodePos[];
            if (pcPts.length === 0) return null;
            const pMinX = Math.min(...pcPts.map((p) => p.x)) - NODE_RADIUS - ZONE_PAD;
            const pMinY = Math.min(...pcPts.map((p) => p.y)) - NODE_RADIUS - ZONE_PAD;
            const labelText = t('players', 'Jugadores');
            const labelW = labelText.length * 8 + 16; // rough estimate: ~8 px/char + padding
            return (
              <div
                key="__pc_zone_handle__"
                onPointerDown={(e) => handleZonePointerDown(pcIds, e)}
                title={t('drag_zone', 'Arrastra para mover la zona')}
                style={{
                  position: 'absolute',
                  left: pMinX + 10,
                  top: pMinY + 8,
                  width: labelW,
                  height: 22,
                  cursor: 'move',
                  borderRadius: 4,
                }}
              />
            );
          })()}
          {showZones && zones.map(({ map, charIds }) => {
            const pts = charIds.map((id) => posOf(id)).filter(Boolean) as NodePos[];
            if (pts.length === 0) return null;
            const minX = Math.min(...pts.map((p) => p.x)) - NODE_RADIUS - ZONE_PAD;
            const minY = Math.min(...pts.map((p) => p.y)) - NODE_RADIUS - ZONE_PAD;
            const labelW = map.name.length * 8 + 16;
            return (
              <div
                key={`zone-handle-${map.id}`}
                onPointerDown={(e) => handleZonePointerDown(charIds, e)}
                title={t('drag_zone', 'Arrastra para mover la zona')}
                style={{
                  position: 'absolute',
                  left: minX + 10,
                  top: minY + 8,
                  width: labelW,
                  height: 22,
                  cursor: 'move',
                  borderRadius: 4,
                }}
              />
            );
          })}

          {/* Character nodes — NPCs before PCs so PCs always render on top (higher z-index) */}
          {[...characters].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'pc' ? 1 : -1)).map((ch) => {
            const pos = posOf(ch.id!);
            if (!pos) return null;
            const avatarBg = ch.tokenColor || '#607d8b';
            const hasImage = ch.tokenKind === 'image' && ch.tokenImageUrl;
            const isSource = linkSourceId === ch.id;
            const isLinkTarget = !!linkSourceId && linkSourceId !== ch.id;
            return (
              <Box
                key={ch.id}
                onPointerDown={(e) => handlePointerDown(ch.id!, e)}
                onContextMenu={(e) => handleContextMenu(ch.id!, e)}
                onMouseEnter={() => setHoveredCharId(ch.id!)}
                onMouseLeave={() => setHoveredCharId(null)}
                sx={{
                  position: 'absolute',
                  left: pos.x - NODE_RADIUS,
                  top: pos.y - NODE_RADIUS,
                  width: NODE_RADIUS * 2,
                  cursor: isLinkTarget ? 'crosshair' : 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  '&:active': { cursor: isLinkTarget ? 'crosshair' : 'grabbing' },
                }}
              >
                <Tooltip title={`${ch.name}${ch.kind === 'pc' ? ' (PC)' : ' (NPC)'}${isMaster ? '\n' + t('right_click_link', 'Clic derecho para vincular') : ''}`} arrow>
                  <Avatar
                    src={hasImage ? ch.tokenImageUrl : undefined}
                    sx={{
                      width: NODE_RADIUS * 2,
                      height: NODE_RADIUS * 2,
                      bgcolor: hasImage ? undefined : avatarBg,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      border: isSource
                        ? '3px solid #ffeb3b'
                        : searchHighlightId === ch.id
                          ? '3px solid #00e5ff'
                          : ch.kind === 'pc'
                            ? '3px solid #ffa726'
                            : '2px solid rgba(255,255,255,0.3)',
                      boxShadow: isSource
                        ? '0 0 12px 3px #ffeb3b'
                        : searchHighlightId === ch.id
                          ? '0 0 14px 4px #00e5ff'
                          : 2,
                      transition: 'box-shadow 0.2s, border 0.2s',
                    }}
                  >
                    {!hasImage && initials(ch.name)}
                  </Avatar>
                </Tooltip>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    mt: 0.3,
                    maxWidth: NODE_RADIUS * 3,
                    textAlign: 'center',
                    fontWeight: 600,
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    color: 'text.primary',
                  }}
                >
                  {ch.name}
                </Typography>
              </Box>
            );
          })}
          </div>
        )}

        {/* Radial action menu — rendered in screen space so it doesn't zoom/pan */}
        {(() => {
          if (!radialMenuCharId) return null;
          const pos = posOf(radialMenuCharId);
          if (!pos) return null;
          const R = NODE_RADIUS * zoom + 28;
          const cx = pos.x * zoom + pan.x;
          const cy = pos.y * zoom + pan.y;
          const isInSkyline = (activeCampaign as any)?.activeSkylineCharacter?.id === radialMenuCharId;
          const actions = [
            {
              angle: -90,
              label: t('view_sheet', 'Ver ficha'),
              icon: <ArticleIcon fontSize="small" />,
              color: '#1565c0',
              disabled: false,
              onClick: () => { setSheetCharId(radialMenuCharId); setRadialMenuCharId(null); },
            },
            ...(isMaster ? [
              {
                angle: -150,
                label: t('add_link', 'Añadir vínculo'),
                icon: <AddLinkIcon fontSize="small" />,
                color: '#2e7d32',
                disabled: false,
                onClick: () => { setLinkSourceId(radialMenuCharId); setRadialMenuCharId(null); },
              },
              {
                angle: -30,
                label: isInSkyline
                  ? t('remove_from_skyline', 'Quitar de Skyline')
                  : t('send_to_skyline', 'Enviar a Skyline'),
                icon: <CastIcon fontSize="small" />,
                color: isInSkyline ? '#b71c1c' : '#e65100',
                disabled: skylineLoading,
                onClick: () => handleSkylineToggle(radialMenuCharId),
              },
            ] : []),
          ];
          return (
            <>
              {actions.map(({ angle, label, icon, color, disabled, onClick }) => {
                const rad = (angle * Math.PI) / 180;
                const bx = cx + R * Math.cos(rad) - 20;
                const by = cy + R * Math.sin(rad) - 20;
                return (
                  <Tooltip key={label} title={label} arrow placement="top">
                    <span
                      style={{ position: 'absolute', left: bx, top: by, zIndex: 20 }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        size="small"
                        disabled={disabled}
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: color,
                          color: 'white',
                          '&:hover': { bgcolor: color, filter: 'brightness(1.15)' },
                          '&.Mui-disabled': { bgcolor: `${color}99`, color: 'rgba(255,255,255,0.5)' },
                          boxShadow: 4,
                          transition: 'transform 0.12s, box-shadow 0.12s',
                          '&:active': { transform: 'scale(0.88)' },
                        }}
                      >
                        {icon}
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              })}
            </>
          );
        })()}

          {/* Zoom controls (outside transform so they stay fixed, only shown when there's content) */}
          {characters.length > 0 && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.55)',
              borderRadius: 1,
              p: 0.5,
              zIndex: 10,
            }}
          >
            <Tooltip title={t('zoom_in', 'Acercar')}>
              <IconButton size="small" onClick={handleZoomIn} sx={{ color: 'white' }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('zoom_out', 'Alejar')}>
              <IconButton size="small" onClick={handleZoomOut} sx={{ color: 'white' }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('reset_view', 'Restablecer vista')}>
              <IconButton size="small" onClick={handleResetView} sx={{ color: 'white' }}>
                <CenterFocusStrongIcon fontSize="small" />
              </IconButton>
            </Tooltip>
{(zones.length > 0 || characters.some((c) => c.kind === 'pc')) && (
              <Tooltip title={showZones ? t('hide_zones', 'Ocultar zonas') : t('show_zones', 'Mostrar zonas')}>
                <IconButton
                  size="small"
                  onClick={() => setShowZones((v) => !v)}
                  sx={{ color: showZones ? '#80deea' : 'rgba(255,255,255,0.45)' }}
                >
                  <LayersIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {(zones.length > 0 || characters.some((c) => c.kind === 'pc')) && (
              <Tooltip title={t('reorganize_zones', 'Reorganizar por zonas')}>
                <IconButton
                  size="small"
                  onClick={() => { const fresh = layoutNodes(characters, canvasSize.w, canvasSize.h); setPositions(fresh); dirtyRef.current = true; }}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <DashboardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Typography variant="caption" sx={{ color: 'white', display: 'flex', alignItems: 'center', px: 0.5 }}>
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>
          )}
        </Box>

      {/* ── Character Sheet Modal (opened from radial menu) ── */}
      {sheetCharId && campaignId && (
        <WorldpediaEntityViewer
          open={!!sheetCharId}
          entityType="character"
          entityId={sheetCharId}
          campaignId={campaignId}
          onClose={() => setSheetCharId(null)}
        />
      )}

      {/* ── Add Link Dialog ── */}
      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setLinkSourceId(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{t('new_relationship', 'Nueva relación')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('character_a', 'Personaje A')}</InputLabel>
              <Select value={addCharA} label={t('character_a', 'Personaje A')} onChange={(e) => setAddCharA(e.target.value)}>
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id!}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>{t('character_b', 'Personaje B')}</InputLabel>
              <Select value={addCharB} label={t('character_b', 'Personaje B')} onChange={(e) => setAddCharB(e.target.value)}>
                {characters.filter((c) => c.id !== addCharA).map((c) => (
                  <MenuItem key={c.id} value={c.id!}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Two-way labels */}
            <TextField
              label={`${characters.find((c) => c.id === addCharA)?.name ?? t('character_a', 'A')} → ${characters.find((c) => c.id === addCharB)?.name ?? t('character_b', 'B')}`}
              value={addLabelAtoB}
              onChange={(e) => setAddLabelAtoB(e.target.value)}
              size="small"
              fullWidth
              placeholder={t('label_atob_placeholder', 'Ej: es hijo de')}
            />
            <TextField
              label={`${characters.find((c) => c.id === addCharB)?.name ?? t('character_b', 'B')} → ${characters.find((c) => c.id === addCharA)?.name ?? t('character_a', 'A')}`}
              value={addLabelBtoA}
              onChange={(e) => setAddLabelBtoA(e.target.value)}
              size="small"
              fullWidth
              placeholder={t('label_btoa_placeholder', 'Ej: es madre de')}
            />
            {/* Sentiment picker */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('sentiment', 'Sentimiento')}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {SENTIMENTS.map((s) => (
                  <Tooltip key={s.value} title={s.label} arrow>
                    <Box
                      onClick={() => setAddSentiment(s.value)}
                      sx={{
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: addSentiment === s.value ? '2px solid white' : '2px solid transparent',
                        bgcolor: addSentiment === s.value ? 'action.selected' : 'transparent',
                      }}
                    >
                      {s.emoji}
                    </Box>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
            {/* Color picker */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('link_color', 'Color de la línea')}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {LINK_COLORS.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setAddColor(c)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: c,
                      cursor: 'pointer',
                      border: addColor === c ? '3px solid white' : '2px solid transparent',
                      boxShadow: addColor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </Stack>
            </Box>
            {/* Notes */}
            <TextField
              label={t('link_notes', 'Notas')}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder={t('link_notes_placeholder', 'Historia, secretos o contexto de esta relación...')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setLinkSourceId(null); }}>{t('cancel', 'Cancelar')}</Button>
          <Button
            onClick={handleCreateLink}
            variant="contained"
            disabled={saving || !addCharA || !addCharB || addCharA === addCharB}
          >
            {saving ? t('saving', 'Guardando...') : t('create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Link Dialog ── */}
      <Dialog open={!!editLink} onClose={() => setEditLink(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('edit_relationship', 'Editar relación')}</DialogTitle>
        <DialogContent>
          {editLink && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {editLink.characterA.name} ↔ {editLink.characterB.name}
              </Typography>
              {/* Two-way labels */}
              <TextField
                label={`${editLink.characterA.name} → ${editLink.characterB.name}`}
                value={editLabelAtoB}
                onChange={(e) => setEditLabelAtoB(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label={`${editLink.characterB.name} → ${editLink.characterA.name}`}
                value={editLabelBtoA}
                onChange={(e) => setEditLabelBtoA(e.target.value)}
                size="small"
                fullWidth
              />
              {/* Sentiment picker */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('sentiment', 'Sentimiento')}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {SENTIMENTS.map((s) => (
                    <Tooltip key={s.value} title={s.label} arrow>
                      <Box
                        onClick={() => setEditSentiment(s.value)}
                        sx={{
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          border: editSentiment === s.value ? '2px solid white' : '2px solid transparent',
                          bgcolor: editSentiment === s.value ? 'action.selected' : 'transparent',
                        }}
                      >
                        {s.emoji}
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
              {/* Color picker */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('link_color', 'Color de la línea')}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {LINK_COLORS.map((c) => (
                    <Box
                      key={c}
                      onClick={() => setEditColor(c)}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: c,
                        cursor: 'pointer',
                        border: editColor === c ? '3px solid white' : '2px solid transparent',
                        boxShadow: editColor === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
              {/* Notes */}
              <TextField
                label={t('link_notes', 'Notas')}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                placeholder={t('link_notes_placeholder', 'Historia, secretos o contexto de esta relación...')}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {editLink && (
            <Tooltip title={t('delete_link', 'Eliminar relación')}>
              <IconButton color="error" onClick={() => handleDeleteLink(editLink.id)} disabled={saving}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setEditLink(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={handleUpdateLink} variant="contained" disabled={saving}>
            {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
