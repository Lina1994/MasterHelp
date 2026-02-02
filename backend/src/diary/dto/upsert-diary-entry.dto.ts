import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

/**
 * A single item inside a diary day.
 */
export class UpsertDiaryEntryItemDto {
  /** Existing item id (if updating). If omitted, a new item is created. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  html?: string | null;

  /** If omitted, defaults to false (private). */
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

/**
 * Upserts a diary entry for a specific in-game date.
 */
export class UpsertDiaryEntryDto {
  @IsInt()
  year: number;

  /** 0-based month index. */
  @IsInt()
  @Min(0)
  monthIndex: number;

  /** 1-based day index within the month. */
  @IsInt()
  @Min(1)
  dayIndex: number;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  publicHtml?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  privateHtml?: string | null;

  /**
   * New format: multiple items with per-item visibility.
   *
   * If provided, takes precedence over legacy publicHtml/privateHtml.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDiaryEntryItemDto)
  items?: UpsertDiaryEntryItemDto[];
}
