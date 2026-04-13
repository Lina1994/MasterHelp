import { IsOptional, IsString, IsObject, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for creating a campaign background (homebrew or manual-edited).
 * Sprint 1: Added validation for string length and UUID format.
 */
export class CreateCampaignBackgroundDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  sourceBackgroundId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
