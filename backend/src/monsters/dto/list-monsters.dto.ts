import { IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class ListMonstersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  size?: string; // Tiny|Small|Medium|Large|Huge|Gargantuan

  @IsOptional()
  @IsString()
  crMin?: string; // accepts '0', '1/8', '1/4', '1/2', '1', '2', ...

  @IsOptional()
  @IsString()
  crMax?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(['en', 'es'])
  lang?: 'en' | 'es' = 'en';
}
