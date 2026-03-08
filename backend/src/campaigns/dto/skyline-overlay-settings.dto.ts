import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

  /**
   * When true, display the QR code in the Skyline projection overlay.
   */
  @IsBoolean()
  @IsOptional()
  showQr?: boolean;

  /**
   * The URL encoded in the QR code shown on the Skyline overlay.
   * Should be a LAN-accessible http:// URL.
   */
  @IsString()
  @MaxLength(512)
  @IsOptional()
  qrUrl?: string;
}
