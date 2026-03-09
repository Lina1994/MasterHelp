import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

/**
 * DTO for listing campaign classes with filters and pagination.
 */
export class ListCampaignClassesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsIn(['name', 'name_desc', 'hitDie', 'hitDie_desc', 'origin', 'origin_desc'])
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
