import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign trait (homebrew or manual copy).
 */
export class CreateCampaignTraitDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceTraitId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
