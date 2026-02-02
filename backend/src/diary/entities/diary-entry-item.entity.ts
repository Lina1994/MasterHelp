import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DiaryEntry } from './diary-entry.entity';

/**
 * A single entry item within a diary day.
 *
 * By default items are private (isPublic=false).
 */
@Entity()
@Index(['entryId', 'order'])
export class DiaryEntryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entryId: string;

  @ManyToOne(() => DiaryEntry, (entry) => entry.items, { onDelete: 'CASCADE' })
  entry: DiaryEntry;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  html: string | null;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  /**
   * 0-based order within the day.
   */
  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'int', nullable: true })
  lastEditedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
