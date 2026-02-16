import { IsOptional, IsString, IsObject } from 'class-validator';

export class CreateCampaignSpellDto {
  /**
   * Campaign ID (passed via route param, not body)
   */
  campaignId?: string;

  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceSpellId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
