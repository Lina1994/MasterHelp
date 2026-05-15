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