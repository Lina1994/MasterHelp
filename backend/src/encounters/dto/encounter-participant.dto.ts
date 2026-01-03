/** Representa a un integrante del encuentro (PJ o enemigo). */
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EncounterParticipantDto {
  @IsString()
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsIn(['character', 'enemy'])
  kind: 'character' | 'enemy';

  @IsOptional()
  @IsIn(['ally', 'foe'])
  role?: 'ally' | 'foe';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(30)
  level?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentHp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-10)
  @Max(50)
  initiative?: number;
}
