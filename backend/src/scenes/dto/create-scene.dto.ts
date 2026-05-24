import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SCENE_MAX_ACTIONS, SCENE_SCHEMA_VERSION } from '../actionTypes';
import { SceneActionDto } from './scene-action.dto';

/**
 * DTO for creating a scene definition.
 */
export class CreateSceneDto {
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
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  loop?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loopDelayMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loopDelayRandomMinMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loopDelayRandomMaxMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loopWindowStartMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loopWindowEndMs?: number | null;

  @IsOptional()
  @IsBoolean()
  takeOverMusicOnStart?: boolean;

  @IsOptional()
  @IsBoolean()
  restorePreviousMusicOnFinish?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string | null;

  @IsArray()
  @ArrayMaxSize(SCENE_MAX_ACTIONS)
  @ValidateNested({ each: true })
  @Type(() => SceneActionDto)
  actions: SceneActionDto[];

  static readonly CURRENT_SCHEMA_VERSION = SCENE_SCHEMA_VERSION;
}