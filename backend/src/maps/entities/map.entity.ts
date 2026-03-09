import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MapImage } from './map-image.entity';
import { MapSkylineImage } from './map-skyline-image.entity';

/**
 * Map
 * Represents a DM map owned by a user and optionally linked to a campaign.
 * Stores a single image BLOB for MVP; can be extended to multiple resolutions later.
 */
@Entity()
export class MapEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * Optional grouping labels to categorize maps (e.g., city, dungeon, region).
   * Stored as JSON array string for multi-group support.
   * Backward-compatible: old plain-string values are wrapped in an array on read.
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to(value: string[] | null | undefined): string | null {
        if (!value || (Array.isArray(value) && value.length === 0)) return null;
        return JSON.stringify(value);
      },
      from(value: string | null | undefined): string[] {
        if (!value) return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          return value ? [value] : [];
        }
      },
    },
  })
  group: string[];

  /**
   * Optional current time-of-day for this map view.
   * One of: 'dawn' | 'morning' | 'afternoon' | 'night'.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null;

  /**
   * Whether this map is meant to be a "World map" with special UI affordances.
   */
  @Column({ type: 'boolean', default: false })
  isWorldMap: boolean;

  /**
   * Map music configuration by time of day and situation.
   * JSON structure example:
   * {
   *   "morning": { "base": "<songId>", "battleMedium": "<songId>" },
   *   "night": { "base": "<songId>" }
   * }
   */
  @Column({ type: 'simple-json', nullable: true })
  musicConfig?: Record<string, any> | null;

  /**
   * Map sound-effects preset configuration by time of day and situation.
   * JSON structure example analogous to musicConfig but holding preset IDs.
   */
  @Column({ type: 'simple-json', nullable: true })
  sfxConfig?: Record<string, any> | null;

  /**
   * Visual transform configuration for this map (persisted per map).
   * Example: { zoom: 1, rotationDeg: 0, translateXPct: 0, translateYPct: 0 }
   */
  @Column({ type: 'simple-json', nullable: true })
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number } | null;

  // Legacy single-image fields (kept for backward compatibility; prefer MapImage variants)
  @Column({ nullable: true })
  imageMimeType?: string | null;

  @Column('int', { nullable: true })
  imageSize?: number | null;

  @Column({ type: 'blob', nullable: true })
  imageData?: Buffer | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { eager: true })
  owner: User;

  @ManyToOne(() => Campaign, { nullable: true, eager: false })
  campaign?: Campaign | null;

  @OneToMany(() => MapImage, (img) => img.map, { cascade: true, eager: false })
  images?: MapImage[];

  /** Optional skyline image variants (per time-of-day), independent from main map images. */
  @OneToMany(() => MapSkylineImage, (img) => img.map, { cascade: true, eager: false })
  skylines?: MapSkylineImage[];
}
