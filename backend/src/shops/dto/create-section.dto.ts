import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateSectionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
