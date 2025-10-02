import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IsUrlOrDataUri } from '../../config/validators/is-url-or-data-uri.validator';

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
}
