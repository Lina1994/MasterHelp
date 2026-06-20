import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  type CardOrientation,
  type CardSizePreset,
  type CardSlot,
  type CardSlotBinding,
  type CardSlotPosition,
  type CardSlotStyle,
  type CardTemplateGlobalStyle,
} from '../entities/card-template.entity';

/**
 * Position in mm (validated for sane bounds: 0..300mm).
 */
export class CardSlotPositionDto implements CardSlotPosition {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  x: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  y: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  w: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  h: number;
}

/**
 * Inline object kept as plain JSON for editor flexibility. We only validate
 * a small set of common fields so authors can experiment without breaking the
 * pipeline.
 */
export class CardSlotStyleDto implements CardSlotStyle {
  @IsOptional()
  @IsNumber()
  fontSize?: number;

  @IsOptional()
  fontWeight?: string | number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsIn(['left', 'center', 'right', 'justify'])
  textAlign?: 'left' | 'center' | 'right' | 'justify';

  @IsOptional()
  @IsString()
  borderColor?: string;

  @IsOptional()
  @IsNumber()
  borderWidth?: number;

  @IsOptional()
  @IsNumber()
  borderRadius?: number;

  @IsOptional()
  @IsIn(['cover', 'contain'])
  objectFit?: 'cover' | 'contain';

  @IsOptional()
  @IsNumber()
  paddingMm?: number;
}

export class CardSlotBindingDto implements CardSlotBinding {
  @IsOptional()
  @IsString()
  fieldPath?: string;

  @IsOptional()
  @IsString()
  fallbackText?: string;

  @IsOptional()
  @IsBoolean()
  isStatic?: boolean;

  @IsOptional()
  @IsString()
  formatString?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsString()
  suffix?: string;
}

export class CardSlotDto implements CardSlot {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsIn(['TEXT_SINGLE', 'TEXT_MULTI', 'IMAGE', 'KEY_VALUE_LIST', 'DIVIDER', 'FRAME', 'BADGE'])
  type: 'TEXT_SINGLE' | 'TEXT_MULTI' | 'IMAGE' | 'KEY_VALUE_LIST' | 'DIVIDER' | 'FRAME' | 'BADGE';

  @ValidateNested()
  @Type(() => CardSlotPositionDto)
  position: CardSlotPositionDto;

  @ValidateNested()
  @Type(() => CardSlotStyleDto)
  style: CardSlotStyleDto;

  @ValidateNested()
  @Type(() => CardSlotBindingDto)
  binding: CardSlotBindingDto;

  /**
   * When true, the editor exposes no drag/resize handles for this slot and
   * it stays put while the author works on the rest of the card. Default
   * is `false` so existing templates keep working unchanged.
   */
  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  /** Rotation in degrees applied to the slot's visual content (0–360). */
  @IsOptional()
  @IsNumber()
  @Min(-720)
  @Max(720)
  rotation?: number;

  @IsOptional()
  @IsBoolean()
  flipH?: boolean;

  @IsOptional()
  @IsBoolean()
  flipV?: boolean;

  /** Optional configs per slot type — not strictly validated for forward-compat. */
  @IsOptional()
  keyValueConfig?: CardSlot['keyValueConfig'];

  @IsOptional()
  dividerConfig?: CardSlot['dividerConfig'];
}

/**
 * DTO for creating a card template owned by the authenticated user.
 */
export class CreateCardTemplateDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(300)
  widthMm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(300)
  heightMm?: number;

  @IsOptional()
  @IsIn(['portrait', 'landscape'])
  orientation?: CardOrientation;

  @IsOptional()
  @IsIn(['POKER', 'MINI', 'BRIDGE', 'TAROT', 'LETTER', 'CUSTOM'])
  sizePreset?: CardSizePreset;

  @IsOptional()
  globalStyle?: CardTemplateGlobalStyle;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CardSlotDto)
  slots: CardSlotDto[];
}
