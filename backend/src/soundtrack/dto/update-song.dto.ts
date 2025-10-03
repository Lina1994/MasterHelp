import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateSongDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
