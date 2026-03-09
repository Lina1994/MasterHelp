import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';

/**
 * DTO for listing/filtering campaign backgrounds.
 */
export class ListCampaignBackgroundsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['manual', 'manual-edited', 'homebrew'])
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
