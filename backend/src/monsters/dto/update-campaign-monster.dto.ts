import { IsOptional, IsString, IsObject, IsIn } from 'class-validator';

export class UpdateCampaignMonsterDto {
  @IsOptional()
  @IsString()
  sourceManualId?: string;

  @IsOptional()
  @IsString()
  sourceSlug?: string;

  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;

  @IsOptional()
  @IsIn(['color', 'image'])
  tokenKind?: 'color' | 'image';

  @IsOptional()
  @IsString()
  tokenColor?: string;

  @IsOptional()
  @IsString()
  tokenImageUrl?: string;

  @IsOptional()
  @IsObject()
  imageUrls?: {
    low?: string;
    medium?: string;
    high?: string;
  };
}
