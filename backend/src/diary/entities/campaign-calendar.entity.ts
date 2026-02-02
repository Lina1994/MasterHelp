import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

export type DiaryMonthConfig = {
  name: string;
  days: number;
};

export type DiaryWeekdayConfig = {
  name: string;
};

export type DiaryCalendarConfig = {
  currentYear: number;
  months: DiaryMonthConfig[];
  weekDays: DiaryWeekdayConfig[];
};

/**
 * Per-campaign diary calendar configuration.
 *
 * Stored as JSON for flexibility (SQLite).
 */
@Entity()
@Index(['campaignId'], { unique: true })
export class CampaignCalendar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'simple-json' })
  config: DiaryCalendarConfig;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
