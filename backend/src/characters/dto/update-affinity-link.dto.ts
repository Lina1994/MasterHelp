import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * DTO for updating an existing affinity link.
 */
export class UpdateAffinityLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  labelAtoB?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  labelBtoA?: string;

  @IsOptional()
  @IsInt()
  @Min(-3)
  @Max(3)
  sentiment?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
