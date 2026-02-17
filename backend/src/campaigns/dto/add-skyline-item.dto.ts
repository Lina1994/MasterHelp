import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class AddSkylineItemDto {
  @IsNotEmpty()
  @IsString()
  cellId: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
