import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for creating a campaign skill (homebrew or manual copy).
 */
export class CreateCampaignSkillDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceSkillId?: string;

  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
