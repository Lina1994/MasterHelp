import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Skyline overlay settings DTO.
 * Controls what UI elements are shown in the Skyline projection window.
 */
export class SkylineOverlaySettingsDto {
  /**
   * When true, show the currently playing song title at the top-left corner.
   */
  @IsBoolean()
  @IsOptional()
  showSongTitle?: boolean;

  /**
   * When true, show the initiative strip (up to 10 participants) at bottom-left.
   */
  @IsBoolean()
  @IsOptional()
  showInitiativeStrip?: boolean;
}
