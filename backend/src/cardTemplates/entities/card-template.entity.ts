import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Card size preset used when creating a new template. The actual physical
 * dimensions are stored in mm via {@link widthMm} / {@link heightMm}, so the
 * preset is just a hint for the UI and for our size dropdowns.
 */
export type CardSizePreset = 'POKER' | 'MINI' | 'BRIDGE' | 'TAROT' | 'LETTER' | 'CUSTOM';

/** Orientation of the card. */
export type CardOrientation = 'portrait' | 'landscape';

/** Visual style of the card template (colors, fonts, frame). */
export interface CardTemplateGlobalStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidthMm?: number;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
  /** Optional background image (data URI or absolute URL). */
  backgroundImageUrl?: string;
}

/**
 * Position/size of a slot, in absolute millimeters from the top-left corner
 * of the card. Keeping the units in mm guarantees that the on-screen preview
 * and the printed PDF match exactly.
 */
export interface CardSlotPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Visual style of a single slot. Field names map directly to CSS so the
 * preview is WYSIWYG.
 */
export interface CardSlotStyle {
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  /** For IMAGE slots. */
  objectFit?: 'cover' | 'contain';
  /** Padding inside the slot, mm. */
  paddingMm?: number;
}

/**
 * Describes how a slot value is fetched from the entity being rendered.
 *
 * - `fieldPath`: dot-notation path (lodash-style) evaluated against the
 *   entity object, e.g. "name", "stats.strength", "description".
 * - `fallbackText`: text shown when the path resolves to null/undefined.
 * - `isStatic`: when true the slot renders `fallbackText` literally,
 *   useful for labels like "REQUISITOS:" / "PREREQUISITE:".
 * - `formatString`: optional sprintf-like template that contains
 *   one `{value}` placeholder.
 * - `prefix`/`suffix`: extra string to concatenate around the value
 *   (kept separate so we have an obvious migration from formatString).
 */
export interface CardSlotBinding {
  fieldPath?: string;
  fallbackText?: string;
  isStatic?: boolean;
  formatString?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Single slot in the card. A slot is positioned absolutely inside the card
 * and renders one piece of content bound to a path on the entity.
 *
 * `id` is generated client-side and only used for stable React keys.
 */
export interface CardSlot {
  id: string;
  /** Human-readable label shown in the editor list. */
  name: string;
  /** Slot kind. */
  type: 'TEXT_SINGLE' | 'TEXT_MULTI' | 'IMAGE' | 'KEY_VALUE_LIST' | 'DIVIDER' | 'FRAME' | 'BADGE';
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
  /** Rotation in degrees applied to the slot's visual content (0–360). */
  rotation?: number;
  /** Mirror the slot's content horizontally around its centre. */
  flipH?: boolean;
  /** Mirror the slot's content vertically around its centre. */
  flipV?: boolean;
  /** For KEY_VALUE_LIST: how to render each pair. */
  keyValueConfig?: {
    /** When true shows the key (label) above/before the value. */
    showLabel?: boolean;
    labelFieldPath?: string;
    valueFieldPath?: string;
    /** When true, treats the binding field as an array of [label,value] tuples. */
    isTupleArray?: boolean;
  };
  /** For DIVIDER: extra styling applied to the line. */
  dividerConfig?: {
    thickness?: number;
    /** 'horizontal' or 'vertical' relative to the slot bounds. */
    orientation?: 'horizontal' | 'vertical';
  };
}

/**
 * Persistent card template owned by a single user.
 *
 * The full layout (slots, styles, bindings, sizes) is stored as JSON in the
 * {@link layout} column. This keeps schema migrations minimal while we iterate
 * on the editor and the slot pipeline.
 */
@Entity()
export class CardTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  /** Physical dimensions in mm. */
  @Column({ type: 'float', default: 63 })
  widthMm: number;

  @Column({ type: 'float', default: 88 })
  heightMm: number;

  @Column({ type: 'text', default: 'portrait' })
  orientation: CardOrientation;

  @Column({ type: 'text', default: 'POKER' })
  sizePreset: CardSizePreset;

  @Column({ type: 'simple-json', default: '{}' })
  globalStyle: CardTemplateGlobalStyle;

  /**
   * JSON-serialised array of {@link CardSlot}. Using simple-json avoids
   * a separate "slots" table while still letting the editor manage
   * arbitrary reorderings.
   */
  @Column({ type: 'simple-json', default: '[]' })
  slots: CardSlot[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner: User;
}
