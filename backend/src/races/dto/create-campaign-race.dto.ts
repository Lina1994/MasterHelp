import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign race (homebrew or manual-edited).
 */
export class CreateCampaignRaceDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceRaceId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
