import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiaryEntryItem } from './diary-entry-item.entity';

/**
 * Diary entry for a specific in-game date within a campaign calendar.
 *
 * Public content is visible to players (if they have access to the campaign).
 * Private content is only visible to masters.
 */
@Entity()
@Index(['campaignId', 'year', 'monthIndex', 'dayIndex'], { unique: true })
export class DiaryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'int' })
  year: number;

  /** 0-based month index. */
  @Column({ type: 'int' })
  monthIndex: number;

  /** 1-based day index within the month. */
  @Column({ type: 'int' })
  dayIndex: number;

  @Column({ type: 'text', nullable: true })
  publicHtml: string | null;

  @Column({ type: 'text', nullable: true })
  privateHtml: string | null;

  @OneToMany(() => DiaryEntryItem, (item) => item.entry)
  items?: DiaryEntryItem[];

  @Column({ type: 'int', nullable: true })
  lastEditedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
