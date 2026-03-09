import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

/**
 * Campaign-specific skill: homebrew or edited copy from a manual.
 * - sourceManualId + sourceSkillId → references a manual skill
 * - customData → overrides manual data (for edits) or stores full homebrew skill
 * - No sourceManualId → pure homebrew
 */
@Entity()
export class CampaignSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The campaign this skill belongs to. CASCADE on delete. */
  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Manual id if this skill was copied from a manual. */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /** Skill id within the source manual. */
  @Column({ type: 'text', nullable: true })
  sourceSkillId?: string | null;

  /** Optional homebrew attribution. */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Full skill data when customized or homebrew.
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: {
    name: string;
    ability: string;
    description: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
