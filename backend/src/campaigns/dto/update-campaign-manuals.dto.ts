import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO to update selected manuals for a campaign.
 */
export class UpdateCampaignManualsDto {
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value.map((v) => String(v)) : [])
  @IsString({ each: true })
  manualIds?: string[];
}
