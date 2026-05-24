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
import {
  SCENE_SCHEMA_VERSION,
  type SceneActionDefinition,
  type SceneScope,
} from '../actionTypes';

/**
 * Persistent user-owned scene definition.
 */
@Entity()
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ default: false })
  loop: boolean;

  @Column({ type: 'integer', nullable: true, default: null })
  loopDelayMs: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  loopDelayRandomMinMs: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  loopDelayRandomMaxMs: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  loopWindowStartMs: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  loopWindowEndMs: number | null;

  @Column({ default: false })
  takeOverMusicOnStart: boolean;

  @Column({ default: true })
  restorePreviousMusicOnFinish: boolean;

  @Column({ type: 'text', nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  imageUrl: string | null;

  @Column({ type: 'text', default: 'global' })
  scope: SceneScope;

  @Column({ type: 'integer', default: SCENE_SCHEMA_VERSION })
  schemaVersion: number;

  @Column({ type: 'simple-json', default: '[]' })
  actions: SceneActionDefinition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner: User;

  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'CASCADE', eager: false })
  campaign: Campaign | null;
}