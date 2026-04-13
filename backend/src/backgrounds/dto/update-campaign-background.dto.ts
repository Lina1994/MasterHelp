import { IsOptional, IsString, IsObject, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for updating a campaign background.
 * Sprint 1: Added validation for string length.
 */
export class UpdateCampaignBackgroundDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
