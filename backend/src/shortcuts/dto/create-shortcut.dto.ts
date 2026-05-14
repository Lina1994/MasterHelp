import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SHORTCUT_SCHEMA_VERSION } from '../actionTypes';
import { ShortcutActionDto } from './shortcut-action.dto';

/**
 * DTO for creating a shortcut definition.
 */
export class CreateShortcutDto {
  @IsOptional()
  @IsIn(['global', 'campaign'])
  scope?: 'global' | 'campaign';

  @IsOptional()
  @IsUUID('4')
  campaignId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  hotkey?: string | null;

  @IsOptional()
  @IsIn(['button', 'toggle', 'temporary'])
  mode?: 'button' | 'toggle' | 'temporary';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(120000)
  temporaryDurationMs?: number | null;

  @IsOptional()
  @IsHexColor()
  activeColor?: string | null;

  @IsOptional()
  @IsHexColor()
  inactiveColor?: string | null;

  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @IsOptional()
  @IsBoolean()
  showInSidebarPanel?: boolean;

  @IsOptional()
  @IsBoolean()
  showInHotbar?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sidebarPanelOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hotbarOrder?: number;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ShortcutActionDto)
  actions: ShortcutActionDto[];

  static readonly CURRENT_SCHEMA_VERSION = SHORTCUT_SCHEMA_VERSION;
}