import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign trait.
 */
export class UpdateCampaignTraitDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
