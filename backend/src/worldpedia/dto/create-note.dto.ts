import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Represents a single link to be persisted alongside a note.
 */
export class NoteLinkDto {
  @IsIn(['url', 'note', 'entity'])
  type: 'url' | 'note' | 'entity';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  label?: string | null;

  /** External URL (type = 'url'). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  targetUrl?: string | null;

  /** Target note id (type = 'note'). */
  @IsOptional()
  @IsUUID()
  targetNoteId?: string | null;

  /** Target entity type (type = 'entity'). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetEntityType?: string | null;

  /** Target entity id (type = 'entity'). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetEntityId?: string | null;
}

/**
 * DTO for creating a new Worldpedia note.
 */
export class CreateNoteDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  html?: string | null;

  /** Folder to place the note in (null = root). */
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteLinkDto)
  links?: NoteLinkDto[];
}
