import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayNotEmpty, ArrayUnique } from 'class-validator';

/**
 * Crea una lista de reproducción asociada a una campaña.
 * songs: array de IDs de canciones (opcional al crear).
 */
export class CreatePlaylistDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  songs?: string[];
}
