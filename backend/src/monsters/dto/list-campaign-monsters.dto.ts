import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';

export class ListCampaignMonstersDto {
  @IsOptional()
  @IsString()
  q?: string; // search query

  @IsOptional()
  @IsString()
  type?: string; // monster type filter

  @IsOptional()
  @IsString()
  size?: string; // size filter

  @IsOptional()
  @IsString()
  alignment?: string; // alignment filter

  @IsOptional()
  @IsString()
  origin?: string; // 'manual' | 'homebrew'

  @IsOptional()
  @IsString()
  cr?: string; // comma-separated CR values, e.g., "0,1/4,1/2,1,5"

  @IsOptional()
  @IsIn(['name', 'name_desc', 'type', 'type_desc', 'size', 'size_desc', 'cr', 'cr_desc', 'origin', 'origin_desc'])
  sort?: 'name' | 'name_desc' | 'type' | 'type_desc' | 'size' | 'size_desc' | 'cr' | 'cr_desc' | 'origin' | 'origin_desc';

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
