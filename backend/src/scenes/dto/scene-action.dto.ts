import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SCENE_ACTION_TYPES,
  SCENE_WINDOW_TARGET_KINDS,
  type SceneActionType,
  type SceneWindowTargetKind,
} from '../actionTypes';

class SceneWindowTargetDto {
  @IsIn(SCENE_WINDOW_TARGET_KINDS as unknown as SceneWindowTargetKind[])
  kind: SceneWindowTargetKind;

  @IsOptional()
  @IsString()
  windowId?: string;

  @IsOptional()
  @IsString()
  windowType?: string;
}

/**
 * DTO describing one action within a scene.
 */
export class SceneActionDto {
  @IsString()
  @MaxLength(80)
  id: string;

  @IsIn(SCENE_ACTION_TYPES as unknown as SceneActionType[])
  type: SceneActionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600000)
  delay?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SceneWindowTargetDto)
  targetWindow?: SceneWindowTargetDto;

  @IsObject()
  payload: Record<string, unknown>;
}