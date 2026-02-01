import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * SongPlayLog
 *
 * Persistent log of song play events.
 *
 * Notes:
 * - Stored per campaign (when `campaignId` is provided).
 * - Consecutive duplicates are de-duplicated at write time by the service.
 * - We snapshot `songName` so history remains readable even if the song is deleted.
 */
@Entity()
@Index(['campaignId', 'playedAt'])
export class SongPlayLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Campaign scope for this log entry (null when not associated to a campaign). */
  @Column({ type: 'text', nullable: true })
  campaignId: string | null;

  /** Auth user id snapshot (best-effort). */
  @Column({ type: 'text', nullable: true })
  playedByUserId: string | null;

  /** Song id snapshot. */
  @Column({ type: 'text' })
  songId: string;

  /** Song name snapshot. */
  @Column({ type: 'text' })
  songName: string;

  /** When this play was recorded. */
  @CreateDateColumn()
  playedAt: Date;
}
