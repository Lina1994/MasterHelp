import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NoteLinkDto } from './create-note.dto';

/**
 * DTO for updating an existing Worldpedia note.
 */
export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  html?: string | null;

  /** Move the note to a different folder (null = root). */
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
