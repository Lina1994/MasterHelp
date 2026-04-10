import { IsOptional, IsString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for updating an existing custom manual's metadata.
 */
export class UpdateManualDto {
  @IsOptional()
  @IsString()
  title?: string;

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
