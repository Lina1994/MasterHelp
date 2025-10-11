import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MapImage } from './map-image.entity';

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
   * Optional grouping label to categorize maps (e.g., city, dungeon, region).
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  group?: string | null;

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

  @ManyToOne(() => Campaign, { nullable: true, eager: true })
  campaign?: Campaign | null;

  @OneToMany(() => MapImage, (img) => img.map, { cascade: true, eager: true })
  images?: MapImage[];
}
