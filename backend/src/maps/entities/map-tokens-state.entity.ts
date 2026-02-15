import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MapEntity } from './map.entity';

export type MapTokenItem = {
  id: string;
  cellKey: string; // e.g., "col:row"
  type: 'ally' | 'enemy';
  label?: string | null;
  color?: string | null;
  /** Visual facing direction in degrees (0..360). */
  rotationDeg?: number | null;
  /** Size of the token (default: medium). */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan' | null;
  /** Orientation for hex grids (0-5 for Large/Gargantuan tokens). */
  orientation?: number | null;
};

/**
 * MapTokensState
 * Persists token items for a specific map within a specific campaign, scoped to owner (DM).
 * Uniqueness is enforced on (owner, campaign, map).
 */
@Entity()
@Index(['owner', 'campaign', 'map'], { unique: true })
export class MapTokensState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner (DM) controlling tokens */
  @ManyToOne(() => User, { eager: true })
  owner: User;

  /** Campaign associated */
  @ManyToOne(() => Campaign, { eager: true, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Map associated */
  @ManyToOne(() => MapEntity, { eager: true, onDelete: 'CASCADE' })
  map: MapEntity;

  /** Tokens payload stored as simple-json for SQLite portability. */
  @Column({ type: 'simple-json' })
  tokens: MapTokenItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
