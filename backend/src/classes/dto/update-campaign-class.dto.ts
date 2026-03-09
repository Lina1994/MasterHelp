import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign class.
 */
export class UpdateCampaignClassDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
