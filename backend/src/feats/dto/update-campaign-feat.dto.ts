import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign feat.
 */
export class UpdateCampaignFeatDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
