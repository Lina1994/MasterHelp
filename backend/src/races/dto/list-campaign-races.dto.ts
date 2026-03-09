import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';

/**
 * DTO for listing/filtering campaign races.
 */
export class ListCampaignRacesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['manual', 'manual-edited', 'homebrew'])
  origin?: string;

  @IsOptional()
  @IsIn(['name', 'name_desc', 'size', 'size_desc', 'origin', 'origin_desc'])
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
