import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { MapEntity } from './map.entity';

/**
 * Time-of-day intensity multiplier (0–1) for lights and windows.
 */
export interface TimeOfDayIntensity {
  dawn: number;
  morning: number;
  afternoon: number;
  night: number;
}

/**
 * Wall element — a polyline that blocks light / fog revealing.
 * Points normalised 0–1 relative to the map's natural dimensions.
 */
export interface MapWallElement {
  id: string;
  type: 'wall';
  points: { x: number; y: number }[];
}

/**
 * Door element — a two-point segment that blocks light when closed.
 * Points normalised 0–1 relative to the map's natural dimensions.
 */
export interface MapDoorElement {
  id: string;
  type: 'door';
  points: [{ x: number; y: number }, { x: number; y: number }];
  isOpen: boolean;
  showInPreview?: boolean;
}

/**
 * Window element — a two-point segment that lets light through
 * based on time of day. Points normalised 0–1.
 */
export interface MapWindowElement {
  id: string;
  type: 'window';
  points: [{ x: number; y: number }, { x: number; y: number }];
  lightByTimeOfDay: TimeOfDayIntensity;
  showInPreview?: boolean;
}

/**
 * Light source element — a positioned light that reveals fog in a radius.
 * Position normalised 0–1.
 */
export interface MapLightElement {
  id: string;
  type: 'light';
  position: { x: number; y: number };
  radius: number;
  color?: string;
  isOn: boolean;
  showInPreview: boolean;
  label?: string;
  intensityByTimeOfDay?: TimeOfDayIntensity;
}

/**
 * Discriminated union covering all map element types.
 */
export type MapElement = MapWallElement | MapDoorElement | MapWindowElement | MapLightElement;

/**
 * MapElementsState
 * Persists structural elements (walls, doors, windows, lights) for a specific
 * map within a specific campaign, owned by a user.
 * Uniqueness is enforced on the tuple (ownerId, campaignId, mapId).
 */
@Entity()
@Index(['owner', 'campaign', 'map'], { unique: true })
export class MapElementsState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner of the elements state (DM). */
  @ManyToOne(() => User, { eager: true })
  owner: User;

  /** Campaign associated with this elements state. */
  @ManyToOne(() => Campaign, { eager: true, onDelete: 'CASCADE' })
  campaign: Campaign;

  /** Map associated with this elements state. */
  @ManyToOne(() => MapEntity, { eager: true, onDelete: 'CASCADE' })
  map: MapEntity;

  /**
   * Stored as a JSON array of MapElement objects.
   * Each element has a discriminant `type` field.
   */
  @Column({ type: 'simple-json', nullable: true })
  elements: MapElement[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
