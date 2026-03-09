import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

/**
 * A campaign-specific background entry (manual-edited copy or homebrew).
 */
@Entity('campaign_backgrounds')
export class CampaignBackground {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Null for homebrew entries. */
  @Column({ nullable: true })
  sourceManualId: string;

  /** Original background id inside the manual. Null for homebrew. */
  @Column({ nullable: true })
  sourceBackgroundId: string;

  /** Optional custom origin label (e.g. "Manual editado"). */
  @Column({ nullable: true })
  customOriginName: string;

  /** Full custom data blob storing the background fields. */
  @Column({ type: 'simple-json', nullable: true })
  customData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
