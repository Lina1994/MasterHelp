import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

export class ListCampaignSpellsDto {
  @IsOptional()
  @IsString()
  q?: string; // search query

  @IsOptional()
  @IsString()
  school?: string; // spell school filter

  @IsOptional()
  @IsString()
  level?: string; // comma-separated levels, e.g., "0,1,2,3"

  @IsOptional()
  @IsString()
  concentration?: string; // 'true' | 'false'

  @IsOptional()
  @IsString()
  ritual?: string; // 'true' | 'false'

  @IsOptional()
  @IsString()
  origin?: string; // 'manual' | 'manual-edited' | 'homebrew'

  @IsOptional()
  @IsIn(['name', 'name_desc', 'level', 'level_desc', 'school', 'school_desc', 'origin', 'origin_desc'])
  sort?: 'name' | 'name_desc' | 'level' | 'level_desc' | 'school' | 'school_desc' | 'origin' | 'origin_desc';

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
