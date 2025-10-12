import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * UpdateMapDto
 * Allows partial updates to a map. Image can be updated via separate upload endpoint or same create endpoint with file.
 */
export class UpdateMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  group?: string;

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
        // Si llega una cadena no parseable, degradamos a objeto vacío para no romper la validación
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

  /**
   * Visual transform for the map. Accepts either object or JSON string.
   * zoom: >= 0.05, rotationDeg: any number, translateXPct/translateYPct: typically -100..100
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { const parsed = JSON.parse(value); return parsed; } catch { return undefined; }
    }
    return undefined;
  })
  @IsObject()
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };
}
