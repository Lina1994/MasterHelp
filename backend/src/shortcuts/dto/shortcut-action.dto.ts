import { IsIn, IsObject } from 'class-validator';

/**
 * DTO describing one action within a shortcut macro.
 */
export class ShortcutActionDto {
  @IsIn(['toggleState', 'playSoundEffect'])
  kind: 'toggleState' | 'playSoundEffect';

  @IsObject()
  config: Record<string, unknown>;
}