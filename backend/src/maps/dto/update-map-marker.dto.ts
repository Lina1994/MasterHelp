import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * UpdateMapMarkerDto
 *
 * All fields are optional — only provided fields are updated (PATCH semantics).
 */
export class UpdateMapMarkerDto {
  /** Updated display label. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** Updated emoji/icon. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  /** Updated DM notes. Pass `null` to clear. */
  @IsOptional()
  @IsString()
  notes?: string | null;

  /** Updated horizontal position (%), if repositioned. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  x?: number;

  /** Updated vertical position (%), if repositioned. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  y?: number;

  /**
   * Replaces the full associated-entities block.
   * Pass an empty object `{}` to clear all associations.
   */
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
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
    diaryEntryIds?: string[];
    worldpediaIds?: string[];
  };
}
