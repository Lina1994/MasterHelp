import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

export type QuestStatus = 'not_accepted' | 'accepted' | 'completed';

/**
 * Quest/Mission entity.
 * 
 * Quests can be organized by status and have optional prerequisites.
 * When accepted or completed, a public diary entry is automatically created.
 */
@Entity()
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { nullable: false })
  campaign: Campaign;

  @Column({ type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => User, { nullable: false })
  createdBy: User;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', default: 'not_accepted' })
  status: QuestStatus;

  /**
   * Optional prerequisite quest that must be completed before this quest becomes available.
   */
  @ManyToOne(() => Quest, { nullable: true })
  @JoinColumn({ name: 'prerequisiteQuestId' })
  prerequisiteQuest: Quest | null;

  @Column({ type: 'uuid', nullable: true })
  prerequisiteQuestId: string | null;

  /**
   * Order/priority for display (lower numbers appear first).
   */
  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * User who last updated the quest status (accepted/completed).
   */
  @ManyToOne(() => User, { nullable: true })
  lastStatusChangedBy: User | null;

  @Column({ type: 'datetime', nullable: true })
  statusChangedAt: Date | null;
}
