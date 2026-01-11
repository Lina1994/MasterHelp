import { IsArray, IsString, IsUUID, ArrayMaxSize, ArrayUnique } from 'class-validator';

/**
 * UpdateFogDto
 * Payload for setting Fog of War cells for a given campaign+map.
 */
export class UpdateFogDto {
  /** Campaign scope for this fog state. */
  @IsString()
  @IsUUID()
  campaignId: string;

  /** Cells to persist (string keys). */
  @IsArray()
  @ArrayMaxSize(200000)
  @ArrayUnique()
  @IsString({ each: true })
  cells: string[];
}
