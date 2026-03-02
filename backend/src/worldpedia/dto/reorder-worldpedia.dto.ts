import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Single item in a reorder payload.
 */
export class ReorderItemDto {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  position: number;

  /** Only relevant for notes: target folder (null = root). */
  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}

/**
 * DTO for bulk reordering folders and/or notes in a campaign's Worldpedia.
 *
 * The client sends the full ordered lists after a drag-and-drop operation.
 */
export class ReorderWorldpediaDto {
  /** Updated folder positions (optional). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  folders?: ReorderItemDto[];

  /** Updated note positions, including folderId changes (optional). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  notes?: ReorderItemDto[];
}
