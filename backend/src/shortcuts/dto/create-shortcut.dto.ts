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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShortcutActionDto } from './shortcut-action.dto';

/**
 * DTO for creating a shortcut definition.
 */
export class CreateShortcutDto {
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
}