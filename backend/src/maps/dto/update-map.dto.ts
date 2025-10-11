import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
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
  @IsIn(['dawn', 'morning', 'afternoon', 'night'])
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';

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
    try { return JSON.parse(value); } catch { return undefined; }
  })
  @IsObject()
  musicConfig?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return undefined; }
  })
  @IsObject()
  sfxConfig?: Record<string, any>;
}
