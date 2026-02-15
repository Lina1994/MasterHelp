import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';
import { IsUrlOrDataUri } from '../../config/validators/is-url-or-data-uri.validator';
import { Transform } from 'class-transformer';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrlOrDataUri()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value.map((v) => String(v)) : [])
  @IsString({ each: true })
  manualIds?: string[];
}
