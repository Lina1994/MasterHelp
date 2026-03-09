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
 * Campaign-specific feat: homebrew or edited copy from a manual.
 */
@Entity()
export class CampaignFeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The campaign this feat belongs to. CASCADE on delete. */
  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Manual id if this feat was copied from a manual. */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /** Feat id within the source manual. */
  @Column({ type: 'text', nullable: true })
  sourceFeatId?: string | null;

  /** Optional homebrew attribution. */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Full feat data when customized or homebrew.
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: {
    name: string;
    prerequisite?: string | null;
    description: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
