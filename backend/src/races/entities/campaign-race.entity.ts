import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

/**
 * A campaign-specific race entry (manual-edited copy or homebrew).
 */
@Entity('campaign_races')
export class CampaignRace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Null for homebrew entries. */
  @Column({ nullable: true })
  sourceManualId: string;

  /** Original race id inside the manual. Null for homebrew. */
  @Column({ nullable: true })
  sourceRaceId: string;

  /** Optional custom origin label (e.g. "Manual editado"). */
  @Column({ nullable: true })
  customOriginName: string;

  /** Full custom data blob storing the race fields. */
  @Column({ type: 'simple-json', nullable: true })
  customData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
