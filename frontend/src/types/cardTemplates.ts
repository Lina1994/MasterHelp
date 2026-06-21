/**
 * Types describing card templates and their slots. Mirrors the backend
 * entity but is intentionally richer so the editor can rely on discriminated
 * unions of slot types.
 */

export type CardSizePreset = 'POKER' | 'MINI' | 'BRIDGE' | 'TAROT' | 'LETTER' | 'CUSTOM';
export type CardOrientation = 'portrait' | 'landscape';
export type SlotType = 'TEXT_SINGLE' | 'TEXT_MULTI' | 'IMAGE' | 'KEY_VALUE_LIST' | 'DIVIDER' | 'FRAME' | 'BADGE';

/** Visual style of the whole card (background, fonts). */
export interface CardTemplateGlobalStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidthMm?: number;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
  backgroundImageUrl?: string | null;
}

/** Slot position in absolute mm from the top-left corner. */
export interface CardSlotPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Visual style for a single slot. Maps directly to CSS where applicable. */
export interface CardSlotStyle {
  fontSize?: number;
  fontWeight?: string | number;
  // CSS `font-family` stack. Per-slot so two text fields on the same card
  // can use completely different typefaces (e.g. a name in serif, the
  // description in sans-serif). Falls back to the template's global
  // `fontFamily` when omitted.
  fontFamily?: string;
  // CSS `font-style`. The editor's "Italic" toggle flips between
  // 'normal' and 'italic'.
  fontStyle?: 'normal' | 'italic';
  // CSS `text-decoration` shorthand. The editor exposes two toggles
  // (Underline, Strikethrough) that map onto the four supported
  // combinations: 'none', 'underline', 'line-through', or
  // 'underline line-through' (both at once).
  textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  objectFit?: 'cover' | 'contain';
  paddingMm?: number;
}

/**
 * How a slot retrieves its value from the entity being rendered. The path
 * is dot-notation (lodash-style) and evaluated at render time. If the path
 * resolves to undefined the `fallbackText` is used instead.
 */
export interface CardSlotBinding {
  fieldPath?: string;
  fallbackText?: string;
  isStatic?: boolean;
  formatString?: string;
  prefix?: string;
  suffix?: string;
}

/** Extra options for KEY_VALUE_LIST slots. */
export interface CardSlotKeyValueConfig {
  showLabel?: boolean;
  labelFieldPath?: string;
  valueFieldPath?: string;
  /** Treat the bound path as an array of [label,value] tuples. */
  isTupleArray?: boolean;
}

/**
 * Visual treatments available for the DIVIDER slot. `plain` keeps the
 * historical single-rectangle look (rendered identically to the previous
 * implementation). The other four are SVG-only and compose with
 * `endTaperMm` and `curveMm` so the user can produce brushed metal, ropes
 * of any gauge, fire-like gradients, or double-thread weaves by mixing
 * flags rather than learning a new pipeline for each.
 */
export type CardSlotDividerEffect =
  | 'plain'
  | 'chain'
  | 'rope'
  | 'fire'
  | 'thread';

/** Extra options for DIVIDER slots. */
export interface CardSlotDividerConfig {
  thickness?: number;
  orientation?: 'horizontal' | 'vertical';
  /**
   * Optional colour override for the divider line. Falls back to
   * `style.color` (so dividers that already styled their colour through
   * the editor's legacy colour field keep working) and finally to a
   * neutral grey as a last resort. Keeping it in `dividerConfig` rather
   * than `style.color` means future text-style changes won't accidentally
   * recolour the divider line.
   */
  color?: string;
  /**
   * Asymmetric taper in millimetres. Positive values thicken the
   * second end (right for horizontal, bottom for vertical); negative
   * values thicken the first end (left / top). `0` (default) keeps the
   * dividier perfectly parallel — the legacy look. Composites with
   * `curveMm` and `effect`.
   */
  endTaperMm?: number;
  /**
   * Perpendicular curve depth, in millimetres, applied as a quadratic
   * Bézier arc. `0` keeps the divider on a straight line. The sign picks
   * which side of the slot the bulge draws to: positive bulges down/right
   * of the centre line. Composites with `endTaperMm` and `effect`.
   */
  curveMm?: number;
  /**
   * Visual treatment. Defaults to `'plain'` to preserve bit-for-bit the
   * previous render when the editor hasn't been touched. Setting this to
   * anything else swaps the renderer to an SVG path / polygon so the new
   * styling can apply. Composites with `endTaperMm` and `curveMm`.
   */
  effect?: CardSlotDividerEffect;
}

/** A single slot inside a card template. */
export interface CardSlot {
  id: string;
  name: string;
  type: SlotType;
  position: CardSlotPosition;
  style: CardSlotStyle;
  binding: CardSlotBinding;
  /**
   * Editor-only flag: when true the slot's geometry is frozen — drag /
   * resize handles disappear in the live preview so the user can
   * confidently work on the rest of the card without nudging it. The
   * renderer still draws it normally. Optional for backwards compatibility.
   */
  locked?: boolean;
  /**
   * Rotation in degrees applied to the slot's *visual content* (the slot
   * container itself stays axis-aligned so drag/resize maths keep working
   * with the simple mm-based bounding box). Range 0–360.
   */
  rotation?: number;
  /** Mirror the slot's content horizontally around its centre. */
  flipH?: boolean;
  /** Mirror the slot's content vertically around its centre. */
  flipV?: boolean;
  keyValueConfig?: CardSlotKeyValueConfig;
  dividerConfig?: CardSlotDividerConfig;
}

/** Persisted template. */
export interface CardTemplate {
  id: string;
  name: string;
  description: string | null;
  widthMm: number;
  heightMm: number;
  orientation: CardOrientation;
  sizePreset: CardSizePreset;
  globalStyle: CardTemplateGlobalStyle;
  slots: CardSlot[];
  createdAt: string;
  updatedAt: string;
}

/** DTO used when creating or patching a template from the editor. */
export interface CardTemplateInput {
  name: string;
  description?: string | null;
  widthMm?: number;
  heightMm?: number;
  orientation?: CardOrientation;
  sizePreset?: CardSizePreset;
  globalStyle?: CardTemplateGlobalStyle;
  slots: CardSlot[];
}

/** Categories of source data the generator can pull from. */
export type CardEntityKind =
  | 'spell'
  | 'trait'
  | 'feat'
  | 'monster'
  | 'character'
  | 'shop-item';

/** Minimal payload the renderer needs per entity (normalised by the picker). */
export interface CardEntityPayload {
  kind: CardEntityKind;
  /** Source identifier (used in the filename/PDF metadata). */
  sourceId: string;
  /** Flat object accessible via binding field paths. */
  data: Record<string, unknown>;
}
