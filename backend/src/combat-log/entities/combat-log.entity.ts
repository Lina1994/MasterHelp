import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Outcome of a finished combat. */
export type CombatOutcome = 'victory' | 'escape';

/** Per-participant state captured in a turn snapshot. */
export interface CombatParticipantSnapshot {
  id: string;
  name: string;
  role?: 'ally' | 'foe';
  kind?: 'character' | 'enemy';
  currentHp?: number | null;
  maxHp?: number | null;
  /** Free-text combat note for this participant at the snapshot moment. */
  note?: string | null;
}

/**
 * Snapshot of the combat taken when a turn ends (i.e. when the next turn
 * begins). Captures the round/turn that just finished and the state of every
 * participant at that moment.
 */
export interface CombatTurnSnapshot {
  round: number;
  /** 0-based index of the turn that just finished. */
  turnIndex: number;
  /** Participant whose turn just finished (if known). */
  turnParticipantId?: string | null;
  turnParticipantName?: string | null;
  /** ISO timestamp when the snapshot was captured. */
  at: string;
  participants: CombatParticipantSnapshot[];
}

/**
 * A single combat "run". Each time a combat starts a new row is created, so the
 * same encounter fought multiple times produces separate, independent history
 * entries — never mixed — each tagged with the campaign calendar day.
 */
@Entity()
@Index(['campaignId', 'encounterId'])
@Index(['campaignId', 'startedAt'])
export class CombatLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  /** Encounter this combat was based on (nullable if encounter was deleted). */
  @Column({ type: 'uuid', nullable: true })
  encounterId: string | null;

  /** Encounter name captured at start (kept even if the encounter is renamed/deleted). */
  @Column({ type: 'text', nullable: true })
  encounterName: string | null;

  /** Map/place where the combat happened (nullable). */
  @Column({ type: 'uuid', nullable: true })
  mapId: string | null;

  @Column({ type: 'text', nullable: true })
  mapName: string | null;

  // --- Campaign calendar day when the combat took place ---
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  monthIndex: number;

  @Column({ type: 'int' })
  dayIndex: number;

  /** Ordered list of turn snapshots captured during the combat. */
  @Column({ type: 'simple-json', default: '[]' })
  snapshots: CombatTurnSnapshot[];

  @Column({ type: 'datetime' })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  outcome: CombatOutcome | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
