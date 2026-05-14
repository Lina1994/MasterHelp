import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { SHORTCUT_ACTION_KINDS, SHORTCUT_WINDOW_TARGET_KINDS, type ShortcutActionKind, type ShortcutWindowTargetKind } from '../actionTypes';

class ShortcutWindowTargetDto {
  @IsIn(SHORTCUT_WINDOW_TARGET_KINDS as unknown as ShortcutWindowTargetKind[])
  kind: ShortcutWindowTargetKind;

  @IsOptional()
  @IsString()
  windowId?: string;

  @IsOptional()
  @IsString()
  windowType?: string;
}

/**
 * DTO describing one action within a shortcut macro.
 */
export class ShortcutActionDto {
  @IsIn(SHORTCUT_ACTION_KINDS as unknown as ShortcutActionKind[])
  kind: ShortcutActionKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600000)
  delayMs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShortcutWindowTargetDto)
  targetWindow?: ShortcutWindowTargetDto;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  // Backward compatibility for current frontend payload format.
  @IsOptional()
  @IsObject()
  config: Record<string, unknown>;
}