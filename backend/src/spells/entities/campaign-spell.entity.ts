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
 * Campaign-specific spell: homebrew or edited copy from a manual.
 * - If sourceManualId and sourceSpellId are set: references a manual spell
 * - If customData is set: overrides manual data (for edits) or stores full homebrew spell
 * - If only customData is set and no sourceManualId: pure homebrew
 */
@Entity()
export class CampaignSpell {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The campaign this spell belongs to.
   * When a campaign is deleted, all its custom spells are deleted (CASCADE).
   */
  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /**
   * If this spell originates from a manual, store the manual's identifier.
   * Examples: 'dnd5e-2014', 'dnd5e-2024'.
   * Nullable for pure homebrew spells.
   */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /**
   * If this spell originates from a manual, store the spell's unique ID in that manual.
   * Nullable for pure homebrew spells.
   */
  @Column({ type: 'text', nullable: true })
  sourceSpellId?: string | null;

  /**
   * For homebrew spells, optionally store attribution.
   * Example: "Created by John Smith"
   */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Full spell data when customized or homebrew.
   * Structure matches CampaignSpellDetail interface:
   * {
   *   name: string;
   *   level: number;
   *   school: string;
   *   castingTime: string;
   *   range: string;
   *   duration: string;
   *   components: string;
   *   materials?: string;
   *   classes?: string[];
   *   ritual?: boolean;
   *   concentration?: boolean;
   *   description?: string;
   *   savingThrow?: string;
   *   areaOfEffect?: string;
   * }
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: {
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    duration: string;
    components: string;
    materials?: string;
    classes?: string[];
    ritual?: boolean;
    concentration?: boolean;
    description?: string;
    savingThrow?: string;
    areaOfEffect?: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
