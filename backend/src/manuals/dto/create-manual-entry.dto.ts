import { IsNotEmpty, IsString, IsIn, IsObject } from 'class-validator';
import type { ManualEntryType } from '../entities/manual-entry.entity';

/** Valid entry type values used for runtime validation. */
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
 * DTO for creating a new entry inside a custom manual.
 */
export class CreateManualEntryDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(VALID_ENTRY_TYPES)
  entryType: ManualEntryType;

  /** Slug-like key unique within (manual, entryType, lang). */
  @IsNotEmpty()
  @IsString()
  entryKey: string;

  /** ISO 639-1 language code (e.g. 'en', 'es'). */
  @IsNotEmpty()
  @IsString()
  lang: string;

  /** Full JSON payload. Schema depends on entryType. */
  @IsNotEmpty()
  @IsObject()
  data: Record<string, any>;
}
