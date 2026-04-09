import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating an existing entry inside a custom manual.
 */
export class UpdateManualEntryDto {
  /** Updated language code. */
  @IsOptional()
  @IsString()
  lang?: string;

  /** Updated JSON payload. */
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
