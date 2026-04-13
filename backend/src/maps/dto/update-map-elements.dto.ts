import { IsArray, IsString, IsUUID, ArrayMaxSize, ValidateNested, IsNumber, IsBoolean, IsOptional, Min, Max, IsIn, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Normalised coordinate point (0–1).
 */
class PointDto {
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
}

/**
 * Time-of-day intensity (0–1) for lights/windows.
 */
class TimeOfDayIntensityDto {
  @IsNumber() @Min(0) @Max(1) dawn: number;
  @IsNumber() @Min(0) @Max(1) morning: number;
  @IsNumber() @Min(0) @Max(1) afternoon: number;
  @IsNumber() @Min(0) @Max(1) night: number;
}

/**
 * Single map element (wall, door, window, or light).
 * Validated loosely via the discriminant `type` field; further runtime
 * checks happen in the service layer.
 */
class MapElementDto {
  @IsString()
  @MinLength(1, { message: 'Element id must not be empty' })
  @MaxLength(255, { message: 'Element id must not exceed 255 characters' })
  id: string;
  @IsString() @IsIn(['wall', 'door', 'window', 'light', 'sound']) type: 'wall' | 'door' | 'window' | 'light' | 'sound';

  // --- Wall / Door / Window ---
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PointDto) @ArrayMaxSize(5000)
  points?: PointDto[];

  // --- Door ---
  @IsOptional() @IsBoolean() isOpen?: boolean;

  // --- Window ---
  @IsOptional() @ValidateNested() @Type(() => TimeOfDayIntensityDto)
  lightByTimeOfDay?: TimeOfDayIntensityDto;
  @IsOptional() @IsBoolean() covered?: boolean;

  // --- Light / Sound ---
  @IsOptional() @ValidateNested() @Type(() => PointDto)
  position?: PointDto;

  @IsOptional() @IsNumber() @Min(1) @Max(5000) radius?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() isOn?: boolean;
  @IsOptional() @IsBoolean() showInPreview?: boolean;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) label?: string;

  @IsOptional() @ValidateNested() @Type(() => TimeOfDayIntensityDto)
  intensityByTimeOfDay?: TimeOfDayIntensityDto;

  // --- Sound source ---
  @IsOptional() @IsNumber() @Min(0) @Max(1) volume?: number;
  @IsOptional() @IsString() @IsIn(['song', 'playlist', 'effect', 'preset']) sourceType?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) sourceId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) sourceName?: string;
}

/**
 * UpdateMapElementsDto
 * Payload for setting map elements (walls, doors, windows, lights) for a given campaign+map.
 */
export class UpdateMapElementsDto {
  /** Campaign scope for this elements state. */
  @IsString()
  @IsUUID()
  campaignId: string;

  /** Full replacement array of map elements. */
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => MapElementDto)
  elements: MapElementDto[];
}
