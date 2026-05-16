import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * DTO for requesting a derived clip render from an existing scene video asset.
 */
export class CreateSceneVideoClipDto {
  @ApiProperty({
    description: 'Clip start time in seconds within the source asset.',
    minimum: 0,
    example: 12.4,
  })
  @IsNumber()
  @Min(0)
  startSec: number;

  @ApiProperty({
    description: 'Clip end time in seconds within the source asset. Must be greater than startSec.',
    minimum: 0,
    example: 20.8,
  })
  @IsNumber()
  @Min(0)
  endSec: number;

  @ApiPropertyOptional({
    description: 'Optional display name for the derived clip asset.',
    minLength: 1,
    maxLength: 120,
    example: 'Intro loop clip',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;
}
