import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * DTO for moving a note to a different folder (or to root).
 */
export class MoveNoteDto {
  /** Target folder id.  Send `null` to move the note to root level. */
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  /** New position within the target folder/root. */
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
