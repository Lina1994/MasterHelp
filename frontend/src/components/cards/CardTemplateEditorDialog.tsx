import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FlipIcon from '@mui/icons-material/Flip';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import AlignVerticalCenterIcon from '@mui/icons-material/AlignVerticalCenter';
import AlignVerticalBottomIcon from '@mui/icons-material/AlignVerticalBottom';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type {
  CardEntityPayload,
  CardSlot,
  CardTemplate,
  CardTemplateInput,
  SlotType,
} from '../../types/cardTemplates';
import type { CardGraphicElement } from '../../data/cardGraphicElements';
import CardSizeSelector from './CardSizeSelector';
import CardFieldPicker from './CardFieldPicker';
import CardPreview, { type CardPreviewHandle } from './CardPreview';
import GraphicElementsPicker from './GraphicElementsPicker';
import CardSamplePicker from './CardSamplePicker';
import { entityNormalisers } from './cardsFieldCatalog';
import { BASE_SLOT_ID } from './LiveSlotOverlay';

const SLOT_TYPE_LABELS: Record<SlotType, string> = {
  TEXT_SINGLE: 'Texto (título)',
  TEXT_MULTI: 'Texto (párrafo)',
  IMAGE: 'Imagen',
  KEY_VALUE_LIST: 'Lista clave-valor',
  DIVIDER: 'Divisor',
  FRAME: 'Marco decorativo',
  BADGE: 'Etiqueta (chip)',
};

/**
 * Sets of slot types that have visible text content. Used to gate the
 * typography block in the slot properties panel so it doesn't appear
 * on slots like IMAGE or DIVIDER where the controls would be moot.
 */
const TEXT_SLOT_TYPES: ReadonlyArray<SlotType> = ['TEXT_SINGLE', 'TEXT_MULTI', 'KEY_VALUE_LIST', 'FRAME', 'BADGE'];

/**
 * Per-slot typography: a curated list of cross-platform font stacks
 * the user can pick from. Each `MenuItem` below applies the stack
 * via `sx={{ fontFamily }}` so the option LABEL is rendered in
 * its own typeface — the visual cue the user explicitly asked for.
 * Values are full CSS `font-family` strings so the renderer pipes
 * them through unchanged.
 */
const FONT_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'System UI', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", Times, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, Tahoma, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", "Lucida Grande", sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Brush Script MT', value: '"Brush Script MT", "Lucida Handwriting", cursive' },
];

/**
 * Maps the two `textDecoration` toggles (Underline, Strikethrough)
 * onto the four supported CSS shorthand values. Both flags live
 * inside the same string so we combine them here.
 */
function computeTextDecoration(underline: boolean, strike: boolean): NonNullable<CardSlot['style']['textDecoration']> {
  if (underline && strike) return 'underline line-through';
  if (underline) return 'underline';
  if (strike) return 'line-through';
  return 'none';
}

/**
 * Read-form for the rotation `TextField`. Centralised so both rotation
 * strips (the new DIVIDER block and the legacy IMAGE-with-SVG-fallback
 * block) render the same rounded value in the picker — important
 * because `slot.rotation` is a float and a user typing `37.6°` would
 * otherwise see `38` in one strip and `37.6` in another when the
 * rounding strategy changes.
 */
function rotationInputValue(slot: CardSlot): number {
  return Math.round(slot.rotation ?? 0);
}

/**
 * Shared `onChange` for the rotation `TextField` in both the new
 * DIVIDER strip and the existing IMAGE-with-SVG-fallback strip. Pulled
 * out so the two strips cannot drift apart when one of them bumps its
 * wrap-around range or step.
 *
 * Empty input from clearing the field resolves to `Number('') → 0` in
 * a `<input type="number">` picker, which matches the "upright" render
 * state because `slotTransform` only rotates when `|rot| > 0.01`. This
 * relies on the browser filtering non-numeric keys out of the picker —
 * every modern browser does that for `type="number"`. If `type` ever
 * changes to `"text"` the guard above would also need to reject `NaN`
 * from `"abc"` and similar inputs; consider it before refactoring.
 */
function handleRotationChange(
  e: ChangeEvent<HTMLInputElement>,
  updateSelected: (next: Partial<CardSlot> | ((slot: CardSlot) => Partial<CardSlot>)) => void,
): void {
  const raw = Number(e.target.value);
  if (!Number.isFinite(raw)) return;
  updateSelected({ rotation: ((raw % 360) + 360) % 360 });
}

/**
 * Detects whether the slot's `fontWeight` represents bold. We treat
 * anything numeric ≥ 600 as bold plus the legacy string keywords,
 * matching the CSS spec's "bolder than normal" threshold.
 */
function isBoldWeight(weight: string | number | undefined): boolean {
  if (typeof weight === 'number') return weight >= 600;
  if (typeof weight === 'string') return /^(bold|bolder|[6-9]\d{2})$/i.test(weight);
  return false;
}

/** Suggests a default field path for a brand-new slot based on its type. */
function defaultBinding(type: SlotType): CardSlot['binding'] {
  switch (type) {
    case 'TEXT_SINGLE':
    case 'FRAME':
    case 'BADGE':
      return { fieldPath: 'name', fallbackText: '', isStatic: false };
    case 'TEXT_MULTI':
      return { fieldPath: 'description', fallbackText: '', isStatic: false };
    default:
      return { fallbackText: '', isStatic: false };
  }
}

/**
 * Creates a new slot anchored to the top-left of the card with sensible
 * dimensions so the layout doesn't overflow on creation. The exact
 * position is offset per existing slot count to keep things tidy.
 */
function makeDefaultSlot(index: number, total: number, type: SlotType): CardSlot {
  const baseY = 6 + index * 12;
  const isDecorative = type === 'FRAME' || type === 'DIVIDER';
  return {
    id: uuidv4(),
    name: `${SLOT_TYPE_LABELS[type]} ${total + 1}`,
    type,
    position: { x: 4, y: baseY, w: isDecorative ? 55 : 51, h: type === 'TEXT_MULTI' ? 18 : type === 'IMAGE' ? 24 : type === 'BADGE' ? 6 : type === 'FRAME' ? 14 : 10 },
    style: {
      fontSize: type === 'TEXT_SINGLE' ? 11 : type === 'TEXT_MULTI' ? 8 : type === 'BADGE' ? 7 : type === 'FRAME' ? 6 : 8,
      // `style.color` is intentionally left undefined for new slots so
      // they inherit `globalStyle.textColor` from the template. The
      // per-slot text-colour picker introduced next to the typography
      // block mirrors the inherited value, and the "Usar global" reset
      // is meaningful only when the slot has its own override. A hard-
      // coded #111111 default previously trapped users into a slot-level
      // override they had to dig out before the picker reflected the
      // template's global text colour.
      textAlign: type === 'TEXT_SINGLE' ? 'left' : 'left',
      paddingMm: type === 'TEXT_MULTI' ? 1 : 0,
      borderRadius: (type === 'BADGE' || type === 'FRAME') ? 1.5 : 0,
      backgroundColor: type === 'BADGE' ? 'rgba(122,58,23,0.15)' : undefined,
      borderColor: type === 'FRAME' ? '#7a3a17' : undefined,
      borderWidth: type === 'FRAME' ? 0.4 : 0,
      // IMAGE slots default to 'contain' so uploaded logos / crests are
      // not aggressively cropped by 'cover' on small card surfaces.
      objectFit: type === 'IMAGE' ? 'contain' : 'cover',
    },
    binding: defaultBinding(type),
    keyValueConfig: type === 'KEY_VALUE_LIST' ? { showLabel: true, isTupleArray: false } : undefined,
    dividerConfig: type === 'DIVIDER' ? { orientation: 'horizontal', thickness: 0.4, color: '#888888' } : undefined,
  };
}

const DEFAULT_BAKED_COLOR = '#7a3a17';
const COLOR_CACHE = new Map<string, string>();
/**
 * Replace a baked-in colour inside an SVG data URI with a different one.
 * Decodes the URI, swaps every occurrence of `fromColor` (case-insensitive)
 * with `toColor`, then re-encodes. Memoised on `(uri, fromColor, toColor)`
 * so successive picker changes don't re-decode the same string.
 */
function recolorDataUri(uri: string, fromColor: string, toColor: string): string {
  if (!uri || !fromColor || !toColor || fromColor.toLowerCase() === toColor.toLowerCase()) return uri;
  const key = `${fromColor.toLowerCase()}->${toColor.toLowerCase()}::${uri.length}::${uri.slice(0, 64)}`;
  const cached = COLOR_CACHE.get(key);
  if (cached) return cached;
  // data:[<mime>];<charset>,<payload> — payload is encoded SVG body.
  const commaIdx = uri.indexOf(',');
  if (commaIdx < 0) return uri;
  const header = uri.slice(0, commaIdx);
  const payloadEncoded = uri.slice(commaIdx + 1);
  let svg: string;
  try { svg = decodeURIComponent(payloadEncoded); } catch { return uri; }
  // Note: `#` is not a regex metacharacter in JS, so we don't need to
  // escape it. We construct the RegExp from a string anyway because the
  // dynamic colour value can't be a literal; the `gi` flags give us a
  // case-insensitive global replace that matches every occurrence.
  const re = new RegExp(fromColor, 'gi');
  const next = svg.replace(re, toColor);
  const out = `${header},${encodeURIComponent(next)}`;
  COLOR_CACHE.set(key, out);
  return out;
}

/**
 * Resolves the entity kind to use as a fallback when the user hasn't yet
 * picked a sample. Mirrors the inference in {@link CardPreview} so the
 * dialog and the list show the same representative data.
 */
function fallbackEntityFromSlots(
  slots: CardSlot[],
  sampleName: string,
  sampleDescription: string,
): CardEntityPayload | null {
  const firstField = slots.map((s) => s.binding?.fieldPath).find((p) => !!p);
  const kind: CardEntityPayload['kind'] = firstField?.startsWith('prerequisite')
    ? 'feat'
    : firstField?.startsWith('abilities') || firstField?.startsWith('armorClass') || firstField?.startsWith('hitPoints')
      ? 'monster'
      : firstField?.startsWith('className') || firstField?.startsWith('dexterity')
        ? 'character'
        : firstField?.startsWith('price')
          ? 'shop-item'
          : 'spell';
  return entityNormalisers[kind]({
    id: 'sample',
    name: sampleName,
    description: sampleDescription,
    origin: 'manual',
    level: 3,
    school: 'Evocación',
    castingTime: '1 acción',
    range: '45 m',
    duration: 'Instantáneo',
    components: 'V, S, M',
  } as any);
}

export default function CardTemplateEditorDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: CardTemplate | null;
  onClose: () => void;
  onSave: (input: CardTemplateInput) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sizePreset, setSizePreset] = useState<CardTemplate['sizePreset']>(initial?.sizePreset ?? 'POKER');
  const [orientation, setOrientation] = useState<CardTemplate['orientation']>(initial?.orientation ?? 'portrait');
  const [widthMm, setWidthMm] = useState<number>(initial?.widthMm ?? 63);
  const [heightMm, setHeightMm] = useState<number>(initial?.heightMm ?? 88);
  const [globalStyle, setGlobalStyle] = useState<CardTemplate['globalStyle']>(
    initial?.globalStyle ?? { backgroundColor: '#fdfaf3', borderColor: '#3b2a1a', borderWidthMm: 0.5, textColor: '#1b1b1b', accentColor: '#7a3a17' },
  );
  const [slots, setSlots] = useState<CardSlot[]>(initial?.slots ?? []);
  // The dialog always opens on the BASE_SLOT_ID so the user lands on
  // the template-level fields (name / description / size / global
  // style). Selecting any real slot hides those fields until the user
  // re-selects the base, mirroring how slot properties take over when
  // a slot is clicked.
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(initial?.slots?.[0]?.id ?? BASE_SLOT_ID);
  const [saving, setSaving] = useState(false);
  const [graphicPickerOpen, setGraphicPickerOpen] = useState(false);
  // User-controlled zoom on the preview canvas. 1 = fit-to-window, >1
  // enlarges the card so fine alignment becomes easier, <1 squeezes more
  // of the card into the available column.
  const [zoom, setZoom] = useState(1);
  // Whether the LiveSlotOverlay should always-on show each slot's name +
  // layer badge. Off by default so the preview mirrors the real printed
  // card; toggled on when the author needs explicit slot identification.
  const [showLabels, setShowLabels] = useState(false);
  // Sample entity the live preview should render against. `null` means
  // "use the synthetic fallback computed from the slot bindings"; any
  // non-null value overrides the fallback and feeds the preview with a
  // real backend record that {@link CardSamplePicker} surfaced. Reset
  // to `null` on every dialog (re)open so a previously-picked sample
  // doesn't leak into the next session.
  const [previewSampleEntity, setPreviewSampleEntity] = useState<CardEntityPayload | null>(null);
  // Handle into the CardPreview instance so the zoom toolbar's pan
  // arrows can drive `scrollBy(dx, dy)` without forcing the user to
  // scroll the column vertically to reach the inner Paper's scrollbars
  // first. Cleared automatically by React when the preview unmounts.
  const cardPreviewRef = useRef<CardPreviewHandle | null>(null);
  /**
   * Mirror of the preview Paper's scroll bounds, owned locally so the
   * pan-arrow `disabled` flags below re-render whenever the Paper
   * scrolls. Driven by {@link CardPreview}'s `onScrollBoundsChange`
   * callback, which fires synchronously inside a `useLayoutEffect` so
   * the freshly-updated value is in place before the first browser
   * paint of the next frame. Defaults every direction to `false`
   * because any boundary we haven't yet measured is conservatively
   * "no further scroll possible" — matches what the rendered Paper
   * will report on its first measurement anyway.
   */
  const [cardPreviewScrollBounds, setCardPreviewScrollBounds] = useState<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  /** Discrete zoom levels exposed in the toolbar; Ctrl+wheel walks between them. */
  const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
  /**
   * Pan-arrows step size. 40 css px is small enough that a single click
   * feels like a precise nudge rather than a jump (good for users
   * centring on a specific landmark of a zoomed card), and big enough
   * to traverse the typical previsualización (300–500 px wide column)
   * in 8–12 clicks. Browser boundary clamping in `scrollBy` keeps the
   * last step from overshooting; each button also queries
   * `cardPreviewRef.current?.canScroll(axis, direction)` to disable
   * itself when no further scroll is possible in that direction.
   */
  const PAN_STEP_PX = 40;
  const clampZoom = (value: number) => Math.max(0.25, Math.min(4, value));
  const zoomIn = () => {
    // Snap to the next preset level so the indicator is predictable.
    const next = ZOOM_LEVELS.find((lvl) => lvl > zoom + 0.001) ?? zoom;
    setZoom(clampZoom(next));
  };
  const zoomOut = () => {
    const next = [...ZOOM_LEVELS].reverse().find((lvl) => lvl < zoom - 0.001) ?? zoom;
    setZoom(clampZoom(next));
  };
  const zoomReset = () => setZoom(1);
  /**
   * Ctrl/Cmd + wheel handler attached to the preview canvas. Plain wheel
   * events pass through so users can still scroll a zoomed card when the
   * paper overflows.
   */
  const onPreviewWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => clampZoom(z + step));
  };

  // Re-hydrate the form whenever the dialog opens or we switch templates.
  // Keying on `initial?.id` is intentional so unrelated re-renders don't
  // wipe draft edits.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setSizePreset(initial?.sizePreset ?? 'POKER');
    setOrientation(initial?.orientation ?? 'portrait');
    setWidthMm(initial?.widthMm ?? 63);
    setHeightMm(initial?.heightMm ?? 88);
    setGlobalStyle(initial?.globalStyle ?? { backgroundColor: '#fdfaf3', borderColor: '#3b2a1a', borderWidthMm: 0.5, textColor: '#1b1b1b', accentColor: '#7a3a17' });
    setSlots(initial?.slots ?? []);
    setSelectedSlotId(initial?.slots?.[0]?.id ?? BASE_SLOT_ID);
    // Reset the preview sample so a pick from a previous open doesn't
    // bleed into the freshly-hydrated template — the new slots may
    // bind to different fields whose value the old sample cannot
    // provide.
    setPreviewSampleEntity(null);
  }, [open, initial?.id]);

  const previewTemplate: CardTemplate = useMemo(() => ({
    id: initial?.id ?? 'preview',
    name,
    description,
    widthMm, heightMm, orientation, sizePreset,
    globalStyle,
    slots,
    createdAt: initial?.createdAt ?? new Date().toISOString(),
    updatedAt: initial?.updatedAt ?? new Date().toISOString(),
  }), [name, description, widthMm, heightMm, orientation, sizePreset, globalStyle, slots, initial]);

  const fallbackEntity = useMemo<CardEntityPayload | null>(() => fallbackEntityFromSlots(
    slots,
    t('cards_sample_name', 'Bola de fuego'),
    t('cards_sample_description', 'Una bola de fuego abrasadora estalla desde un punto a elección dentro del alcance, expandiéndose para llenar una esfera de 6 metros de radio...'),
  ), [slots, t]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;
  // The base "slot" represents template-level fields (name, description,
  // size and global style). We show those fields when the base slot is
  // selected OR when nothing is selected (defensive — the editor
  // defaults to base). Picking any real slot hides them.
  const isBaseSelected = selectedSlotId === BASE_SLOT_ID;
  const showBaseInfo = isBaseSelected || selectedSlotId === null;
  /**
   * Update the selected slot. Accepts either a partial object (read-then-
   * merge) or a transformer callback that receives the LATEST copy of
   * the slot from `slots[]`. The callback form is required for
   * multi-step toggles (e.g. Underline + Strikethrough on the same
   * text-decoration field) where reading from `selectedSlot.style`
   * inside the click handler would observe a stale pre-click value if
   * the user taps U and S faster than React's render cycle.
   */
  const updateSelected = (
    next: Partial<CardSlot> | ((slot: CardSlot) => Partial<CardSlot>),
  ) => {
    if (!selectedSlot) return;
    setSlots((prev) => prev.map((s) => {
      if (s.id !== selectedSlot.id) return s;
      const partial = typeof next === 'function' ? next(s) : next;
      return { ...s, ...partial };
    }));
  };
  const addSlot = (type: SlotType) => {
    const slot = makeDefaultSlot(slots.length, slots.length, type);
    setSlots((prev) => [...prev, slot]);
    setSelectedSlotId(slot.id);
  };
  const addGraphicElement = (element: CardGraphicElement) => {
    // Place the new image slot centered-ish near the middle of the card so
    // it's visible without overlapping the existing template borders.
    const slot: CardSlot = {
      id: uuidv4(),
      name: element.id,
      type: 'IMAGE',
      position: {
        // Photos/logo slots should be trivially movable afterwards.
        x: Math.max(0, (widthMm - element.defaultSizeMm.w) / 2),
        y: Math.max(0, (heightMm - element.defaultSizeMm.h) / 2),
        w: Math.min(widthMm, element.defaultSizeMm.w),
        h: Math.min(heightMm, element.defaultSizeMm.h),
      },
      style: { objectFit: 'contain' },
      // The data URI travels with the template as static content — no
      // external host needed, and the auto-detection in CardFieldPicker
      // recognises this as an uploaded image rather than a label.
      binding: { isStatic: true, fallbackText: element.dataUri, fieldPath: '' },
    };
    setSlots((prev) => [...prev, slot]);
    setSelectedSlotId(slot.id);
  };
  const moveSlot = (direction: -1 | 1) => {
    if (!selectedSlot) return;
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.id === selectedSlot.id);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, moved);
      return copy;
    });
  };
  const removeSlot = () => {
    if (!selectedSlot) return;
    setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
    setSelectedSlotId(null);
  };

  // --- Slot alignment / distribution helpers ---------------------------
  // The "align with" + "match size" buttons need a target slot. We
  // auto-pick the first unlocked slot other than the selected one so the
  // panel is immediately useful, and reset the pick whenever the user
  // changes selection or the target gets removed / locked.
  const [alignTargetId, setAlignTargetId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedSlotId) {
      setAlignTargetId(null);
      return;
    }
    const current = alignTargetId ? slots.find((s) => s.id === alignTargetId) : null;
    if (current && current.id !== selectedSlotId && !current.locked) return;
    const fallback = slots.find((s) => s.id !== selectedSlotId && !s.locked) ?? null;
    setAlignTargetId(fallback?.id ?? null);
    // alignTargetId intentionally not in deps: it serves only to detect
    // staleness, the effect re-evaluates from `slots` + `selectedSlotId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlotId, slots]);

  const alignTargetOptions = useMemo(
    () => slots
      .filter((s) => s.id !== selectedSlotId && !s.locked)
      .map((s) => ({ id: s.id, label: s.name })),
    [slots, selectedSlotId],
  );

  const otherUnlockedCount = useMemo(
    () => slots.filter((s) => s.id !== selectedSlotId && !s.locked).length,
    [slots, selectedSlotId],
  );

  /** Centre a slot on the card along one or both axes. */
  const centerOnCard = (axis: 'h' | 'v' | 'both') => {
    if (!selectedSlot) return;
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const next = { ...selectedSlot.position };
    if (axis === 'h' || axis === 'both') {
      next.x = Math.max(
        0,
        Math.min(widthMm - selectedSlot.position.w, round1((widthMm - selectedSlot.position.w) / 2)),
      );
    }
    if (axis === 'v' || axis === 'both') {
      next.y = Math.max(
        0,
        Math.min(heightMm - selectedSlot.position.h, round1((heightMm - selectedSlot.position.h) / 2)),
      );
    }
    updateSelected({ position: next });
  };

  /**
   * Align the selected slot to the target along one axis. `axis` is the
   * axis being modified (`x` = horizontal position / `y` = vertical
   * position); `kind` chooses how the slot's own edge maps onto the
   * target.
   */
  const alignWith = (axis: 'x' | 'y', kind: 'start' | 'center' | 'end') => {
    if (!selectedSlot || !alignTargetId) return;
    const target = slots.find((s) => s.id === alignTargetId);
    if (!target) return;
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const next = { ...selectedSlot.position };
    if (axis === 'x') {
      if (kind === 'start') next.x = target.position.x;
      else if (kind === 'end') next.x = target.position.x + target.position.w - selectedSlot.position.w;
      else next.x = target.position.x + round1((target.position.w - selectedSlot.position.w) / 2);
      next.x = Math.max(0, Math.min(widthMm - selectedSlot.position.w, round1(next.x)));
    } else {
      if (kind === 'start') next.y = target.position.y;
      else if (kind === 'end') next.y = target.position.y + target.position.h - selectedSlot.position.h;
      else next.y = target.position.y + round1((target.position.h - selectedSlot.position.h) / 2);
      next.y = Math.max(0, Math.min(heightMm - selectedSlot.position.h, round1(next.y)));
    }
    updateSelected({ position: next });
  };

  /** Copy the target slot's width + height onto the selected slot. */
  const matchSizeWithTarget = () => {
    if (!selectedSlot || !alignTargetId) return;
    const target = slots.find((s) => s.id === alignTargetId);
    if (!target) return;
    const round1 = (v: number) => Math.round(v * 10) / 10;
    updateSelected({
      position: {
        ...selectedSlot.position,
        w: round1(Math.max(1, Math.min(widthMm - selectedSlot.position.x, target.position.w))),
        h: round1(Math.max(1, Math.min(heightMm - selectedSlot.position.y, target.position.h))),
      },
    });
  };

  /**
   * Distribute the selected slot along an axis together with every other
   * unlocked slot so all the slots sit at equal intervals between the
   * leftmost and rightmost. With a single neighbour the math degenerates
   * and we simply align centres with it; with none we no-op.
   */
  const distributeAlong = (axis: 'x' | 'y') => {
    if (!selectedSlot || otherUnlockedCount === 0) return;
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const sortFn = (s: CardSlot) => axis === 'x'
      ? s.position.x + s.position.w / 2
      : s.position.y + s.position.h / 2;
    const othersCentres = slots
      .filter((s) => s.id !== selectedSlot.id && !s.locked)
      .map(sortFn)
      .sort((a, b) => a - b);
    let newCentre: number;
    if (othersCentres.length === 1) {
      newCentre = othersCentres[0];
    } else {
      // Insert the selected slot's centre into the sorted sequence, then
      // distribute [min..max] at equal intervals. The selected slot
      // takes whichever index it currently occupies so the operation is
      // idempotent.
      const selCentre = sortFn(selectedSlot);
      const all = [...othersCentres, selCentre].sort((a, b) => a - b);
      const selIdx = all.indexOf(selCentre);
      const min = all[0];
      const max = all[all.length - 1];
      newCentre = min + (selIdx * (max - min) / (all.length - 1));
    }
    const next = { ...selectedSlot.position };
    if (axis === 'x') {
      next.x = round1(Math.max(0, Math.min(widthMm - selectedSlot.position.w, newCentre - selectedSlot.position.w / 2)));
    } else {
      next.y = round1(Math.max(0, Math.min(heightMm - selectedSlot.position.h, newCentre - selectedSlot.position.h / 2)));
    }
    updateSelected({ position: next });
  };
  /**
   * Clone the currently selected slot. The copy keeps every visual
   * property (style, binding, rotation, flip, colours) but always starts
   * UNLOCKED so the user can reposition it immediately. The clone is
   * offset by 4mm in x and y so it lands next to the original, gets a
   * fresh UUID, gets a "(Copia)" name suffix, and is auto-selected.
   */
  const duplicateSlot = useCallback(() => {
    if (!selectedSlot) return;
    const OFFSET = 4;
    const clone: CardSlot = {
      ...selectedSlot,
      id: uuidv4(),
      // Fresh editable copy: clear the lock so the user can drag/resize.
      locked: false,
      name: t('cards_slot_copy_suffix', '{{name}} (Copia)', { name: selectedSlot.name }),
      position: {
        x: Math.max(0, Math.min(widthMm - selectedSlot.position.w, selectedSlot.position.x + OFFSET)),
        y: Math.max(0, Math.min(heightMm - selectedSlot.position.h, selectedSlot.position.y + OFFSET)),
        w: selectedSlot.position.w,
        h: selectedSlot.position.h,
      },
    };
    setSlots((prev) => [...prev, clone]);
    setSelectedSlotId(clone.id);
  }, [selectedSlot, widthMm, heightMm, t]);

  /**
   * Keyboard shortcut: Ctrl/Cmd + D duplicates the selected slot. We
   * prevent the browser's default "bookmark this page" behaviour and
   * reuse the same logic as the toolbar button. The window listener is
   * cleaned up when the dialog closes. `open`, `duplicateSlot`, and
   * `selectedSlot` are all in lexical scope by the time this effect
   * fires, so a forwardRef hack is unnecessary.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'd') return;
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      const tag = tgt.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable) return;
      e.preventDefault();
      duplicateSlot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, duplicateSlot]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || t('cards_default_template_name', 'Plantilla sin título'),
        description: description.trim() || null,
        widthMm, heightMm, orientation, sizePreset,
        globalStyle,
        slots,
      });
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!initial;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      sx={{
        // MUI's `maxWidth="xl"` preset caps at ~1536px which is too
        // tight for the 3-column grid on ≥1080p monitors — the preview
        // column shrinks past the point where slot dragging and pan
        // arrows feel comfortable. We bypass the preset and apply an
        // explicit paper size so the dialog feels "large but bounded":
        //   • `min(1680px, 96vw)` keeps the paper under 96 % of the
        //     viewport width so the dialog can never escape the window;
        //   • `92vh` tall leaves room for the chrome (DialogTitle +
        //     DialogActions) and the inner grid scales accordingly.
        '& .MuiDialog-paper': {
          width: 'min(1680px, 96vw)',
          maxWidth: '96vw',
          height: '92vh',
          maxHeight: '96vh',
          // Flex column so DialogTitle sits at the top with its natural
          // height, DialogActions sits at the bottom with its natural
          // height, and the middle DialogContent (with `flex: 1` and
          // `minHeight: 0` below) absorbs whatever remains. Without
          // this layout the paper would auto-size to the SUM of its
          // children's intrinsic heights — meaning a viewport-relative
          // `height: 92vh` set inside the inner grid would silently
          // overflow and the bottom row of the slot list would clip.
          // minHeight: 0 is essential: flex items default to minHeight:
          // auto, which respects the content's intrinsic minimum and
          // re-introduces the overflow we are trying to avoid.
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        },
      }}
    >
      <DialogTitle>
        {isEditing ? t('cards_edit_template_title', 'Editar plantilla') : t('cards_new_template_title', 'Nueva plantilla')}
      </DialogTitle>
      {/*
        DialogContent sits between DialogTitle and DialogActions, both
        of which have intrinsic heights (the title is a single line;
        the actions row the "Save / Cancel" buttons). With the paper
        in `flexDirection: column`, declaring `flex: 1` here lets this
        content area absorb the leftover vertical space while
        `minHeight: 0` keeps the flex item from refusing to shrink
        below its content's intrinsic minimum. `overflow: hidden` is
        conservative: any future descendant that overflows vertically
        (e.g. a long slot list with very narrow columns) will scroll
        inside its own scroll container instead of bubbling out and
        clipping the paper edge.
      */}
      <DialogContent dividers sx={{ p: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/*
          3-column grid on lg+ screens. The preview gets the unused 1fr so it
          dominates the editor; the two sidebars are fixed at 320px and 360px
          so they don't fight for space when the user resizes the dialog. On
          small screens we collapse to a single column — the slot list, slot
          properties and preview stack vertically.
        */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '260px 280px 1fr', lg: '320px 360px 1fr' },
          // `gridAutoRows: 'minmax(0, 1fr)'` is the load-bearing line
          // that makes this layout actually work at runtime. Without
          // it, CSS Grid defaults `grid-auto-rows` to `auto`, sizing the
          // (single) row to the MAX intrinsic height of its three
          // children — the slot list, the properties column and the
          // preview column. The properties column is the long one
          // (multiple accordions + typography + colour pickers) and
          // routinely exceeds the flex-laid-out DialogContent height.
          // The `minmax(0, 1fr)` trick forces the row to honour the
          // container's height (the `0` lower bound is what makes it
          // possible for the row to shrink below its children — the
          // default `1fr` resolves to `minmax(auto, 1fr)` which still
          // pins the row to its content's intrinsic minimum and
          // reintroduces the very overflow we want to avoid). With
          // this in place, the properties column's own `overflowY:
          // 'auto'` finally triggers and its bottom controls stay
          // reachable instead of being silently clipped by the paper's
          // outer `overflow: 'hidden'`. Applied at every breakpoint
          // (no responsive object wrapping) so xs/sm — where the grid
          // template collapses to a single column and the three
          // children stack as three rows — get the same protection:
          // each panel takes a 1fr slice of the paper height and
          // scrolls internally, instead of the grid-default behaviour
          // of growing the rows to their intrinsic content height and
          // silently clipping via `overflow: 'hidden'`.
          gridAutoRows: 'minmax(0, 1fr)',
          // `height: '100%'` fills the DialogContent above, which itself
          // takes whatever space the flex layout has left after the
          // chrome (DialogTitle + DialogActions). This is robust against
          // chip / chip-row width changes and against future additions
          // to the chrome row that would otherwise force the inner grid
          // to re-tune a vh constant by hand. The `minHeight` is scoped
          // to md+ so the grid still scrolls comfortably on a small
          // single-column layout (xs/sm) where the dialog collapses to
          // one stacked column — overriding the flex from below 720 px
          // there would clip the dialog paper itself.
          height: '100%',
          minHeight: { md: 720 },
        }}>
          {/* Column 1 – Slot list + add-slot controls */}
          <Box sx={{ borderRight: { md: '1px solid' }, borderColor: 'divider', overflowY: 'auto' }}>
            <Stack direction="row" spacing={1} sx={{ p: 2 }} alignItems="center">
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('cards_add_slot', 'Añadir slot')}</InputLabel>
                <Select
                  label={t('cards_add_slot', 'Añadir slot')}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value as SlotType;
                    if (v) addSlot(v);
                  }}
                >
                  {(Object.keys(SLOT_TYPE_LABELS) as SlotType[]).map((k) => (
                    <MenuItem key={k} value={k}>{SLOT_TYPE_LABELS[k]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title={t('cards_add_graphic', 'Añadir gráfico')}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setGraphicPickerOpen(true)}
                  aria-label={t('cards_add_graphic', 'Añadir gráfico')}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Divider />
            {/*
              The base "slot" — template-level fields (name, description,
              size, global style). Rendered as a non-deletable entry at the
              top of the list, with the same click-to-select affordance as
              regular slots but no reorder / duplicate / delete buttons.
              Clicking it (or an empty area of the canvas) puts the props
              panel back into base-info mode, hiding the slot-specific
              controls until the user re-selects a real slot.
            */}
            <Box
              onClick={() => setSelectedSlotId(BASE_SLOT_ID)}
              data-base-slot-list-entry
              sx={{
                p: 1.25,
                cursor: 'pointer',
                bgcolor: selectedSlotId === BASE_SLOT_ID ? 'action.selected' : 'transparent',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: selectedSlotId === BASE_SLOT_ID ? 'action.selected' : 'action.hover' },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
                  <LockIcon
                    fontSize="inherit"
                    sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary', verticalAlign: 'middle' }}
                  />
                  {t('cards_base_slot_label', 'Tarjeta base')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('cards_base_slot_type_placeholder', 'Plantilla')}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
                {/* Spacer keeps the row layout identical to a slot entry.
                    No arrows, duplicate, or delete — base is immutable. */}
                <Box sx={{ flex: 1 }} />
                <Chip
                  size="small"
                  label={t('cards_base_layer_chip', 'L0/{{total}}', { total: slots.length })}
                  sx={{ ml: 0.5, height: 20, fontSize: 10 }}
                />
                <Chip
                  size="small"
                  label={t('cards_slot_lock_badge', 'Bloqueada')}
                  sx={{ ml: 0.5, height: 20, fontSize: 10 }}
                  color="default"
                />
              </Stack>
            </Box>
            {slots.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">
                  {t('cards_no_slots', 'Esta plantilla aún no tiene slots. Usa el menú superior para añadir el primero.')}
                </Typography>
              </Box>
            ) : (
              <Box>
                {slots.map((slot, idx) => (
                  <Box
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    sx={{
                      p: 1.25, cursor: 'pointer',
                      bgcolor: slot.id === selectedSlotId ? 'action.selected' : 'transparent',
                      borderBottom: '1px solid', borderColor: 'divider',
                      '&:hover': { bgcolor: slot.id === selectedSlotId ? 'action.selected' : 'action.hover' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
                        {slot.locked && (
                          <LockIcon
                            fontSize="inherit"
                            sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary', verticalAlign: 'middle' }}
                          />
                        )}
                        {slot.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {SLOT_TYPE_LABELS[slot.type]}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
                      <Tooltip title={t('cards_action_layer_forward', 'Subir de capa (tecla ])')}>
                        <span>
                          <IconButton size="small" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveSlot(-1); }}>
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('cards_action_layer_backward', 'Bajar de capa (tecla [)')}>
                        <span>
                          <IconButton size="small" disabled={idx === slots.length - 1} onClick={(e) => { e.stopPropagation(); moveSlot(1); }}>
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('cards_slot_duplicate', 'Duplicar slot')}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicateSlot(); }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={!!slot.locked}
                            onClick={(e) => { e.stopPropagation(); removeSlot(); }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Chip
                        size="small"
                        label={t('cards_layer_badge', 'Capa {{layer}}/{{total}}', { layer: idx + 1, total: slots.length })}
                        sx={{ ml: 0.5, height: 20, fontSize: 10 }}
                      />
                      {slot.locked && (
                        <Chip
                          size="small"
                          label={t('cards_slot_lock_badge', 'Bloqueada')}
                          sx={{ ml: 0.5, height: 20, fontSize: 10 }}
                          color="default"
                        />
                      )}
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Column 2 – Property editor + global settings */}
          <Box sx={{ overflowY: 'auto', p: 2, borderRight: { md: '1px solid' }, borderColor: 'divider' }}>
            <Stack spacing={2}>
              {/*
                Base-info section. Visible only when the BASE_SLOT_ID is the
                active selection (or, defensively, when nothing is selected).
                The base entry in the slot list, the dashed ring on the
                canvas and the click-on-empty-canvas affordance all flip
                this branch on; selecting any real slot flips it off.
              */}
              {showBaseInfo ? (
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip
                      size="small"
                      color="primary"
                      label={t('cards_props_title_base', 'Tarjeta base')}
                      icon={<LockIcon fontSize="small" />}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('cards_base_slot_hint', 'Haz clic para editar nombre, descripción, tamaño y estilo global.')}
                    </Typography>
                  </Stack>
                  <Divider />
                  <TextField
                    size="small"
                    label={t('cards_field_name', 'Nombre de la plantilla')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label={t('cards_field_description', 'Descripción (opcional)')}
                    value={description ?? ''}
                    onChange={(e) => setDescription(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <CardSizeSelector
                    sizePreset={sizePreset}
                    orientation={orientation}
                    widthMm={widthMm}
                    heightMm={heightMm}
                    onChange={({ sizePreset: sp, orientation: o, widthMm: w, heightMm: h }) => {
                      setSizePreset(sp);
                      setOrientation(o);
                      setWidthMm(w);
                      setHeightMm(h);
                    }}
                  />

                  <Accordion disableGutters elevation={0} defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">{t('cards_section_global_style', 'Estilo global')}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1}>
                          <TextField size="small" type="color" label={t('cards_global_background', 'Fondo')} value={globalStyle.backgroundColor ?? '#ffffff'} onChange={(e) => setGlobalStyle({ ...globalStyle, backgroundColor: e.target.value })} sx={{ width: 120 }} />
                          <TextField size="small" type="color" label={t('cards_global_text', 'Texto')} value={globalStyle.textColor ?? '#000000'} onChange={(e) => setGlobalStyle({ ...globalStyle, textColor: e.target.value })} sx={{ width: 120 }} />
                          <TextField size="small" type="color" label={t('cards_global_accent', 'Acento')} value={globalStyle.accentColor ?? '#cccccc'} onChange={(e) => setGlobalStyle({ ...globalStyle, accentColor: e.target.value })} sx={{ width: 120 }} />
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <TextField size="small" type="color" label={t('cards_global_border', 'Borde')} value={globalStyle.borderColor ?? '#000000'} onChange={(e) => setGlobalStyle({ ...globalStyle, borderColor: e.target.value })} sx={{ width: 120 }} />
                          <TextField size="small" type="number" label={t('cards_global_border_width', 'Grosor del borde (mm)')} value={globalStyle.borderWidthMm ?? 0} onChange={(e) => setGlobalStyle({ ...globalStyle, borderWidthMm: Number(e.target.value) || 0 })} sx={{ width: 160 }} inputProps={{ min: 0, max: 5, step: 0.1 }} />
                        </Stack>
                        <TextField
                          size="small"
                          label={t('cards_global_font', 'Familia tipográfica')}
                          value={globalStyle.fontFamily ?? ''}
                          onChange={(e) => setGlobalStyle({ ...globalStyle, fontFamily: e.target.value })}
                          placeholder="system-ui, Georgia, ..."
                          fullWidth
                        />
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              ) : null}

              {selectedSlot && (
                <>
                  <Divider />
                  <Typography variant="subtitle2">
                    {t('cards_slot_properties_title', 'Propiedades del slot')}
                  </Typography>
                </>
              )}

              {selectedSlot && (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                      size="small"
                      label={t('cards_slot_label', 'Etiqueta interna')}
                      value={selectedSlot.name}
                      onChange={(e) => updateSelected({ name: e.target.value })}
                      sx={{ flex: 1, minWidth: 160 }}
                    />
                    <Tooltip
                      title={
                        selectedSlot.locked
                          ? t('cards_slot_unlock_toggle', 'Desbloquear capa')
                          : t('cards_slot_lock_toggle', 'Bloquear capa (no se puede arrastrar / redimensionar)')
                      }
                    >
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Switch
                            size="small"
                            checked={!!selectedSlot.locked}
                            onChange={(_, checked) => updateSelected({ locked: checked })}
                            icon={<LockOpenIcon fontSize="small" />}
                            checkedIcon={<LockIcon fontSize="small" />}
                          />
                        }
                        label={
                          selectedSlot.locked
                            ? t('cards_slot_lock_badge', 'Bloqueada')
                            : t('cards_slot_unlock_toggle', 'Desbloqueada')
                        }
                      />
                    </Tooltip>
                    <Tooltip title={t('cards_slot_duplicate', 'Duplicar slot (Ctrl/Cmd+D)')}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon fontSize="small" />}
                        onClick={duplicateSlot}
                      >
                        {t('cards_slot_duplicate', 'Duplicar slot')}
                      </Button>
                    </Tooltip>
                    {selectedSlot.locked && (
                      <Chip
                        size="small"
                        icon={<LockIcon fontSize="small" />}
                        label={t('cards_slot_lock_badge', 'Bloqueada')}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" type="number" label="X" value={selectedSlot.position.x} onChange={(e) => updateSelected({ position: { ...selectedSlot.position, x: Number(e.target.value) || 0 } })} sx={{ width: 70 }} />
                    <TextField size="small" type="number" label="Y" value={selectedSlot.position.y} onChange={(e) => updateSelected({ position: { ...selectedSlot.position, y: Number(e.target.value) || 0 } })} sx={{ width: 70 }} />
                    <TextField size="small" type="number" label="W" value={selectedSlot.position.w} onChange={(e) => updateSelected({ position: { ...selectedSlot.position, w: Number(e.target.value) || 1 } })} sx={{ width: 70 }} />
                    <TextField size="small" type="number" label="H" value={selectedSlot.position.h} onChange={(e) => updateSelected({ position: { ...selectedSlot.position, h: Number(e.target.value) || 1 } })} sx={{ width: 70 }} />
                  </Stack>
                  {/* Alignment / distribution helpers. Same dashed-bordered
                      stack treatment as the border block below so the user
                      can decode them as "geometry helpers" at a glance. */}
                  <Stack
                    spacing={1}
                    sx={{
                      p: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1.25,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {t('cards_section_align_distribute', 'Alinear / Distribuir')}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" sx={{ mr: 0.5 }}>
                        {t('cards_align_center_label', 'Centrar:')}
                      </Typography>
                      <Tooltip title={t('cards_align_center_h', 'Centrar horizontalmente')}>
                        <IconButton size="small" onClick={() => centerOnCard('h')}>
                          <AlignHorizontalCenterIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('cards_align_center_v', 'Centrar verticalmente')}>
                        <IconButton size="small" onClick={() => centerOnCard('v')}>
                          <AlignVerticalCenterIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('cards_align_center_both', 'Centrar en la carta (ambos ejes)')}>
                        <IconButton size="small" color="primary" onClick={() => centerOnCard('both')}>
                          <CenterFocusStrongIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Divider />
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="caption" sx={{ flex: 1, mr: 1 }}>
                          {t('cards_align_with', 'Alinear con:')}
                        </Typography>
                        <FormControl size="small" sx={{ flex: 2, minWidth: 130 }}>
                          <Select
                            value={alignTargetId ?? ''}
                            onChange={(e) => setAlignTargetId(e.target.value as string)}
                            displayEmpty
                            disabled={alignTargetOptions.length === 0}
                          >
                            <MenuItem value="" disabled>
                              {t('cards_align_target_placeholder', '— elige un slot —')}
                            </MenuItem>
                            {alignTargetOptions.map(({ id, label }) => (
                              <MenuItem key={id} value={id}>{label}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={t('cards_align_left', 'Alinear bordes izquierdos')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('x', 'start')}>
                              <AlignHorizontalLeftIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_align_h_center', 'Alinear centros horizontales')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('x', 'center')}>
                              <AlignHorizontalCenterIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_align_right', 'Alinear bordes derechos')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('x', 'end')}>
                              <AlignHorizontalRightIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={t('cards_align_top', 'Alinear bordes superiores')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('y', 'start')}>
                              <AlignVerticalTopIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_align_v_center', 'Alinear centros verticales')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('y', 'center')}>
                              <AlignVerticalCenterIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_align_bottom', 'Alinear bordes inferiores')}>
                          <span>
                            <IconButton size="small" disabled={!alignTargetId} onClick={() => alignWith('y', 'end')}>
                              <AlignVerticalBottomIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    <Divider />
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Tooltip title={t('cards_match_size', 'Igual tamaño que el slot elegido')}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AspectRatioIcon fontSize="small" />}
                            onClick={matchSizeWithTarget}
                            disabled={!alignTargetId}
                          >
                            {t('cards_match_size', 'Mismo tamaño')}
                          </Button>
                        </span>
                      </Tooltip>
                      <Box sx={{ flex: 1 }} />
                      <Tooltip title={t('cards_distribute_h', 'Distribuir horizontal (igual separación entre slots)')}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SwapHorizIcon fontSize="small" />}
                            onClick={() => distributeAlong('x')}
                            disabled={otherUnlockedCount === 0}
                          >
                            {t('cards_distribute_h', 'Distribuir H')}
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('cards_distribute_v', 'Distribuir vertical (igual separación entre slots)')}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SwapVertIcon fontSize="small" />}
                            onClick={() => distributeAlong('y')}
                            disabled={otherUnlockedCount === 0}
                          >
                            {t('cards_distribute_v', 'Distribuir V')}
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                    {otherUnlockedCount === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {t('cards_distribute_disabled_hint', 'Añade al menos otro slot desbloqueado para usar las herramientas de alineación.')}
                      </Typography>
                    )}
                  </Stack>
                  {/*
                    Slot-level border controls. The "card border" the user
                    sees on the starter templates (mtg/pokemon/tarot) is in
                    fact a FRAME slot whose styling lives in slot.style, not
                    in globalStyle.borderWidthMm (the starters set no global
                    width). Exposing the colour + width + reset here lets the
                    user recolour that frame directly without having to hunt
                    for the right globalStyle field.
                  */}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{
                      p: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1.25,
                      // DIVIDER has no boxing — the generic "Color borde"/
                      // "Grosor" controls write to `style.borderColor`/
                      // `style.borderWidth`, which the divider renderer
                      // never reads (it picks up `dividerConfig.color`).
                      // Hide them for DIVIDER so the user lands on the
                      // dedicated divider block instead of two colour
                      // sections that look unrelated.
                      display: selectedSlot.type === 'DIVIDER' ? 'none' : 'flex',
                    }}
                  >
                    <TextField
                      size="small"
                      type="color"
                      label={t('cards_slot_border_color', 'Color borde')}
                      value={selectedSlot.style.borderColor ?? '#000000'}
                      onChange={(e) => updateSelected({ style: { ...selectedSlot.style, borderColor: e.target.value } })}
                      sx={{ width: 130 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label={t('cards_slot_border_width', 'Grosor (mm)')}
                      value={selectedSlot.style.borderWidth ?? 0}
                      onChange={(e) => updateSelected({ style: { ...selectedSlot.style, borderWidth: Number(e.target.value) || 0 } })}
                      sx={{ width: 120 }}
                      inputProps={{ min: 0, max: 5, step: 0.1 }}
                    />
                    <Tooltip title={t('cards_slot_no_border', 'Quitar el borde del slot')}>
                      <span>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => updateSelected({ style: { ...selectedSlot.style, borderWidth: 0 } })}
                          disabled={!selectedSlot.style.borderWidth}
                        >
                          {t('cards_slot_no_border', 'Sin borde')}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'cards_layer_hint',
                      'Tip: arrastra sobre el lienzo. Usa ] / [ para subir o bajar la capa del slot seleccionado.',
                    )}
                  </Typography>
                  {/*
                    Divider visual controls. The slot-level border colour
                    picker above writes to `style.borderColor` but the
                    divider renderer reads `dividerConfig`, so users without
                    this block could never recolour or shape the line.
                    Shown only when slot.type === 'DIVIDER'.

                    This block supersedes the previous three-control
                    "color / thickness / orientation" cluster. It now
                    exposes:
                      • End taper (mm)  — asymmetric thickness: positive
                        widens the right (horizontal) or bottom (vertical)
                        end; negative widens the opposite end; 0 keeps
                        the parallel legacy look.
                      • Curve depth (mm) — perpendicular quadratic Bézier
                        bulge. Positive bows one way, negative the other;
                        0 keeps a straight line.
                      • Effect — `plain` (default, byte-equal to the
                        legacy rect), `chain` (heavy inner dash), `rope`
                        (woven wiggle), `fire` (warm gradient + inner
                        highlight), `thread` (two offset strands).

                    Rotation / flip are not duplicated here because the
                    slot's existing rotation controls up top already
                    drive `slot.rotation` and that prop rotates the
                    whole DIVIDER wrapper regardless of which effect
                    is active.
                  */}
                  {selectedSlot.type === 'DIVIDER' && (
                    <Stack
                      spacing={1.25}
                      sx={{
                        p: 1,
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 1.25,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {t('cards_section_divider', 'Divisor')}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <TextField
                          size="small"
                          type="color"
                          label={t('cards_divider_color', 'Color del divisor')}
                          value={selectedSlot.dividerConfig?.color ?? '#888888'}
                          onChange={(e) => updateSelected({
                            dividerConfig: {
                              ...selectedSlot.dividerConfig,
                              color: e.target.value,
                            },
                          })}
                          sx={{ width: 140 }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label={t('cards_divider_thickness', 'Grosor (mm)')}
                          value={selectedSlot.dividerConfig?.thickness ?? 0.4}
                          onChange={(e) => updateSelected({
                            dividerConfig: {
                              ...selectedSlot.dividerConfig,
                              thickness: Number(e.target.value) || 0.4,
                            },
                          })}
                          sx={{ width: 130 }}
                          inputProps={{ min: 0, max: 5, step: 0.1 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <InputLabel>{t('cards_divider_orientation', 'Orientación')}</InputLabel>
                          <Select
                            label={t('cards_divider_orientation', 'Orientación')}
                            value={selectedSlot.dividerConfig?.orientation ?? 'horizontal'}
                            onChange={(e) => updateSelected({
                              dividerConfig: {
                                ...selectedSlot.dividerConfig,
                                orientation: e.target.value as 'horizontal' | 'vertical',
                              },
                            })}
                          >
                            <MenuItem value="horizontal">{t('cards_divider_orientation_h', 'Horizontal')}</MenuItem>
                            <MenuItem value="vertical">{t('cards_divider_orientation_v', 'Vertical')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Tooltip title={t('cards_divider_taper_hint', 'Positivo ensancha el extremo derecho (o inferior); negativo el izquierdo. 0 = línea paralela, igual que antes.')}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('cards_divider_taper', 'Extremo cónico (mm)')}
                            value={selectedSlot.dividerConfig?.endTaperMm ?? 0}
                            onChange={(e) => updateSelected({
                              dividerConfig: {
                                ...selectedSlot.dividerConfig,
                                endTaperMm: Number(e.target.value) || 0,
                              },
                            })}
                            sx={{ width: 160 }}
                            inputProps={{ min: -5, max: 5, step: 0.1 }}
                          />
                        </Tooltip>
                        <Tooltip title={t('cards_divider_curve_hint', 'Profundidad perpendicular del arco. 0 = línea recta.')}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('cards_divider_curve', 'Curvatura (mm)')}
                            value={selectedSlot.dividerConfig?.curveMm ?? 0}
                            onChange={(e) => updateSelected({
                              dividerConfig: {
                                ...selectedSlot.dividerConfig,
                                curveMm: Number(e.target.value) || 0,
                              },
                            })}
                            sx={{ width: 130 }}
                            inputProps={{ min: -10, max: 10, step: 0.5 }}
                          />
                        </Tooltip>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>{t('cards_divider_effect', 'Efecto')}</InputLabel>
                          <Select
                            label={t('cards_divider_effect', 'Efecto')}
                            value={selectedSlot.dividerConfig?.effect ?? 'plain'}
                            onChange={(e) => updateSelected({
                              dividerConfig: {
                                ...selectedSlot.dividerConfig,
                                effect: e.target.value as 'plain' | 'chain' | 'rope' | 'fire' | 'thread',
                              },
                            })}
                          >
                            <MenuItem value="plain">{t('cards_divider_effect_plain', 'Plano')}</MenuItem>
                            <MenuItem value="chain">{t('cards_divider_effect_chain', 'Cadena')}</MenuItem>
                            <MenuItem value="rope">{t('cards_divider_effect_rope', 'Cuerda')}</MenuItem>
                            <MenuItem value="fire">{t('cards_divider_effect_fire', 'Fuego')}</MenuItem>
                            <MenuItem value="thread">{t('cards_divider_effect_thread', 'Hilos')}</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                      {/* Per-slot rotation / flip for the DIVIDER. The slot
                          header only exposes label / lock / duplicate, so
                          before this strip the user had no in-block
                          affordance to spin or mirror a divider. We
                          mirror a slim version of the IMAGE rotation
                          strip here so the divider block is self-contained. */}
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Tooltip title={t('cards_slot_rotate_left', 'Rotar -15°')}>
                          <IconButton size="small" onClick={() => updateSelected({ rotation: ((selectedSlot.rotation ?? 0) - 15 + 360) % 360 })}>
                            <Rotate90DegreesCcwIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <TextField
                          size="small"
                          type="number"
                          label={t('cards_slot_rotation', 'Rotación (°)')}
                          value={rotationInputValue(selectedSlot)}
                          onChange={(e) => handleRotationChange(e, updateSelected)}
                          sx={{ width: 110 }}
                          inputProps={{ min: 0, max: 359, step: 5 }}
                        />
                        <Tooltip title={t('cards_slot_rotate_right', 'Rotar +15°')}>
                          <IconButton
                            size="small"
                            onClick={() => updateSelected({ rotation: ((selectedSlot.rotation ?? 0) + 15) % 360 })}
                            sx={{ transform: 'scaleX(-1)' }}
                          >
                            <Rotate90DegreesCcwIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('cards_slot_flip_h', 'Voltear horizontalmente')}>
                          <span>
                            <IconButton
                              size="small"
                              color={selectedSlot.flipH ? 'primary' : 'default'}
                              onClick={() => updateSelected({ flipH: !selectedSlot.flipH })}
                            >
                              <FlipIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_slot_flip_v', 'Voltear verticalmente')}>
                          <span>
                            <IconButton
                              size="small"
                              color={selectedSlot.flipV ? 'primary' : 'default'}
                              onClick={() => updateSelected({ flipV: !selectedSlot.flipV })}
                            >
                              <FlipCameraAndroidIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Box sx={{ flex: 1 }} />
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => updateSelected({ rotation: 0, flipH: false, flipV: false })}
                          disabled={(selectedSlot.rotation ?? 0) === 0 && !selectedSlot.flipH && !selectedSlot.flipV}
                        >
                          {/* Distinguish from the divider-config "Restablecer
                              divisor" button two rows below — both would
                              otherwise share the same label and mislead
                              the user about which fields the reset
                              actually clears. */}
                          {t('cards_slot_reset_rotation', 'Restablecer giro')}
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => updateSelected({
                            dividerConfig: {
                              orientation: 'horizontal',
                              thickness: 0.4,
                              color: '#888888',
                              endTaperMm: 0,
                              curveMm: 0,
                              effect: 'plain',
                            },
                          })}
                        >
                          {t('cards_divider_reset', 'Restablecer divisor')}
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                          {t('cards_divider_reset_hint', 'Restablece color, grosor, orientación, taper, curva y efecto del divisor. La rotación y el volteo se controlan en la fila superior.')}
                        </Typography>
                      </Stack>
                    </Stack>
                  )}
                  {/*
                    Per-slot typography. Same dashed-bordered Stack treatment
                    as the border / alignment blocks so the user can
                    decode it as a styled cluster of controls. Gated on
                    TEXT_SLOT_TYPES so IMAGE / DIVIDER don't show
                    controls that wouldn't take effect anyway.
                  */}
                  {TEXT_SLOT_TYPES.includes(selectedSlot.type) && (
                    <Stack
                      spacing={1}
                      sx={{
                        p: 1,
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 1.25,
                      }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {t('cards_section_typography', 'Tipografía')}
                        </Typography>
                        {/*
                          Per-slot text colour picker. The previous UX only
                          exposed two colour pickers at this level — "Color
                          borde" (which writes to `style.borderColor` and
                          had no effect on the glyphs) and the global
                          "Texto" picker — so users couldn't recolour a
                          single slot's text without repainting the whole
                          card. We read `style.color` when set, fall back
                          to the global `textColor` so the picker matches
                          what the user is actually looking at, and offer
                          a "Usar global" reset to drop back to the
                          inherited colour without losing the picker UI.
                        */}
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <TextField
                            size="small"
                            type="color"
                            label={t('cards_slot_text_color', 'Color de texto')}
                            value={selectedSlot.style.color ?? globalStyle.textColor ?? '#000000'}
                            onChange={(e) => updateSelected({
                              style: { ...selectedSlot.style, color: e.target.value },
                            })}
                            sx={{ width: 140 }}
                          />
                          <Tooltip title={t('cards_slot_text_color_global_hint', 'Usar el color de texto definido en el estilo global de la plantilla')}>
                            <span>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => updateSelected({
                                  style: { ...selectedSlot.style, color: undefined },
                                })}
                                disabled={!selectedSlot.style.color}
                              >
                                {t('cards_slot_text_color_global', 'Usar global')}
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                        <FormControl size="small" fullWidth>
                          <InputLabel>{t('cards_slot_font_family', 'Tipografía')}</InputLabel>
                        <Select
                          label={t('cards_slot_font_family', 'Tipografía')}
                          value={selectedSlot.style.fontFamily ?? ''}
                          displayEmpty
                          onChange={(e) => updateSelected((s) => ({
                            style: { ...s.style, fontFamily: (e.target.value as string) || undefined },
                          }))}
                          renderValue={(v) => {
                            const raw = String(v);
                            const match = FONT_OPTIONS.find((o) => o.value === raw);
                            return (
                              <span style={{ fontFamily: raw || 'inherit' }}>
                                {match ? match.label : t('cards_slot_font_default', 'Plantilla (default)')}
                              </span>
                            );
                          }}
                        >
                          <MenuItem value="" sx={{ fontStyle: 'italic', opacity: 0.7 }}>
                            {t('cards_slot_font_default', 'Plantilla (default)')}
                          </MenuItem>
                          {FONT_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value} sx={{ fontFamily: opt.value }}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {/*
                        Bold / Italic / Underline / Strikethrough toggles.
                        Each click handler uses the callback form of
                        `updateSelected` so the next toggle pressed
                        within the same React render cycle (e.g. user
                        mashes U then S) sees the result of the
                        previous click instead of stale pre-click state.
                      */}
                      {(() => {
                        const { underline, strike } = (() => {
                          const cur = selectedSlot.style.textDecoration;
                          if (!cur || cur === 'none') return { underline: false, strike: false };
                          return { underline: cur.includes('underline'), strike: cur.includes('line-through') };
                        })();
                        const bold = isBoldWeight(selectedSlot.style.fontWeight);
                        return (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Tooltip title={t('cards_slot_bold', 'Negrita')}>
                              <IconButton
                                size="small"
                                color={bold ? 'primary' : 'default'}
                                // On turn-off, only reset to `undefined` when the
                                // weight was set by THIS toggle (== 700). This
                                // preserves any pre-existing custom weight
                                // (e.g. 500) that pre-dated the bold action so
                                // toggling bold off doesn't silently clobber it.
                                onClick={() => updateSelected((s) => {
                                  if (!isBoldWeight(s.style.fontWeight)) {
                                    return { style: { ...s.style, fontWeight: 700 } };
                                  }
                                  if (s.style.fontWeight === 700) {
                                    return { style: { ...s.style, fontWeight: undefined } };
                                  }
                                  return {};
                                })}
                              >
                                <FormatBoldIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('cards_slot_italic', 'Cursiva')}>
                              <IconButton
                                size="small"
                                color={selectedSlot.style.fontStyle === 'italic' ? 'primary' : 'default'}
                                onClick={() => updateSelected((s) => ({
                                  style: { ...s.style, fontStyle: s.style.fontStyle === 'italic' ? 'normal' : 'italic' },
                                }))}
                              >
                                <FormatItalicIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('cards_slot_underline', 'Subrayado')}>
                              <IconButton
                                size="small"
                                color={underline ? 'primary' : 'default'}
                                onClick={() => updateSelected((s) => {
                                  const cur = s.style.textDecoration ?? 'none';
                                  const newUnder = !cur.includes('underline');
                                  const newStrike = cur.includes('line-through');
                                  return { style: { ...s.style, textDecoration: computeTextDecoration(newUnder, newStrike) } };
                                })}
                              >
                                <FormatUnderlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('cards_slot_strikethrough', 'Tachado')}>
                              <IconButton
                                size="small"
                                color={strike ? 'primary' : 'default'}
                                onClick={() => updateSelected((s) => {
                                  const cur = s.style.textDecoration ?? 'none';
                                  const newUnder = cur.includes('underline');
                                  const newStrike = !cur.includes('line-through');
                                  return { style: { ...s.style, textDecoration: computeTextDecoration(newUnder, newStrike) } };
                                })}
                              >
                                <FormatStrikethroughIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        );
                      })()}
                    </Stack>
                  )}
                  {/*
                    Text-sizing / alignment / padding only makes sense for
                    slots that actually render glyphs (TEXT_SINGLE / TEXT_MULTI
                    / KEY_VALUE_LIST / FRAME / BADGE). DIVIDER doesn't read
                    any of those style fields, so showing them here would be
                    misleading — the user could change a value expecting to
                    see a difference and see nothing. We hide the row
                    outright when slot.type === 'DIVIDER' so the props
                    panel only advertises controls that affect paint.
                  */}
                  {selectedSlot.type !== 'DIVIDER' && (
                    <Stack direction="row" spacing={1}>
                      <TextField size="small" type="number" label={t('cards_slot_font_size', 'Tamaño fuente (pt)')} value={selectedSlot.style.fontSize ?? 10} onChange={(e) => updateSelected({ style: { ...selectedSlot.style, fontSize: Number(e.target.value) || 10 } })} sx={{ width: 130 }} />
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>{t('cards_slot_align', 'Alineación')}</InputLabel>
                        <Select label={t('cards_slot_align', 'Alineación')} value={selectedSlot.style.textAlign ?? 'left'} onChange={(e) => updateSelected({ style: { ...selectedSlot.style, textAlign: e.target.value as any } })}>
                          <MenuItem value="left">Izquierda</MenuItem>
                          <MenuItem value="center">Centro</MenuItem>
                          <MenuItem value="right">Derecha</MenuItem>
                          <MenuItem value="justify">Justificado</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField size="small" type="number" label={t('cards_slot_padding', 'Padding (mm)')} value={selectedSlot.style.paddingMm ?? 0} onChange={(e) => updateSelected({ style: { ...selectedSlot.style, paddingMm: Number(e.target.value) || 0 } })} sx={{ width: 110 }} />
                    </Stack>
                  )}
                  {/*
                    CardFieldPicker exposes the entity-attribute binding
                    pipeline (campo, prefijo, sufijo, texto estático,
                    texto por defecto). The DIVIDER slot doesn't take any
                    text, so we hide the picker entirely here too —
                    otherwise the user could set the divider's "name" field,
                    wonder why nothing changes, and then complain. Only
                    rendered for slots that actually consume the binding.
                  */}
                  {selectedSlot.type !== 'DIVIDER' && (
                    <CardFieldPicker
                      binding={selectedSlot.binding}
                      kind="all"
                      slotType={selectedSlot.type}
                      onChange={(next) => updateSelected({ binding: next })}
                    />
                  )}
                  {selectedSlot.type === 'IMAGE' && (selectedSlot.binding?.fallbackText ?? '').startsWith('data:image/svg') && (
                    <Stack
                      spacing={1}
                      sx={{
                        p: 1.25,
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 1.25,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {t('cards_slot_image_transform', 'Rotación / Volteo / Color (sólo imagen)')}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title={t('cards_slot_rotate_left', 'Rotar -15°')}>
                          <IconButton size="small" onClick={() => updateSelected({ rotation: ((selectedSlot.rotation ?? 0) - 15 + 360) % 360 })}>
                            <Rotate90DegreesCcwIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <TextField
                          size="small"
                          type="number"
                          label={t('cards_slot_rotation', 'Rotación (°)')}
                          value={rotationInputValue(selectedSlot)}
                          onChange={(e) => handleRotationChange(e, updateSelected)}
                          sx={{ width: 110 }}
                          inputProps={{ min: 0, max: 359, step: 5 }}
                        />
                        <Tooltip title={t('cards_slot_rotate_right', 'Rotar +15°')}>
                          <IconButton
                            size="small"
                            onClick={() => updateSelected({ rotation: ((selectedSlot.rotation ?? 0) + 15) % 360 })}
                            sx={{ transform: 'scaleX(-1)' }}
                          >
                            <Rotate90DegreesCcwIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title={t('cards_slot_flip_h', 'Voltear horizontalmente')}>
                          <span>
                            <IconButton
                              size="small"
                              color={selectedSlot.flipH ? 'primary' : 'default'}
                              onClick={() => updateSelected({ flipH: !selectedSlot.flipH })}
                            >
                              <FlipIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('cards_slot_flip_v', 'Voltear verticalmente')}>
                          <span>
                            <IconButton
                              size="small"
                              color={selectedSlot.flipV ? 'primary' : 'default'}
                              onClick={() => updateSelected({ flipV: !selectedSlot.flipV })}
                            >
                              <FlipCameraAndroidIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Box sx={{ flex: 1 }} />
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => updateSelected({ rotation: 0, flipH: false, flipV: false })}
                          disabled={(selectedSlot.rotation ?? 0) === 0 && !selectedSlot.flipH && !selectedSlot.flipV}
                        >
                          {t('cards_slot_reset_transform', 'Restablecer')}
                        </Button>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          type="color"
                          label={t('cards_slot_color', 'Color del gráfico')}
                          value={selectedSlot.style.color ?? DEFAULT_BAKED_COLOR}
                          onChange={(e) => {
                            const nextColor = e.target.value;
                            // Update style.color and recolor the baked data
                            // URI in lockstep so the preview reflects the
                            // new colour on the very next paint.
                            const fallback = selectedSlot.binding?.fallbackText ?? '';
                            const nexFallback = fallback.startsWith('data:image/svg')
                              ? recolorDataUri(fallback, DEFAULT_BAKED_COLOR, nextColor)
                              : fallback;
                            updateSelected({
                              style: { ...selectedSlot.style, color: nextColor },
                              binding: { ...selectedSlot.binding, fallbackText: nexFallback },
                            });
                          }}
                          sx={{ width: 140 }}
                        />
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            const fallback = selectedSlot.binding?.fallbackText ?? '';
                            if (!fallback.startsWith('data:image/svg')) return;
                            const currentColor = (selectedSlot.style.color ?? DEFAULT_BAKED_COLOR).toLowerCase();
                            // Only emit the recolor call when the user has actually
                            // changed the colour — otherwise the data URI is already
                            // the default and the call would be a no-op.
                            if (currentColor === DEFAULT_BAKED_COLOR.toLowerCase()) return;
                            updateSelected({
                              style: { ...selectedSlot.style, color: DEFAULT_BAKED_COLOR },
                              binding: { ...selectedSlot.binding, fallbackText: recolorDataUri(fallback, currentColor, DEFAULT_BAKED_COLOR) },
                            });
                          }}
                          disabled={(selectedSlot.style.color ?? DEFAULT_BAKED_COLOR).toLowerCase() === DEFAULT_BAKED_COLOR.toLowerCase() || !(selectedSlot.binding?.fallbackText ?? '').startsWith('data:image/svg')}
                        >
                          {t('cards_slot_color_reset', 'Restablecer color')}
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t('cards_slot_image_transform_hint', 'Sólo afecta a slots de imagen. La rotación y volteo se aplican al contenido visual; el recuadro del slot sigue alineado al eje.')}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>

          {/* Column 3 – Live preview, the dominant area */}
          <Box
            sx={{
              overflowY: 'auto',
              p: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0, // allow children to shrink inside grid track
            }}
          >
            {/*
              Live-preview sample picker. Sits at the top of the column
              so the user immediately sees what entity is driving the
              canvas below; the kind + entity controls fetch REAL
              records from the manuals API ({@link CardSamplePicker}
              already hits /manuals/{manualId}/{kind}) so picking
              "Bola de fuego" or "Visión en la oscuridad" renders
              the template against authentic data the user can compare
              against other slots. Placement here keeps it inside the
              scroll container (overflowY: auto above) so a tall
              dialog still scrolls as one unit rather than splitting
              the picker and the canvas across separate scroll
              regions. The Divider below visually separates the picker
              from the existing "Previsualización en vivo" header
              so the two clusters (sample selection vs. canvas
              controls) read as distinct logical regions at a glance.
            */}
            <Box
              sx={{
                p: 1,
                mb: 1,
                // flexShrink: 0 keeps the picker at its natural height so
                // when Column 3 has to absorb shrinking (small viewport,
                // zoom out from the editor) it shrinks the canvas Paper
                // below instead of compressing the picker UI.
                flexShrink: 0,
                borderRadius: 1.25,
                border: '1px dashed',
                borderColor: 'divider',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : 'background.default',
              }}
            >
              <CardSamplePicker
                value={previewSampleEntity}
                onChange={setPreviewSampleEntity}
              />
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('cards_live_preview', 'Previsualización en vivo')}
              </Typography>
              <Chip
                size="small"
                label={`${widthMm}×${heightMm} mm`}
                variant="outlined"
                sx={{ ml: 1 }}
              />
              {selectedSlot?.locked && (
                <Chip
                  size="small"
                  color="default"
                  icon={<LockIcon fontSize="small" />}
                  label={t('cards_slot_lock_badge', 'Bloqueada')}
                />
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mb: 0.5, ml: 1 }}
            >
              {/*
                Pan arrows. The inner Preview Paper's horizontal scrollbar
                sits at the bottom of the column and drops below the fold
                whenever the user is inspecting the top of a zoomed card;
                these buttons call `scrollBy(dx, dy)` through the
                CardPreview handle so the user never has to scroll
                vertically to reach the lateral scroll first. We share
                a single `PAN_STEP_PX` constant so left/right and up/down
                steps stay in lockstep with the Paper's pixel size.
              */}
              <Tooltip title={t('cards_preview_pan_left', 'Desplazar previsualización a la izquierda')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => cardPreviewRef.current?.scrollBy(-PAN_STEP_PX, 0)}
                    disabled={!cardPreviewScrollBounds.left}
                    aria-label={t('cards_preview_pan_left', 'Desplazar previsualización a la izquierda')}
                  >
                    <KeyboardArrowLeftIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('cards_preview_pan_right', 'Desplazar previsualización a la derecha')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => cardPreviewRef.current?.scrollBy(PAN_STEP_PX, 0)}
                    disabled={!cardPreviewScrollBounds.right}
                    aria-label={t('cards_preview_pan_right', 'Desplazar previsualización a la derecha')}
                  >
                    <KeyboardArrowRightIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('cards_preview_pan_up', 'Desplazar previsualización arriba')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => cardPreviewRef.current?.scrollBy(0, -PAN_STEP_PX)}
                    disabled={!cardPreviewScrollBounds.up}
                    aria-label={t('cards_preview_pan_up', 'Desplazar previsualización arriba')}
                  >
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('cards_preview_pan_down', 'Desplazar previsualización abajo')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => cardPreviewRef.current?.scrollBy(0, PAN_STEP_PX)}
                    disabled={!cardPreviewScrollBounds.down}
                    aria-label={t('cards_preview_pan_down', 'Desplazar previsualización abajo')}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
              <Tooltip title={t('cards_zoom_out', 'Reducir zoom')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={zoomOut}
                    disabled={zoom <= ZOOM_LEVELS[0] + 0.001}
                  >
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Chip
                size="small"
                label={`${Math.round(zoom * 100)}%`}
                onClick={zoomReset}
                sx={{ cursor: 'pointer', fontWeight: 600, minWidth: 56 }}
                title={t('cards_zoom_reset', 'Restablecer zoom')}
              />
              <Tooltip title={t('cards_zoom_in', 'Aumentar zoom')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={zoomIn}
                    disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1] - 0.001}
                  >
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('cards_zoom_fit', 'Ajustar a la ventana')}>
                <IconButton size="small" onClick={zoomReset}>
                  <CenterFocusStrongIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {t('cards_zoom_hint', 'Ctrl/Cmd + rueda para hacer zoom in / out.')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {t('cards_align_snap_hint', 'Mantén CTRL al arrastrar para alinear con otros slots.')}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={showLabels}
                    onChange={(_, checked) => setShowLabels(checked)}
                  />
                }
                label={t('cards_show_labels', 'Mostrar etiquetas')}
              />
            </Stack>
            <Paper
              elevation={3}
              sx={{
                flex: 1,
                minHeight: 340,
                borderRadius: 2,
                display: 'flex',
                // `safe center` falls back to flex-start when the card
                // overflows — required so the user can scroll UP to see the
                // top of an enlarged card (just `center` clipped the scroll
                // origin to the bottom).
                alignItems: 'safe center',
                justifyContent: 'safe center',
                p: 3,
                // Allow wheel-scrolling inside the paper when the card is
                // enlarged beyond the viewport.
                overflow: 'auto',
                // Checkerboard wash so the user sees when a slot's transparent
                // background is intentional vs. missing.
                backgroundImage:
                  'linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.04) 75%), linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.04) 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
              }}
              onWheel={onPreviewWheel}
            >
              <Box sx={{ display: 'flex', justifyContent: 'safe center', alignItems: 'safe center', width: '100%', minHeight: '100%' }}>
                <CardPreview
                  ref={cardPreviewRef}
                  template={previewTemplate}
                  // Prefer the user's pick from <CardSamplePicker>
                  // (real backend data) over the synthetic fallback
                  // derived from slot bindings — see previewSampleEntity
                  // above. The fallback only paints when the picker is
                  // empty or right after the dialog mounts.
                  sampleEntity={previewSampleEntity ?? fallbackEntity}
                  interactive
                  zoom={zoom}
                  showLabels={showLabels}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={setSelectedSlotId}
                  onScrollBoundsChange={setCardPreviewScrollBounds}
                  onSlotsChange={(next) => {
                    setSlots(next);
                    // If the deleted slot was the selected one, fall back to
                    // BASE_SLOT_ID so the props panel still has a landing
                    // place (the base card fields) instead of collapsing
                    // to an empty state.
                    if (selectedSlotId && selectedSlotId !== BASE_SLOT_ID && !next.find((s) => s.id === selectedSlotId)) {
                      setSelectedSlotId(BASE_SLOT_ID);
                    }
                  }}
                />
              </Box>
            </Paper>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || name.trim().length === 0}
        >
          {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
        </Button>
      </DialogActions>

      <GraphicElementsPicker
        open={graphicPickerOpen}
        onClose={() => setGraphicPickerOpen(false)}
        onPick={addGraphicElement}
      />
    </Dialog>
  );
}
