import { IsOptional, IsString } from 'class-validator';
import { IsUrlOrDataUri } from '../../config/validators/is-url-or-data-uri.validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrlOrDataUri()
  imageUrl?: string;
}