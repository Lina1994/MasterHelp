import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateCampaignSpellDto {
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
