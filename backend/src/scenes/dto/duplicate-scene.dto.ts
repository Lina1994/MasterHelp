import { IsOptional, IsUUID } from 'class-validator';

/**
 * DTO for duplicating an owned scene, optionally into another campaign.
 */
export class DuplicateSceneDto {
  @IsOptional()
  @IsUUID('4')
  targetCampaignId?: string | null;
}
