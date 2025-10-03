import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateSongDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  atmosphere?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
