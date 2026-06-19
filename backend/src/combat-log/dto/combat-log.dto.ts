import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Payload to start a new combat run. */
export class StartCombatLogDto {
  @IsString()
  @IsOptional()
  encounterId?: string | null;

  @IsString()
  @IsOptional()
  encounterName?: string | null;

  @IsString()
  @IsOptional()
  mapId?: string | null;

  @IsString()
  @IsOptional()
  mapName?: string | null;
}

/** Per-participant state inside a snapshot. */
export class CombatParticipantSnapshotDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  role?: 'ally' | 'foe';

  @IsString()
  @IsOptional()
  kind?: 'character' | 'enemy';

  @IsInt()
  @IsOptional()
  currentHp?: number | null;

  @IsInt()
  @IsOptional()
  maxHp?: number | null;

  @IsString()
  @IsOptional()
  note?: string | null;
}

/** A single turn snapshot appended to a combat run. */
export class CombatTurnSnapshotDto {
  @IsInt()
  round!: number;

  @IsInt()
  turnIndex!: number;

  @IsString()
  @IsOptional()
  turnParticipantId?: string | null;

  @IsString()
  @IsOptional()
  turnParticipantName?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombatParticipantSnapshotDto)
  participants!: CombatParticipantSnapshotDto[];
}

/** Payload to append a turn snapshot. */
export class AppendCombatSnapshotDto {
  @ValidateNested()
  @Type(() => CombatTurnSnapshotDto)
  snapshot!: CombatTurnSnapshotDto;
}

/** Payload to end a combat run. */
export class EndCombatLogDto {
  @IsIn(['victory', 'escape'])
  @IsOptional()
  outcome?: 'victory' | 'escape';
}
