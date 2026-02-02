import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DiarySession } from './diary-session.entity';

/**
 * A single notes item within a diary session.
 *
 * By default items are private (isPublic=false).
 */
@Entity()
@Index(['sessionId', 'order'])
export class DiarySessionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => DiarySession, (session) => session.items, { onDelete: 'CASCADE' })
  session: DiarySession;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  html: string | null;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  /** 0-based order within the session. */
  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'int', nullable: true })
  lastEditedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
