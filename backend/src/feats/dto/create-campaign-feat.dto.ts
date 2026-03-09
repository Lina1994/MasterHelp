import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign feat (homebrew or manual copy).
 */
export class CreateCampaignFeatDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceFeatId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
