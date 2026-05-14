import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { SHORTCUT_SCHEMA_VERSION, type ShortcutActionDefinition, type ShortcutScope } from '../actionTypes';

/**
 * Persistent shortcut definition owned by a single user.
 */
@Entity()
export class Shortcut {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  hotkey: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  normalizedHotkey: string | null;

  @Column({ type: 'text', default: 'global' })
  scope: ShortcutScope;

  @Column({ type: 'integer', default: SHORTCUT_SCHEMA_VERSION })
  schemaVersion: number;

  @Column({ type: 'text', default: 'button' })
  mode: 'button' | 'toggle' | 'temporary';

  @Column({ type: 'integer', nullable: true, default: null })
  temporaryDurationMs: number | null;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true, default: null })
  activeUntil: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  activeColor: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  inactiveColor: string | null;

  @Column({ default: true })
  showOnHome: boolean;

  @Column({ default: false })
  showInSidebarPanel: boolean;

  @Column({ default: false })
  showInHotbar: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'integer', default: 0 })
  sidebarPanelOrder: number;

  @Column({ type: 'integer', default: 0 })
  hotbarOrder: number;

  @Column({ type: 'simple-json', default: '[]' })
  actions: ShortcutActionDefinition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner: User;

  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'CASCADE', eager: false })
  campaign: Campaign | null;
}