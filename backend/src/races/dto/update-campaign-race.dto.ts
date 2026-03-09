import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign race.
 */
export class UpdateCampaignRaceDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
