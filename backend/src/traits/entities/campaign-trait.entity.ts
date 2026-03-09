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
 * Campaign-specific trait: homebrew or edited copy from a manual.
 * - sourceManualId + sourceTraitId → references a manual trait
 * - customData → overrides manual data (for edits) or stores full homebrew trait
 * - No sourceManualId → pure homebrew
 */
@Entity()
export class CampaignTrait {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The campaign this trait belongs to. CASCADE on delete. */
  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Manual id if this trait was copied from a manual. */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /** Trait id within the source manual. */
  @Column({ type: 'text', nullable: true })
  sourceTraitId?: string | null;

  /** Optional homebrew attribution. */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Full trait data when customized or homebrew.
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: {
    name: string;
    description: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
