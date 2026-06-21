import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardSlot, CardTemplate } from '../../types/cardTemplates';
import { slotTransform } from './CardRenderer';

type HandleKind = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

/**
 * Sentinel id used to represent the "base card" entry — name,
 * description, size and global style — in the slot list and in
 * selection state. Real slots are always created with `uuidv4()`, so
 * this string can never collide with a real slot id. Editing logic
 * branches on the constant instead of a magic literal so any future
 * `null → base` decision lands in a single place.
 */
export const BASE_SLOT_ID = '__base__';

interface DragState {
  kind: 'move' | HandleKind;
  slotId: string;
  startX: number;
  startY: number;
  /** Snapshot of every slot at drag start so we can derive deltas. */
  initialSlots: CardSlot[];
  /** Pixels per millimetre — derived once at drag start from the container rect. */
  pxPerMmX: number;
  pxPerMmY: number;
}

/** Visual configuration for one of the eight resize handles. */
const HANDLES: { type: HandleKind; top: string; left: string; cursor: string }[] = [
  { type: 'nw', top: '0%', left: '0%', cursor: 'nwse-resize' },
  { type: 'n', top: '0%', left: '50%', cursor: 'ns-resize' },
  { type: 'ne', top: '0%', left: '100%', cursor: 'nesw-resize' },
  { type: 'e', top: '50%', left: '100%', cursor: 'ew-resize' },
  { type: 'se', top: '100%', left: '100%', cursor: 'nwse-resize' },
  { type: 's', top: '100%', left: '50%', cursor: 'ns-resize' },
  { type: 'sw', top: '100%', left: '0%', cursor: 'nesw-resize' },
  { type: 'w', top: '50%', left: '0%', cursor: 'ew-resize' },
];

const MIN_MM = 2; // minimum slot dimension so handles never disappear

// --- Snap-to-align helpers -------------------------------------------
// Edge / center snap while dragging a slot. Two related behaviours:
//   1. Visual guides: while dragging, every movable candidate within
//      `ALIGN_THRESHOLD_MM` of any other slot (card edge or slot edge) is
//      rendered as a full-length guide line. This is on by default, with
//      and without CTRL — same affordance as Figma.
//   2. Magnetic snap: when CTRL is held, the closest alignment within
//      the threshold is enforced, rounding the dragged slot's position
//      so the matching candidate lands exactly on the target.
const ALIGN_THRESHOLD_MM = 1.5;
const GUIDE_COLOR = '#ec4899';
const GUIDE_THICKNESS_PX = 1;

/**
 * Returns the list of x-axis candidate names that the current drag
 * kind actually moves. Some candidates are FROZEN for corner / edge
 * resize (e.g. for 'n' the slot's right.x doesn't change) so they
 * can't be used as snap targets — only the moving candidates are.
 */
function movableXNames(kind: DragState['kind']): Array<'left' | 'center' | 'right'> {
  switch (kind) {
    case 'move': return ['left', 'center', 'right'];
    case 'e':
    case 'ne':
    case 'se':
      return ['right', 'center'];
    case 'w':
    case 'nw':
    case 'sw':
      return ['left', 'center'];
    default: return [];
  }
}

/** Same as {@link movableXNames} but for the y axis. */
function movableYNames(kind: DragState['kind']): Array<'top' | 'center' | 'bottom'> {
  switch (kind) {
    case 'move': return ['top', 'center', 'bottom'];
    // Centre.y is NOT frozen here: the new centerline is `new.y + new.h/2`,
    // and `new.h = o.h \u2212 dyMm`, so centre.y shifts by `dyMm/2`. Snapping
    // by centre is just as legitimate as snapping by top.
    case 'n':
    case 'ne':
    case 'nw':
      return ['top', 'center'];
    case 's':
    case 'se':
    case 'sw':
      return ['bottom', 'center'];
    default: return [];
  }
}

type XAxisCandidate = 'left' | 'center' | 'right';
type YAxisCandidate = 'top' | 'center' | 'bottom';

function candidateAxisValue(
  slot: CardSlot,
  candidate: XAxisCandidate | YAxisCandidate,
  axis: 'x' | 'y',
): number {
  if (axis === 'x') {
    if (candidate === 'left') return slot.position.x;
    if (candidate === 'center') return slot.position.x + slot.position.w / 2;
    if (candidate === 'right') return slot.position.x + slot.position.w;
  } else {
    if (candidate === 'top') return slot.position.y;
    if (candidate === 'center') return slot.position.y + slot.position.h / 2;
    if (candidate === 'bottom') return slot.position.y + slot.position.h;
  }
  return 0;
}

/**
 * Translates a candidate-target delta into the dxMm/dyMm input delta
 * for the current drag kind. For 'move' the relationship is 1:1, but
 * for any RESIZE kind the centre shifts by half the input (the
 * centerline is `x + w/2` where both `x` and `w` are functions of
 * the same `dxMm` — same for `y + h/2` and `dyMm`). So a centre match
 * translates to a 2× dxMm/dyMm correction; edge matches stay 1:1.
 */
function candidateToInput(
  axis: 'x' | 'y',
  candidate: string,
  kind: DragState['kind'],
  candidateDelta: number,
): number {
  if (kind === 'move') return candidateDelta;
  if (candidate === 'center') return candidateDelta * 2;
  return candidateDelta;
}

/**
 * Build the union of candidate-target x / y values that any other
 * element exposes (other slots' edges + centres + the card bounds).
 */
function gatherAlignTargets(others: CardSlot[], template: CardTemplate, draggedId: string) {
  const xs = new Set<number>([0, template.widthMm, template.widthMm / 2]);
  const ys = new Set<number>([0, template.heightMm, template.heightMm / 2]);
  for (const o of others) {
    if (o.id === draggedId) continue;
    xs.add(o.position.x);
    xs.add(o.position.x + o.position.w);
    xs.add(o.position.x + o.position.w / 2);
    ys.add(o.position.y);
    ys.add(o.position.y + o.position.h);
    ys.add(o.position.y + o.position.h / 2);
  }
  return {
    xs: Array.from(xs).sort((a, b) => a - b),
    ys: Array.from(ys).sort((a, b) => a - b),
  };
}

/**
 * Compute the dxMm/dyMm adjustment required so that one of the
 * dragged slot's movable candidates (in the per-axis priority order
 * defined by `movableX/YNames`) lands exactly on a target within
 * `threshold`. Returns 0 if no candidate matches. Only enforced
 * when `ctrlOrMeta` is true; visual guides are independent.
 */
function computeSnap(
  slot: CardSlot,
  kind: DragState['kind'],
  ctrlOrMeta: boolean,
  threshold: number,
  targetXs: number[],
  targetYs: number[],
): { dx: number; dy: number } {
  if (!ctrlOrMeta) return { dx: 0, dy: 0 };
  let dx = 0;
  // X axis
  for (const cname of movableXNames(kind)) {
    const c = candidateAxisValue(slot, cname, 'x');
    for (const t of targetXs) {
      const d = t - c;
      if (Math.abs(d) <= threshold) {
        dx = candidateToInput('x', cname, kind, d);
        break;
      }
    }
    if (dx !== 0) break;
  }
  let dy = 0;
  for (const cname of movableYNames(kind)) {
    const c = candidateAxisValue(slot, cname, 'y');
    for (const t of targetYs) {
      const d = t - c;
      if (Math.abs(d) <= threshold) {
        dy = candidateToInput('y', cname, kind, d);
        break;
      }
    }
    if (dy !== 0) break;
  }
  return { dx, dy };
}

/**
 * Gather the union of matched target values seen by ANY of the
 * dragged slot's movable candidates. Used purely for rendering guide
 * lines — independent of CTRL / snap.
 */
function computeGuideTargets(
  slot: CardSlot,
  kind: DragState['kind'],
  threshold: number,
  targetXs: number[],
  targetYs: number[],
): { vertical: number[]; horizontal: number[] } {
  const vertical = new Set<number>();
  for (const cname of movableXNames(kind)) {
    const c = candidateAxisValue(slot, cname, 'x');
    for (const t of targetXs) {
      if (Math.abs(t - c) <= threshold) vertical.add(round1(t));
    }
  }
  const horizontal = new Set<number>();
  for (const cname of movableYNames(kind)) {
    const c = candidateAxisValue(slot, cname, 'y');
    for (const t of targetYs) {
      if (Math.abs(t - c) <= threshold) horizontal.add(round1(t));
    }
  }
  return {
    vertical: Array.from(vertical).sort((a, b) => a - b),
    horizontal: Array.from(horizontal).sort((a, b) => a - b),
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Visual drag-and-resize overlay for the template editor preview. Snap to
 * 1mm increments, clamp every drag inside the card bounds. State lives in
 * refs so the pointermove/up listeners re-bind only once instead of every
 * time `localSlots` ticks (60×/sec during a drag).
 *
 * As of this round, the name+layer badge is rendered OUTSIDE the selected
 * slot's bounding box by default (preferred) so it never covers the slot's
 * actual content while the user is editing. The badge floats BELOW the slot
 * when there's room and ABOVE when there isn't. Users who want every slot
 * labelled at once can flip the "Show labels" toggle — that re-enables the
 * in-box badge for every slot, same as before.
 */
export default function LiveSlotOverlay({
  template,
  selectedSlotId,
  onSelectSlot,
  onSlotsChange,
  showLabels = false,
}: {
  template: CardTemplate;
  selectedSlotId: string | null;
  onSelectSlot: (id: string | null) => void;
  onSlotsChange: (next: CardSlot[]) => void;
  /**
   * When `false` (default) only the floating chip for the selected slot is
   * visible, anchored just outside the slot's bounding box. When `true`,
   * every slot shows its name + layer badge inside the slot itself.
   */
  showLabels?: boolean;
}) {
  const { t } = useTranslation();
  // Percentage of the card's height kept between the slot's edge and the
  // floating chip that names the selected slot. Using a percentage means
  // the math survives zoom changes.
  const FLOAT_GAP_PERCENT = 0.6;
  // Slots closer than this to either the top or the bottom edge skip the
  // floating render so the chip never gets clipped by the card boundary.
  const NEAR_EDGE_PERCENT = 2;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  // Always-fresh ref so stable effects can read latest slot positions.
  const localSlotsRef = useRef<CardSlot[]>(template.slots);
  const [localSlots, setLocalSlots] = useState<CardSlot[]>(template.slots);
  // Alignment guides captured during a drag. Reset on every pointerup so
  // the canvas goes quiet once the user releases; also cleared on
  // unmount so a mid-drag dialog close doesn't leave stale lines behind.
  const [dragGuides, setDragGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  // Tracks which slot is currently under the pointer. Used to surface the
  // dashed border only when the user hovers a slot (or has it selected)
  // — by default every slot lives on a clean preview canvas free of
  // dashed lines, matching the user's stated preference.
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  // Mirror the latest slot array into the ref so effect closures see it.
  localSlotsRef.current = localSlots;

  // If the parent replaces `template.slots` while we're NOT dragging we
  // adopt those changes locally.
  useEffect(() => {
    if (!dragState.current) setLocalSlots(template.slots);
  }, [template.slots]);

  /** Begin a drag — captures the start state and the slot the gesture affects. */
  const startDrag = useCallback((
    e: React.PointerEvent,
    kind: DragState['kind'],
    slotId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      kind,
      slotId,
      startX: e.clientX,
      startY: e.clientY,
      initialSlots: localSlotsRef.current,
      pxPerMmX: rect.width / template.widthMm,
      pxPerMmY: rect.height / template.heightMm,
    };
    onSelectSlot(slotId);
  }, [onSelectSlot, template.widthMm, template.heightMm]);

  // Single global listener set installed once. It reads from refs so it
  // never needs to re-bind during a drag.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const dxMm = Math.round((e.clientX - st.startX) / st.pxPerMmX);
      const dyMm = Math.round((e.clientY - st.startY) / st.pxPerMmY);
      const tW = template.widthMm;
      const tH = template.heightMm;

      // Pre-compute the dragged-slot project: where would the dragged
      // slot land right now WITHOUT snapping? This is the position the
      // alignment tests are evaluated against, since snap delta is then
      // reapplied as an additional dxMm / dyMm shift on top.
      const dragged = st.initialSlots.find((s) => s.id === st.slotId);
      if (!dragged) {
        setLocalSlots(st.initialSlots);
        return;
      }
      const o = dragged.position;
      let projX = o.x;
      let projY = o.y;
      let projW = o.w;
      let projH = o.h;
      if (st.kind === 'move') {
        projX = Math.max(0, Math.min(tW - o.w, o.x + dxMm));
        projY = Math.max(0, Math.min(tH - o.h, o.y + dyMm));
      } else {
        if (st.kind.includes('n')) {
          const newY = Math.max(0, o.y + dyMm);
          projY = newY;
          projH = Math.max(MIN_MM, o.h + (o.y - newY));
        }
        if (st.kind.includes('s')) {
          projH = Math.max(MIN_MM, Math.min(tH - o.y, o.h + dyMm));
        }
        if (st.kind.includes('w')) {
          const newX = Math.max(0, o.x + dxMm);
          projX = newX;
          projW = Math.max(MIN_MM, o.w + (o.x - newX));
        }
        if (st.kind.includes('e')) {
          projW = Math.max(MIN_MM, Math.min(tW - o.x, o.w + dxMm));
        }
        if (projX + projW > tW) projW = Math.max(MIN_MM, tW - projX);
        if (projY + projH > tH) projH = Math.max(MIN_MM, tH - projY);
        if (projX < 0) { projW = Math.max(MIN_MM, projW + projX); projX = 0; }
        if (projY < 0) { projH = Math.max(MIN_MM, projH + projY); projY = 0; }
      }
      const projected: CardSlot = { ...dragged, position: { x: projX, y: projY, w: projW, h: projH } };

      // Alignment targets (other slots + card bounds).
      const targets = gatherAlignTargets(st.initialSlots, template, st.slotId);

      // Visual guides — always evaluated so the design-app affordance
      // is reproducible without holding CTRL.
      const guides = computeGuideTargets(projected, st.kind, ALIGN_THRESHOLD_MM, targets.xs, targets.ys);

      // CTRL-held snap. Translates a candidate match into a dxMm / dyMm
      // adjustment applied to the existing drag math.
      let snapDx = 0;
      let snapDy = 0;
      if (ctrlOrMeta) {
        const snap = computeSnap(projected, st.kind, ctrlOrMeta, ALIGN_THRESHOLD_MM, targets.xs, targets.ys);
        snapDx = round1(snap.dx);
        snapDy = round1(snap.dy);
      }

      const next = st.initialSlots.map((slot) => {
        if (slot.id !== st.slotId) return slot;
        const oo = slot.position;
        let x = oo.x;
        let y = oo.y;
        let w = oo.w;
        let h = oo.h;
        if (st.kind === 'move') {
          x = Math.max(0, Math.min(tW - oo.w, oo.x + dxMm + snapDx));
          y = Math.max(0, Math.min(tH - oo.h, oo.y + dyMm + snapDy));
        } else {
          if (st.kind.includes('n')) {
            const newY = Math.max(0, oo.y + dyMm + snapDy);
            const newH = Math.max(MIN_MM, oo.h + (oo.y - newY));
            y = newY;
            h = newH;
          }
          if (st.kind.includes('s')) {
            h = Math.max(MIN_MM, Math.min(tH - oo.y, oo.h + dyMm + snapDy));
          }
          if (st.kind.includes('w')) {
            const newX = Math.max(0, oo.x + dxMm + snapDx);
            const newW = Math.max(MIN_MM, oo.w + (oo.x - newX));
            x = newX;
            w = newW;
          }
          if (st.kind.includes('e')) {
            w = Math.max(MIN_MM, Math.min(tW - oo.x, oo.w + dxMm + snapDx));
          }
          if (x + w > tW) w = Math.max(MIN_MM, tW - x);
          if (y + h > tH) h = Math.max(MIN_MM, tH - y);
          if (x < 0) { w = Math.max(MIN_MM, w + x); x = 0; }
          if (y < 0) { h = Math.max(MIN_MM, h + y); y = 0; }
        }
        return { ...slot, position: { x, y, w, h } };
      });
      setLocalSlots(next);
      setDragGuides(guides);
    };
    const onUp = () => {
      const st = dragState.current;
      dragState.current = null;
      // Clear guides + commit the latest local slots. We commit the drag
      // even if the user never moved (e.g. just a click-and-release).
      setDragGuides({ vertical: [], horizontal: [] });
      if (st) onSlotsChange(localSlotsRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // If the dialog is closed mid-drag (e.g. via ESC), the listeners
      // are removed but the guides state is still set so the next mount
      // would briefly paint stale lines. Clear on unmount to be safe.
      setDragGuides({ vertical: [], horizontal: [] });
    };
  }, [onSlotsChange, template.widthMm, template.heightMm]);

  // Keyboard shortcuts: Delete removes selected slot; [ / ] swap with
  // adjacent layers (bring forward / send backward); Ctrl/Cmd+D duplicates;
  // ESC clears selection. Guards exclude MUI Selects/Autocompletes so the
  // editor's input fields and dropdowns don't trigger slot operations.
  useEffect(() => {
    const isEditableTarget = (tgt: HTMLElement | null): boolean => {
      if (!tgt) return false;
      const tag = tgt.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      if (tgt.isContentEditable) return true;
      if (tgt.closest('.MuiAutocomplete-root')) return true;
      if (tgt.closest('[role="combobox"]')) return true;
      if (tgt.closest('[role="listbox"]')) return true;
      return false;
    };
    const shiftLayer = (direction: -1 | 1) => {
      if (!selectedSlotId) return;
      const idx = template.slots.findIndex((s) => s.id === selectedSlotId);
      if (idx === -1) return;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= template.slots.length) return;
      const copy = [...template.slots];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      onSlotsChange(copy);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target as HTMLElement | null)) return;
      // ESC returns focus to the base card (template-level fields) instead
      // of clearing selection altogether, so the props panel always has a
      // sensible surface to land on.
      if (e.key === 'Escape') {
        onSelectSlot(BASE_SLOT_ID);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSlotId) {
        // The base slot is never deletable.
        if (selectedSlotId === BASE_SLOT_ID) {
          e.preventDefault();
          return;
        }
        // Honor the slot's lock flag so the keyboard shortcut can't bypass
        // the protection offered by the right-click guard and the delete
        // button in the side panel.
        const active = template.slots.find((s) => s.id === selectedSlotId);
        if (active?.locked) {
          e.preventDefault();
          return;
        }
        onSlotsChange(template.slots.filter((s) => s.id !== selectedSlotId));
        // After deleting a regular slot, the selection returns to the
        // base so the props panel still has a meaningful landing state.
        onSelectSlot(BASE_SLOT_ID);
        e.preventDefault();
        return;
      }
      // Layer keys only act on real slots — the base never moves.
      if (selectedSlotId === BASE_SLOT_ID) return;
      if (e.key === ']' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        shiftLayer(1); e.preventDefault(); return;
      }
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        shiftLayer(-1); e.preventDefault(); return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelectSlot, onSlotsChange, selectedSlotId, template.slots]);

  const accent = template.globalStyle?.accentColor ?? '#7a3a17';
  // The base "slot" that represents template-level fields (name,
  // description, size and global style). It's never stored in
  // `template.slots` — instead both visual states derive from the
  // selection id, keeping the data model clean.
  const isBaseSelected = selectedSlotId === BASE_SLOT_ID;
  // When `showLabels` is on, surface the base chip too so the user can
  // discover that the card itself is editable.
  const showBaseChip = isBaseSelected || showLabels;

  return (
    <div
      ref={containerRef}
      className="live-slot-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        // `auto` so the root catches pointerdown on empty canvas (which
        // selects the base slot). Individual slot boxes already have
        // `pointer-events: auto` and are nested inside, so a click on
        // a slot hits the slot first — bubbling up here would have
        // `e.target !== e.currentTarget` and the inline guard skips.
        pointerEvents: 'auto',
        // Show `grab` over empty canvas so the pannable affordance is
        // discoverable: {@link CardPreview}'s Paper-level drag-to-pan
        // listens for clicks on this layer (it does NOT stop
        // propagation, so Paper handlers fire after the base-slot
        // selection). When the base is selected the existing `crosshair`
        // cursor wins to keep the "edit the card itself" gesture
        // distinctive.
        cursor: isBaseSelected ? 'crosshair' : 'grab',
      }}
      onPointerDown={(e) => {
        // Clicks that landed directly on the root (i.e. nothing inside
        // it), with no slot handler having captured them, target the
        // base card. `pointer-events: none` on the visual border child
        // below keeps that path intact.
        if (e.target === e.currentTarget) onSelectSlot(BASE_SLOT_ID);
      }}
    >
      {/* Visual base layer. Always present so the dashed inset ring is a
          discoverable hint even when nothing is selected, but only styled
          as "selected" when the base id is the active selection. The
          parent root catches the click for selecting base; this child
          itself is `pointer-events: none` so it never traps the click. */}
      <div
        style={{
          position: 'absolute',
          // Percentages track the card size so the visual scales with
          // zoom the same way the slot positions do.
          inset: '2%',
          borderRadius: 4,
          border: `1.5px ${isBaseSelected ? 'solid' : 'dashed'} ${accent}`,
          backgroundColor: isBaseSelected ? `${accent}10` : 'transparent',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {showBaseChip && (
          <span
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: accent,
              color: 'white',
              padding: '0 6px',
              borderRadius: 3,
              fontSize: 9,
              lineHeight: '16px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              opacity: isBaseSelected ? 1 : 0.75,
            }}
            title={t('cards_base_slot_hint', 'Haz clic para editar nombre, descripción, tamaño y estilo global.')}
          >
            <span style={{ marginRight: 4 }}>🔒</span>
            {t('cards_base_slot_label', 'Tarjeta base')}
            <span style={{ marginLeft: 4, opacity: 0.85 }}>↕ L0/{template.slots.length}</span>
          </span>
        )}
      </div>
      {localSlots.map((slot) => {
        const isSelected = slot.id === selectedSlotId;
        const isHovered = hoveredSlotId === slot.id;
        // Borders should appear only on hover or when the slot is selected
        // — the user explicitly asked to drop the default dashed outline
        // noise so the preview mirrors the actual printed card.
        const isHighlighted = isSelected || isHovered;
        const layerIdx = localSlots.findIndex((s) => s.id === slot.id);
        const layerLabel = layerIdx >= 0 ? `L${layerIdx + 1}/${localSlots.length}` : '';
        const isLocked = !!slot.locked;
        // Inside-the-box badge draws only when the user has opted in to
        // "Show labels"; otherwise we hide it so the chip never covers the
        // slot's actual content under the author's hand.
        const showInsideBadge = showLabels;
        // Floating chip OUTSIDE the slot's bounding box: rendered for the
        // SELECTED slot when labels are off. Smart placement — prefer
        // BELOW (most cards have content stacked top→bottom), flip ABOVE
        // when there's no room below. Falls back to none when neither
        // direction has room (e.g. a full-card FRAME slot), keeping the
        // canvas quiet instead of clipping the chip off-screen.
        const slotTopPercent = (slot.position.y / template.heightMm) * 100;
        const slotBottomPercent = ((slot.position.y + slot.position.h) / template.heightMm) * 100;
        const slotCenterXPercent = ((slot.position.x + slot.position.w / 2) / template.widthMm) * 100;
        const hasRoomBelow = slotBottomPercent + FLOAT_GAP_PERCENT < 100 - NEAR_EDGE_PERCENT;
        const hasRoomAbove = slotTopPercent - FLOAT_GAP_PERCENT > NEAR_EDGE_PERCENT;
        const placeAbove = !hasRoomBelow && hasRoomAbove;
        const showFloatingBadge = isSelected && !showLabels && (hasRoomBelow || hasRoomAbove);
        return (
          <Fragment key={slot.id}>
            <div
              onPointerDown={(e) => {
                // Locked slots stay clickable so the user can still unlock them,
                // but we don't initiate a drag/resize while frozen.
                if (!isLocked) startDrag(e, 'move', slot.id);
                else onSelectSlot(slot.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                // Locked slots are protected from accidental deletion via right-click too.
                if (isLocked) return;
                onSlotsChange(template.slots.filter((s) => s.id !== slot.id));
                // Returning to the base slot keeps the props panel in a
                // meaningful landing state instead of an empty one.
                if (selectedSlotId === slot.id) onSelectSlot(BASE_SLOT_ID);
              }}
              onPointerEnter={() => {
                // Only set on real slot ids — the base card has its own hover
                // affordance and shouldn't collide with this list.
                setHoveredSlotId(slot.id);
              }}
              onPointerLeave={() => {
                // Defensive: only clear when the leaving element was the
                // active hover, so dragging the mouse across another slot
                // in one frame doesn't accidentally blank the highlight.
                setHoveredSlotId((cur) => (cur === slot.id ? null : cur));
              }}
              style={{
                position: 'absolute',
                left: `${(slot.position.x / template.widthMm) * 100}%`,
                top: `${(slot.position.y / template.heightMm) * 100}%`,
                width: `${(slot.position.w / template.widthMm) * 100}%`,
                height: `${(slot.position.h / template.heightMm) * 100}%`,
                // Border only reflects hover + selection by design; the rest
                // state stays clean so the preview looks like a real card.
                border: isHighlighted
                  ? `1.5px ${isSelected ? 'solid' : 'dashed'} ${isLocked ? '#94a3b8' : accent}`
                  : 'none',
                backgroundColor: isSelected
                  ? `${accent}20`
                  : isHovered
                    ? `${accent}08`
                    : 'transparent',
                color: isLocked ? '#475569' : accent,
                cursor: isLocked ? 'not-allowed' : isSelected ? 'grab' : (isHovered ? 'pointer' : 'default'),
                pointerEvents: 'auto',
                boxSizing: 'border-box',
                fontSize: 10,
                userSelect: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                // Inner visual layer carries the same rotation/flip as the
                // slot's RENDERED content (defined in CardRenderer). They MUST
                // stay byte-identical or the label will drift away from the
                // image when the user tilts the slot. The hitbox (parent div)
                // stays axis-aligned so drag math in screen space still works
                // without compensating for transforms.
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: slotTransform(slot),
                  transformOrigin: 'center center',
                  display: 'flex',
                  // Bottom-right so the chip is least likely to overlap the
                  // kind of content editors usually look at (image/heading
                  // area at the top of a slot).
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  padding: '1px 3px',
                  pointerEvents: 'none',
                }}
              >
                {showInsideBadge && (
                  <span style={{
                    background: isLocked ? '#475569' : accent, color: 'white',
                    padding: '0 4px', borderRadius: 3, fontSize: 9, lineHeight: '14px',
                  }}>
                    {isLocked && <span style={{ marginRight: 4 }} title="Bloqueado">🔒</span>}
                    {slot.name}
                    <span style={{ marginLeft: 4, opacity: 0.85 }} title="Layer">↕ {layerLabel}</span>
                  </span>
                )}
              </div>
              {isSelected && !isLocked && HANDLES.map((h) => (
                <div
                  key={h.type}
                  onPointerDown={(e) => startDrag(e, h.type, slot.id)}
                  style={{
                    position: 'absolute',
                    top: h.top,
                    left: h.left,
                    width: 10,
                    height: 10,
                    backgroundColor: '#fff',
                    border: `2px solid ${accent}`,
                    borderRadius: 2,
                    transform: 'translate(-50%, -50%)',
                    cursor: h.cursor,
                    pointerEvents: 'auto',
                  }}
                />
              ))}
            </div>
            {showFloatingBadge && (
              // Floating chip rendered as a SIBLING of the slot box so it
              // sits OUTSIDE the slot's visible content area and never
              // covers it. Centred on the slot's horizontal mid-line and
              // anchored below (or above when there's no room) with a
              // tiny gap. `pointerEvents: none` so it never traps clicks.
              <div
                style={{
                  position: 'absolute',
                  left: `${slotCenterXPercent}%`,
                  top: `${placeAbove ? slotTopPercent - FLOAT_GAP_PERCENT : slotBottomPercent + FLOAT_GAP_PERCENT}%`,
                  transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                  pointerEvents: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 20,
                }}
              >
                <span style={{
                  background: isLocked ? '#475569' : accent, color: 'white',
                  padding: '0 6px', borderRadius: 3, fontSize: 9, lineHeight: '16px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }}>
                  {isLocked && <span style={{ marginRight: 4 }} title="Bloqueado">🔒</span>}
                  {slot.name}
                  <span style={{ marginLeft: 4, opacity: 0.85 }} title="Layer">↕ {layerLabel}</span>
                </span>
              </div>
            )}
          </Fragment>
        );
      })}
      {/* Alignment guides (last so they paint over slots). Only rendered
          while a drag is active and at least one candidate is within
          `ALIGN_THRESHOLD_MM` of a target. `pointer-events: none` so they
          never intercept selection or drag gestures. */}
      {(dragGuides.vertical.length > 0 || dragGuides.horizontal.length > 0) && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 15,
          }}
        >
          {dragGuides.vertical.map((x) => (
            <div
              key={`vg-${x}`}
              style={{
                position: 'absolute',
                left: `${(x / template.widthMm) * 100}%`,
                top: 0,
                width: GUIDE_THICKNESS_PX,
                height: '100%',
                background: GUIDE_COLOR,
                boxShadow: '0 0 0 0.5px rgba(236,72,153,0.4)',
              }}
            />
          ))}
          {dragGuides.horizontal.map((y) => (
            <div
              key={`hg-${y}`}
              style={{
                position: 'absolute',
                top: `${(y / template.heightMm) * 100}%`,
                left: 0,
                height: GUIDE_THICKNESS_PX,
                width: '100%',
                background: GUIDE_COLOR,
                boxShadow: '0 0 0 0.5px rgba(236,72,153,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
