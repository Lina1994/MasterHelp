import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO to request a temporary signed stream URL.
 */
export class GenerateSceneVideoStreamUrlDto {
  @ApiPropertyOptional({
    description: 'Time to live in seconds for the signed URL',
    minimum: 30,
    maximum: 3600,
    default: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  ttlSeconds?: number;
}
