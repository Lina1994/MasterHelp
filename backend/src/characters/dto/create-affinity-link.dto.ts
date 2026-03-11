import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * DTO for creating a new affinity link between two characters.
 */
export class CreateAffinityLinkDto {
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @IsNotEmpty()
  @IsString()
  characterAId: string;

  @IsNotEmpty()
  @IsString()
  characterBId: string;

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
