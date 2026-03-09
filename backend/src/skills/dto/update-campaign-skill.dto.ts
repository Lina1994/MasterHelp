import { IsOptional, IsString, IsObject } from 'class-validator';

/**
 * DTO for updating a campaign skill.
 */
export class UpdateCampaignSkillDto {
  @IsOptional()
  @IsString()
  customOriginName?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;
}
