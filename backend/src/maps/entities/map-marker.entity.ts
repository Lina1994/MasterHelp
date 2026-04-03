import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { MapEntity } from './map.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Represents the set of entity IDs associated to a world-map marker.
 * All arrays store UUIDs; resolving the display data is done client-side.
 */
export interface MarkerAssociated {
  mapIds?: string[];
  characterIds?: string[];
  enemyIds?: string[];
  encounterIds?: string[];
  diarySessionIds?: string[];
  /** UUIDs of DiaryEntry records (calendar entries). */
  diaryEntryIds?: string[];
  worldpediaIds?: string[];
}

/**
 * MapMarker
 *
 * A pin placed on a world-map image by the DM. Stores a position (percentage
 * of the image dimensions), display metadata (name, icon, notes) and optional
 * references to other campaign entities (maps, characters, enemies, encounters,
 * diary sessions, worldpedia notes).
 *
 * Cascade-deleted when the parent MapEntity or Campaign is deleted.
 */
@Entity()
export class MapMarker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The map this marker belongs to.
   */
  @ManyToOne(() => MapEntity, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'mapId' })
  map: MapEntity;

  @Column()
  @Index()
  mapId: string;

  /**
   * The campaign scope — markers are scoped to a campaign so multiple
   * campaigns can share the same map without sharing markers.
   */
  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  @Index()
  campaignId: string;

  /**
   * The user who owns this marker (matches the map owner).
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  @Index()
  ownerId: number;

  /** Display name for the marker. */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Emoji or short icon identifier displayed on the pin. Default: 📍 */
  @Column({ type: 'varchar', length: 50, default: '📍' })
  icon: string;

  /** Optional long-form notes for the DM (supports plain text). */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * Horizontal position as a percentage of the image width (0–100).
   * Stored as a floating-point number for sub-pixel accuracy.
   */
  @Column({ type: 'float' })
  x: number;

  /**
   * Vertical position as a percentage of the image height (0–100).
   * Stored as a floating-point number for sub-pixel accuracy.
   */
  @Column({ type: 'float' })
  y: number;

  /**
   * Whether this marker is visible in the player projection window.
   * Defaults to false — the DM must explicitly share each marker.
   */
  @Column({ type: 'boolean', default: false })
  visibleToPlayers: boolean;

  /**
   * JSON block of associated entity IDs.
   * Deliberately kept as IDs only — display data is resolved on the client.
   */
  @Column({ type: 'simple-json', nullable: true })
  associated: MarkerAssociated | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
