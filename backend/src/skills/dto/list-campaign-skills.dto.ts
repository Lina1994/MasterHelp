import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

/**
 * DTO for listing campaign skills with filters and pagination.
 */
export class ListCampaignSkillsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  ability?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsIn(['name', 'name_desc', 'ability', 'ability_desc', 'origin', 'origin_desc'])
  sort?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;

  @IsOptional()
  @IsIn(['en', 'es'])
  lang?: 'en' | 'es';
}
