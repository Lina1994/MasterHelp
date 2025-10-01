import { IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateIf(o => o.imageUrl !== '') // Solo validar si no es un string vacío
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  imageUrl?: string;
}