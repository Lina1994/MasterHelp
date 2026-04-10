import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a new custom manual.
 */
export class CreateManualDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v)) : []))
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsString()
  about?: string;
}
