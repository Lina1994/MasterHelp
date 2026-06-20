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

/** Extra options for DIVIDER slots. */
export interface CardSlotDividerConfig {
  thickness?: number;
  orientation?: 'horizontal' | 'vertical';
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
