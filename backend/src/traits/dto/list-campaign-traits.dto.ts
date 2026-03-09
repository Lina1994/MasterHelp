import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

/**
 * DTO for listing campaign traits with filters and pagination.
 */
export class ListCampaignTraitsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsIn(['name', 'name_desc', 'origin', 'origin_desc'])
  sort?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
