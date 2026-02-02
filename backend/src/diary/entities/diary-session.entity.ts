import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiarySessionItem } from './diary-session-item.entity';

export type DiaryDayRef = {
  year: number;
  monthIndex: number;
  dayIndex: number;
};

/**
 * Diary session.
 *
 * A session is a real-world play session which can be linked to multiple
 * in-game diary days that were visited during the session.
 */
@Entity()
@Index(['campaignId', 'startedAt'], { unique: false })
export class DiarySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'text', nullable: true })
  publicHtml: string | null;

  @Column({ type: 'text', nullable: true })
  privateHtml: string | null;

  @OneToMany(() => DiarySessionItem, (item) => item.session)
  items?: DiarySessionItem[];

  @Column({ type: 'simple-json', default: '[]' })
  days: DiaryDayRef[];

  @Column({ type: 'datetime' })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int' })
  createdByUserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
