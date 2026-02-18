import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * DTO for creating a new Worldpedia folder.
 */
export class CreateFolderDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
