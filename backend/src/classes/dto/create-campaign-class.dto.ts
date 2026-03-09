import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign class (homebrew or manual copy).
 */
export class CreateCampaignClassDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceClassId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
