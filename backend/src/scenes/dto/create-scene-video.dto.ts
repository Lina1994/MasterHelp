import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO for scene video upload metadata.
 */
export class CreateSceneVideoDto {
  @ApiPropertyOptional({ description: 'Human-readable asset name', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Optional campaign scope for this asset' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}
