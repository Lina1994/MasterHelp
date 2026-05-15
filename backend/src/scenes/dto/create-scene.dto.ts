import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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

  @IsArray()
  @ArrayMaxSize(SCENE_MAX_ACTIONS)
  @ValidateNested({ each: true })
  @Type(() => SceneActionDto)
  actions: SceneActionDto[];

  static readonly CURRENT_SCHEMA_VERSION = SCENE_SCHEMA_VERSION;
}