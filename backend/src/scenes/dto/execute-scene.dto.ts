import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { type SceneTriggerSource } from '../actionTypes';

/**
 * DTO describing execution metadata for a scene run request.
 */
export class ExecuteSceneDto {
  @IsOptional()
  @IsIn(['manual', 'shortcut', 'scene'] satisfies SceneTriggerSource[])
  triggerSource?: SceneTriggerSource;

  @IsOptional()
  @IsString()
  triggerShortcutId?: string | null;

  @IsOptional()
  @IsUUID('4')
  parentExecutionId?: string | null;
}