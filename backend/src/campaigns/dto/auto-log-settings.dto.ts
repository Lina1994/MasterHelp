import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Automatic adventure-log settings DTO.
 *
 * Controls whether the backend automatically appends diary entries (to a
 * "Registro de aventuras" item on the current campaign day) when certain
 * in-game events occur and a diary session is active.
 */
export class AutoLogSettingsDto {
  /** Master switch: when false, nothing is auto-logged. */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  /** Log visited places (active map changes). */
  @IsBoolean()
  @IsOptional()
  logPlaces?: boolean;

  /** Log encountered NPCs (non-player character projected to the skyline). */
  @IsBoolean()
  @IsOptional()
  logCharacters?: boolean;

  /** Log quest acceptance/completion. */
  @IsBoolean()
  @IsOptional()
  logQuests?: boolean;

  /** Log combat start/end. */
  @IsBoolean()
  @IsOptional()
  logCombat?: boolean;
}
