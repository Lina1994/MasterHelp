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
 * Campaign-specific monster entity.
 * Stores either:
 * - A reference to a manual monster (sourceManualId + sourceSlug)
 * - A fully custom/homebrew monster (no sourceManualId/sourceSlug)
 * - An edited copy of a manual monster (has sourceManualId/sourceSlug + customData)
 */
@Entity()
export class CampaignMonster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { nullable: false, onDelete: 'CASCADE' })
  campaign: Campaign;

  /**
   * If this monster originates from a manual, store the manual ID.
   * null = fully homebrew
   */
  @Column({ type: 'text', nullable: true })
  sourceManualId?: string | null;

  /**
   * If this monster originates from a manual, store the slug.
   * When both sourceManualId and sourceSlug exist, this is either:
   * - A reference-only monster (customData is null)
   * - An edited copy (customData is set)
   */
  @Column({ type: 'text', nullable: true })
  sourceSlug?: string | null;

  /**
   * Custom origin name for homebrew monsters.
   * When set, this name is displayed instead of "Homebrew".
   * Useful for crediting sources like "Critical Role", "Reddit u/username", etc.
   */
  @Column({ type: 'text', nullable: true })
  customOriginName?: string | null;

  /**
   * Custom/edited monster data. When null and source* fields exist,
   * the monster data is read from the manual files.
   * When set, this overrides manual data.
   * Stored as JSON matching MonsterDetail structure.
   */
  @Column({ type: 'simple-json', nullable: true })
  customData?: {
    name: string;
    size: string;
    type: string;
    subtype?: string;
    alignment?: string;
    challengeRating?: string;
    experiencePoints?: number;
    armorClass?: { value: number; type?: string; notes?: string };
    hitPoints?: { average: number; roll?: string };
    speed?: Record<string, number>;
    abilities?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    savingThrows?: Record<string, number>;
    skills?: Record<string, number>;
    damageVulnerabilities?: string[];
    damageResistances?: string[];
    damageImmunities?: string[];
    conditionImmunities?: string[];
    senses?: Record<string, any>;
    languages?: string;
    traits?: Array<{ name?: string; text: string }>;
    actions?: Array<{ name?: string; text: string }>;
    reactions?: Array<{ name?: string; text: string }>;
    legendaryActions?: Array<{ name?: string; text: string }>;
    description?: string;
  } | null;

  /**
   * Token configuration for this monster.
   * kind: 'color' uses tokenColor, 'image' uses tokenImageUrl
   */
  @Column({ type: 'text', nullable: true })
  tokenKind?: 'color' | 'image' | null;

  @Column({ type: 'text', nullable: true })
  tokenColor?: string | null;

  /**
   * Token image stored as base64 data URL or external URL.
   */
  @Column({ type: 'text', nullable: true })
  tokenImageUrl?: string | null;

  /**
   * Monster portrait/image in multiple resolutions stored as JSON.
   * Each resolution is stored as base64 data URL.
   */
  @Column({ type: 'simple-json', nullable: true })
  imageUrls?: {
    low?: string | null;
    medium?: string | null;
    high?: string | null;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
