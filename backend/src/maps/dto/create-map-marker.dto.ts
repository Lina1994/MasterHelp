import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * CreateMapMarkerDto
 *
 * Payload for placing a new marker on a world map.
 * `x` and `y` are expressed as percentages (0–100) relative to the image dimensions.
 */
export class CreateMapMarkerDto {
  /** Display label for the pin. */
  @IsString()
  @MaxLength(200)
  name: string;

  /** Emoji or short code rendered on the pin (default applied by service). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  /** DM-only long-form notes for this location. */
  @IsOptional()
  @IsString()
  notes?: string;

  /** Horizontal position, percentage of image width (0–100). */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  /** Vertical position, percentage of image height (0–100). */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  /** Campaign this marker is scoped to. */
  @IsUUID()
  campaignId: string;

  /**
   * Optional set of associated entity IDs.
   * The client passes the raw object; the service persists it verbatim.
   */
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return undefined; }
    }
    return value;
  })
  associated?: {
    mapIds?: string[];
    characterIds?: string[];
    enemyIds?: string[];
    encounterIds?: string[];
    diarySessionIds?: string[];
    worldpediaIds?: string[];
  };
}
