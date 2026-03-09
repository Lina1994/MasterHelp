import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign background.
 */
export class UpdateCampaignBackgroundDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
