import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CampaignPlayer } from './campaign-player.entity';
import { MapEntity } from '../../maps/entities/map.entity';
import { Character } from '../../characters/entities/character.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity()
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string; // Can be a regular URL or a Base64 Data URL

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.ownedCampaigns, { eager: true })
  owner: User;

  @OneToMany(() => CampaignPlayer, (player) => player.campaign, { cascade: true, eager: true })
  players: CampaignPlayer[];


  /**
   * Map currently being presentado/activo for this campaign.
   * Allows the master to control what players/devices see across sessions.
   */
  @ManyToOne(() => MapEntity, { nullable: true, eager: true })
  activeMap?: MapEntity | null;

  /**
   * Character currently being presentado/activo in the skyline for this campaign.
   * Allows the master to control what character image is shown in the skyline window.
   */
  @ManyToOne(() => Character, { nullable: true, eager: true })
  activeSkylineCharacter?: Character | null;

  /**
   * Encounter currently active for this campaign.
   * Used to sync combat state across devices/windows.
   */
  @ManyToOne(() => Encounter, { nullable: true, eager: true })
  activeEncounter?: Encounter | null;

  /**
   * Current time-of-day for this campaign. Used to pick TOD-specific assets (maps/music).
   */
  @Column({ type: 'text', nullable: true })
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null;

  /**
   * Persisted grid overlay settings for cross-device projection (players) windows.
   * Stored as simple JSON in SQLite. Nullable to imply default (disabled).
   */
  @Column({ type: 'simple-json', nullable: true })
  gridOverlaySettings?: {
    enabled: boolean;
    type: 'square' | 'hex';
    cellSize: number;
    color: string;
    opacity: number; // 0..1
    lineWidth: number; // px
  } | null;

  /**
   * Skyline overlay settings for the projection window.
   * Currently supports toggling whether the current song title should be shown.
   * Stored as simple JSON in SQLite. Nullable implies default values.
   */
  @Column({ type: 'simple-json', nullable: true })
  skylineOverlaySettings?: {
    /** When true, show the currently playing song title at the top-left corner. */
    showSongTitle: boolean;
    /** When true, show the initiative strip (up to 10 participants) at bottom-left. */
    showInitiativeStrip: boolean;
  } | null;

  /**
   * Persisted battle state for current campaign to sync Skyline.
   * Stored as simple JSON in SQLite. Nullable implies no active battle.
   */
  @Column({ type: 'simple-json', nullable: true })
  battleState?: {
    started: boolean;
    encounterId?: string | null;
    round?: number;
    turnIndex?: number;
    currentTurnId?: string | null;
    items?: Array<{ id: string; name: string; imageUrl?: string | null }>;
  } | null;

  /**
   * Persisted Fog of War settings for cross-client consistency.
   *
   * NOTE: This is intentionally kept small (only what affects rendering logic)
   * so app (Electron) and web clients behave the same.
   */
  @Column({ type: 'simple-json', nullable: true })
  fogOfWarSettings?: {
    /** Ally clear radius (in grid cells) used to auto-clear fog around allied tokens. */
    allyClearRadius: number;
  } | null;

  /**
   * Soundtrack settings that control whether audio is applied automatically
   * (maps/encounters/combat) or only manually.
   */
  @Column({ type: 'simple-json', nullable: true })
  soundtrackSettings?: {
    mode: 'automatic' | 'manual';
  } | null;

  /**
   * Selected manuals to apply/scope content for this campaign.
   * Stored as simple JSON array of manual IDs from manuals registry.
   */
  @Column({ type: 'simple-json', nullable: true })
  selectedManualIds?: string[] | null;
}
