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
 * Campaign-specific class: homebrew or edited copy from a manual.
 */
@Entity()
export class CampaignClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The campaign this class belongs to. CASCADE on delete. */
  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Manual id if this class was copied from a manual. */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /** Class id within the source manual (e.g. "barbarian"). */
  @Column({ type: 'text', nullable: true })
  sourceClassId?: string | null;

  /** Optional homebrew attribution. */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Full class data when customized or homebrew.
   * Stored as JSON snapshot of CharacterClass interface.
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
