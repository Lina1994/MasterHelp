import { IsInt, Max, Min } from 'class-validator';

/**
 * Fog of War settings DTO.
 *
 * Persisted per-campaign to keep Fog of War rendering consistent across
 * Electron (app) and browser (web) clients.
 */
export class FogOfWarSettingsDto {
  /**
   * Ally clear radius (in grid cells) used to auto-clear fog around allied tokens.
   *
   * - 0 disables auto-clear
   * - 1 clears the token cell only
   */
  @IsInt()
  @Min(0)
  @Max(10)
  allyClearRadius: number;
}
