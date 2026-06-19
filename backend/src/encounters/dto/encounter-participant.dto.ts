/** Representa a un integrante del encuentro (PJ o enemigo). */
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
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

  /** Referencia opcional al monstruo del bestiario (para auto-cálculo de iniciativa). */
  @IsOptional()
  @IsString()
  monsterManualId?: string;

  @IsOptional()
  @IsString()
  monsterSlug?: string;

  /** Referencia al monstruo del bestiario de campaña (alternativa a monsterManualId+monsterSlug). */
  @IsOptional()
  @IsString()
  monsterCampaignId?: string;

  /** Indica una invocación añadida en combate; no cuenta para la dificultad. */
  @IsOptional()
  @IsBoolean()
  isSummon?: boolean;
}
