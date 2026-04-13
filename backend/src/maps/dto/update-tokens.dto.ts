import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MapTokenDto {
  @IsString()
  @MinLength(1, { message: 'Token id must not be empty' })
  @MaxLength(255, { message: 'Token id must not exceed 255 characters' })
  id: string;

  @IsString()
  @MinLength(1, { message: 'Cell key must not be empty' })
  @MaxLength(50, { message: 'Cell key must not exceed 50 characters' })
  cellKey: string; // formatted as "col:row"

  @IsString()
  @IsIn(['ally', 'enemy'])
  type: 'ally' | 'enemy';

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Label must not be empty if provided' })
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  rotationDeg?: number;

  @IsOptional()
  @IsString()
  @IsIn(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'])
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

  @IsOptional()
  @IsString()
  @IsIn(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'])
  originalSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

  @IsOptional()
  @IsNumber()
  orientation?: number;
}

/**
 * UpdateTokensDto
 * Payload for setting tokens for a given campaign+map.
 */
export class UpdateTokensDto {
  /** Campaign scope for this tokens state. */
  @IsString()
  @IsUUID()
  campaignId: string;

  /** Tokens to persist (unique by id). */
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => MapTokenDto)
  tokens: MapTokenDto[];
}
