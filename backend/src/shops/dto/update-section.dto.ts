import { IsOptional, IsString, IsInt } from 'class-validator';

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
