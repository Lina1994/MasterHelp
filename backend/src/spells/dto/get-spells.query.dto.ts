import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query DTO for listing spells with optional filters.
 * Supports text search, level, school, and locale (lang).
 */
export class GetSpellsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  @Type(() => Number)
  level?: number;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'es'])
  lang?: 'en' | 'es';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'level', 'school'])
  sortBy?: 'name' | 'level' | 'school';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
