import { IsArray, IsString, IsUUID, ArrayMaxSize, ValidateNested, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * A single point in normalised coordinates (0–1).
 */
class StrokePointDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;
}

/**
 * Represents one organic fog brush stroke.
 */
class OrganicFogStrokeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrokePointDto)
  @ArrayMaxSize(50000)
  points: StrokePointDto[];

  @IsNumber()
  @Min(1)
  @Max(500)
  radius: number;

  @IsString()
  @IsIn(['reveal', 'fog'])
  mode: 'reveal' | 'fog';
}

/**
 * UpdateOrganicFogDto
 * Payload for setting organic fog strokes for a given campaign+map.
 */
export class UpdateOrganicFogDto {
  /** Campaign scope for this fog state. */
  @IsString()
  @IsUUID()
  campaignId: string;

  /** Organic fog strokes to persist. */
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => OrganicFogStrokeDto)
  strokes: OrganicFogStrokeDto[];
}
