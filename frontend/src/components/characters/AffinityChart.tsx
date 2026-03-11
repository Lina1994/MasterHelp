import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../../utils/getCurrentUser';
import { listCharacters, type CharacterPayload } from '../../api/characters';
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

/** Generates initial positions — PCs in an inner circle, NPCs in an outer ring. */
function layoutNodes(characters: CharacterPayload[], width: number, height: number): NodePos[] {
  const pcs = characters.filter((c) => c.kind === 'pc');
  const npcs = characters.filter((c) => c.kind === 'npc');
  const cx = width / 2;
  const cy = height / 2;
  const positions: NodePos[] = [];

  const pcRadius = Math.min(width, height) * 0.2;
  pcs.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / (pcs.length || 1) - Math.PI / 2;
    positions.push({
      id: c.id!,
      x: cx + pcRadius * Math.cos(angle),
      y: cy + pcRadius * Math.sin(angle),
    });
  });

  const npcRadius = Math.min(width, height) * 0.38;
  npcs.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / (npcs.length || 1) - Math.PI / 2;
    positions.push({
      id: c.id!,
      x: cx + npcRadius * Math.cos(angle),
      y: cy + npcRadius * Math.sin(angle),
    });
  });

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
  const campaignId = activeCampaign?.id ?? null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

  /* ── data state ── */
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [links, setLinks] = useState<AffinityLinkPayload[]>([]);
  const [positions, setPositions] = useState<NodePos[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── drag state ── */
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

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
  const [saving, setSaving] = useState(false);

  /* ── right-click linking mode ── */
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

  /* ── hover / highlight state ── */
  const [hoveredCharId, setHoveredCharId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  /* ── zoom / pan state ── */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  /* ── canvas dimensions ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  /* ── load data ── */
  const loadData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [chars, lnks] = await Promise.all([
        listCharacters(campaignId),
        listAffinityLinks(campaignId),
      ]);
      setCharacters(chars);
      setLinks(lnks);
      // Recompute positions only when characters change
      setPositions((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const allExist = chars.every((c) => existingIds.has(c.id!));
        if (allExist && prev.length === chars.length) return prev;
        return layoutNodes(chars, canvasSize.w, canvasSize.h);
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading affinity data');
    } finally {
      setLoading(false);
    }
  }, [campaignId, canvasSize.w, canvasSize.h]);

  useEffect(() => { loadData(); }, [loadData]);

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
    setZoom((prev) => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
      const ratio = next / prev;
      setPan((p) => ({
        x: cursorX - ratio * (cursorX - p.x),
        y: cursorY - ratio * (cursorY - p.y),
      }));
      return next;
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
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /** Right-click on a character to initiate linking mode. */
  const handleContextMenu = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setLinkSourceId(nodeId);
  };

  /** Cancel linking mode on ESC. */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkSourceId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /** Pointer down on canvas background — start pan or cancel linking mode. */
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && linkSourceId) {
      setLinkSourceId(null);
      return;
    }
    if (e.button === 0 || e.button === 1) {
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
    } else if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPan({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy });
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    panDragRef.current = null;
  };

  /* ── zoom control helpers ── */
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev * 1.2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev / 1.2));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
      });
      setAddDialogOpen(false);
      setAddCharA('');
      setAddCharB('');
      setAddLabelAtoB('');
      setAddLabelBtoA('');
      setAddSentiment(0);
      setAddColor(LINK_COLORS[0]);
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

  if (loading && !characters.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{t('affinity_chart', 'Afinigrama')}</Typography>
        {linkSourceId && (
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
            {t('linking_mode', 'Haz clic en otro personaje para crear un vínculo (ESC para cancelar)')}
          </Typography>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {characters.length === 0 ? (
        <Alert severity="info">
          {t('no_characters_affinity', 'No hay personajes en esta campaña para mostrar en el afinigrama.')}
        </Alert>
      ) : (
        <Box
          ref={containerRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          sx={{
            position: 'relative',
            width: '100%',
            height: 600,
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
          {/* Transformed content layer (zoom + pan) */}
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

          {/* Character nodes */}
          {characters.map((ch) => {
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
                        : ch.kind === 'pc'
                          ? '3px solid #ffa726'
                          : '2px solid rgba(255,255,255,0.3)',
                      boxShadow: isSource ? '0 0 12px 3px #ffeb3b' : 2,
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

          {/* Zoom controls (outside transform so they stay fixed) */}
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
            <Typography variant="caption" sx={{ color: 'white', display: 'flex', alignItems: 'center', px: 0.5 }}>
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>
        </Box>
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
