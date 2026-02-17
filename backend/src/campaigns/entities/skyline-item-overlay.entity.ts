import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Campaign } from './campaign.entity';

/**
 * SkylineItemOverlay entity - Represents an item image projected in the Skyline overlay.
 * Each campaign can have multiple items displayed simultaneously.
 */
@Entity()
export class SkylineItemOverlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  campaign: Campaign;

  /**
   * ID of the shop cell containing the image to display.
   */
  @Column()
  cellId: string;

  /**
   * Optional label/name for this item (for UI purposes).
   */
  @Column({ nullable: true })
  label: string | null;

  /**
   * Display order (lower values appear first/bottom layer).
   */
  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;
}
