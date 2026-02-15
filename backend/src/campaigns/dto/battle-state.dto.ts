import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Battle state DTO
 * Persisted per campaign (and associated encounter) to synchronize Skyline.
 */
export class BattleStateDto {
  /** Whether the battle has started */
  @IsBoolean()
  @IsOptional()
  started?: boolean;

  /** Encounter id the battle refers to */
  @IsString()
  @IsOptional()
  encounterId?: string | null;

  /** Current round number (>=1) */
  @IsNumber()
  @IsOptional()
  round?: number;

  /** Current turn index (>=0) */
  @IsNumber()
  @IsOptional()
  turnIndex?: number;

  /** Current participant id for the active turn */
  @IsString()
  @IsOptional()
  currentTurnId?: string | null;

  /** Optional initiative strip items (id, name, imageUrl) to render on Skyline */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BattleStripItemDto)
  @IsOptional()
  items?: BattleStripItemDto[];
}

export class BattleStripItemDto {
  @IsString()
  id!: string;
  @IsString()
  name!: string;
  @IsString()
  @IsOptional()
  imageUrl?: string | null;
  @IsString()
  @IsOptional()
  role?: 'ally' | 'foe';
}
