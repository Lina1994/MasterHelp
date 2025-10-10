import { IsArray, IsOptional, IsString, ArrayNotEmpty, ArrayUnique } from 'class-validator';

/**
 * Actualiza nombre y/o canciones de una lista de reproducción.
 */
export class UpdatePlaylistDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  songs?: string[];
}
