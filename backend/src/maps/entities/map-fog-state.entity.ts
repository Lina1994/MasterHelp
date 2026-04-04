import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MapEntity } from './map.entity';

/**
 * Represents a single organic fog brush stroke.
 * Points are normalised (0–1) relative to the map's natural dimensions.
 */
export interface OrganicFogStroke {
  points: { x: number; y: number }[];
  radius: number;
  mode: 'reveal' | 'fog';
}

/**
 * MapFogState
 * Persists Fog of War cell keys for a specific map within a specific campaign, owned by a user.
 * Uniqueness is enforced on the tuple (ownerId, campaignId, mapId).
 */
@Entity()
@Index(['owner', 'campaign', 'map'], { unique: true })
export class MapFogState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner of the fog state (DM). */
  @ManyToOne(() => User, { eager: true })
  owner: User;

  /** Campaign associated with this fog state. */
  @ManyToOne(() => Campaign, { eager: true, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Map associated with this fog state. */
  @ManyToOne(() => MapEntity, { eager: true, onDelete: 'CASCADE' })
  map: MapEntity;

  /**
   * Stored as a JSON array of string keys (e.g., "c:r" for square, "col:row" for hex).
   * Use text to avoid SQLite JSON limitations and keep it simple.
   */
  @Column({ type: 'simple-json' })
  cells: string[];

  /**
   * Organic fog strokes stored as a JSON array of stroke objects.
   * Each stroke: { points: {x,y}[] (normalised 0–1), radius: number (px at natural size), mode: 'reveal'|'fog' }.
   */
  @Column({ type: 'simple-json', nullable: true })
  organicStrokes: OrganicFogStroke[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
