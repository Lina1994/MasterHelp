import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO for updating an existing Worldpedia folder.
 */
export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
