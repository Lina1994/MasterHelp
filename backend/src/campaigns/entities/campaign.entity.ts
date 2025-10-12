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
   * Map currently being presented/activo for this campaign.
   * Allows the master to control what players/devices see across sessions.
   */
  @ManyToOne(() => MapEntity, { nullable: true, eager: true })
  activeMap?: MapEntity | null;

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
   * Selected manuals to apply/scope content for this campaign.
   * Stored as simple JSON array of manual IDs from manuals registry.
   */
  @Column({ type: 'simple-json', nullable: true })
  selectedManualIds?: string[] | null;
}
