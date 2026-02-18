import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

/* ──────────────────────────── Export shapes ──────────────────────────── */

export class ImportLinkDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  label?: string | null;

  @IsOptional()
  @IsString()
  targetUrl?: string | null;

  /** Original note id in the exported file (will be remapped). */
  @IsOptional()
  @IsString()
  targetNoteId?: string | null;

  @IsOptional()
  @IsString()
  targetEntityType?: string | null;

  @IsOptional()
  @IsString()
  targetEntityId?: string | null;
}

export class ImportNoteDto {
  /** Original id from the exported file (used for internal remap). */
  @IsOptional()
  @IsString()
  originalId?: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  html?: string | null;

  /** Original folder id from export file. */
  @IsOptional()
  @IsString()
  originalFolderId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLinkDto)
  links?: ImportLinkDto[];
}

export class ImportFolderDto {
  /** Original id from the exported file (used for internal remap). */
  @IsOptional()
  @IsString()
  originalId?: string;

  @IsString()
  @MaxLength(200)
  name: string;
}

/**
 * DTO for importing Worldpedia data into a campaign.
 *
 * UUIDs are regenerated on import; internal note links are remapped automatically.
 */
export class ImportWorldpediaDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFolderDto)
  folders?: ImportFolderDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNoteDto)
  notes?: ImportNoteDto[];
}
