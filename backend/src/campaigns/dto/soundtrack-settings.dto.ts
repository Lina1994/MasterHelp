import { IsIn } from 'class-validator';

export type SoundtrackMode = 'automatic' | 'manual';

/**
 * Soundtrack settings DTO.
 *
 * Controls whether soundtrack is applied automatically (by map/encounter/combat)
 * or only manually by the DM.
 */
export class SoundtrackSettingsDto {
  /**
   * When `manual`, automatic music/SFX changes are disabled.
   * When `automatic`, the app may auto-apply configured music/SFX.
   */
  @IsIn(['automatic', 'manual'])
  mode: SoundtrackMode;
}
