import { IsArray, IsOptional, IsString } from 'class-validator';
import { IsUrlOrDataUri } from '../../config/validators/is-url-or-data-uri.validator';
import { Transform } from 'class-transformer';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  @IsUrlOrDataUri()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value.map((v) => String(v)) : undefined)
  @IsString({ each: true })
  selectedManualIds?: string[];
}
