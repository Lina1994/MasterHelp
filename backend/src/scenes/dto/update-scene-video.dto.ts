import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * DTO for updating mutable scene video metadata.
 */
export class UpdateSceneVideoDto {
  @ApiPropertyOptional({
    description: 'Visible display name for the scene video asset.',
    minLength: 1,
    maxLength: 120,
    example: 'Lluvia intensa en ciudad',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional descriptive text for internal organization.',
    maxLength: 500,
    example: 'Version nocturna para escena de introduccion',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
