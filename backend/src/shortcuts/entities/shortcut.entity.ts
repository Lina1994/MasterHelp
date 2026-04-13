import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface ShortcutActionDefinition {
  kind: 'toggleState' | 'playSoundEffect';
  config: Record<string, unknown>;
}

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
}