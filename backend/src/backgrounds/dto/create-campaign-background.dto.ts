import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign background (homebrew or manual-edited).
 */
export class CreateCampaignBackgroundDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceBackgroundId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
