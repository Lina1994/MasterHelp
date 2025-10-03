import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf, IsUUID } from 'class-validator';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ValidateIf((o) => !!o.url)
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsUUID()
  @IsOptional()
  campaignId?: string; // Permite auto-asociar la canción a una campaña del owner
}
