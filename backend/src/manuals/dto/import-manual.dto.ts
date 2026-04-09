import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { ManualEntryType } from '../entities/manual-entry.entity';

const VALID_ENTRY_TYPES: ManualEntryType[] = [
  'monster',
  'spell',
  'class',
  'race',
  'background',
  'feat',
  'trait',
  'skill',
  'section',
];

/**
 * A single entry within the import payload.
 */
class ImportManualEntryItem {
  @IsNotEmpty()
  @IsString()
  @IsIn(VALID_ENTRY_TYPES)
  entryType: ManualEntryType;

  @IsNotEmpty()
  @IsString()
  entryKey: string;

  @IsNotEmpty()
  @IsString()
  lang: string;

  @IsNotEmpty()
  @IsObject()
  data: Record<string, any>;
}

/**
 * DTO for importing a full manual from a JSON export.
 */
export class ImportManualDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v)) : []))
  @IsString({ each: true })
  languages?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportManualEntryItem)
  entries: ImportManualEntryItem[];
}
