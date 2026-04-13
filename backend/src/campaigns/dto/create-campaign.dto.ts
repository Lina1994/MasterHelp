import { IsNotEmpty, IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';
import { IsUrlOrDataUri } from '../../config/validators/is-url-or-data-uri.validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a campaign.
 * Sprint 2: Added length validations for name and description.
 */
export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'Campaign name must not be empty' })
  @MaxLength(200, { message: 'Campaign name must not exceed 200 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Campaign description must not exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  @IsUrlOrDataUri()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value.map((v) => String(v)) : [])
  @IsString({ each: true })
  selectedManualIds?: string[];
}
