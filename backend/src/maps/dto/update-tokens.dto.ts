import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MapTokenDto {
  @IsString()
  id: string;

  @IsString()
  cellKey: string; // formatted as "col:row"

  @IsString()
  @IsIn(['ally', 'enemy'])
  type: 'ally' | 'enemy';

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  rotationDeg?: number;
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
