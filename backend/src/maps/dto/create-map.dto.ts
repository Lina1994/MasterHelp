import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * CreateMapDto
 * Accepts basic metadata for a map. Image is uploaded via multipart form-data (field: file).
 */
export class CreateMapDto {
  @IsString()
  @MinLength(1, { message: 'Map name must not be empty' })
  @MaxLength(200, { message: 'Map name must not exceed 200 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  /**
   * Map groups. Accepts a JSON-encoded string array (e.g. '["City","Dungeon"]') or a plain string.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        return [value];
      }
    }
    return undefined;
  })
  group?: string[];

  @IsOptional()
  @IsIn(['', 'dawn', 'morning', 'afternoon', 'night'])
  timeOfDay?: '' | 'dawn' | 'morning' | 'afternoon' | 'night';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
  })
  @IsBoolean()
  isWorldMap?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  })
  @IsObject()
  musicConfig?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  })
  @IsObject()
  sfxConfig?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') { try { const o = JSON.parse(value); return o; } catch { return undefined; } }
    return undefined;
  })
  @IsObject()
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  })
  @IsObject()
  imageFilters?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  })
  @IsObject()
  skylineFilters?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
  })
  @IsBoolean()
  fogEnabledByDefault?: boolean;
}
