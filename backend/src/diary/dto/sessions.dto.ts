import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertDiarySessionItemDto {
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

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class DiaryDayRefDto {
  @IsInt()
  year: number;

  @IsInt()
  @Min(0)
  monthIndex: number;

  @IsInt()
  @Min(1)
  dayIndex: number;
}

/** Create a new session (not started/ended semantics). */
export class CreateDiarySessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  publicHtml?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  privateHtml?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDiarySessionItemDto)
  items?: UpsertDiarySessionItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiaryDayRefDto)
  days?: DiaryDayRefDto[];
}

export class UpdateDiarySessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  publicHtml?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  privateHtml?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDiarySessionItemDto)
  items?: UpsertDiarySessionItemDto[];
}

export class StartDiarySessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class VisitDiaryDayDto {
  @ValidateNested()
  @Type(() => DiaryDayRefDto)
  day: DiaryDayRefDto;
}
