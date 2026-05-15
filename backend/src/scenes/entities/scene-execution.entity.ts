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
  type SceneExecutionStatus,
  type SceneExecutionSummary,
  type SceneRuntimeCommand,
  type SceneTriggerSource,
} from '../actionTypes';
import { Scene } from './scene.entity';

/**
 * Persistent execution state and history for a scene run.
 */
@Entity()
export class SceneExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Scene, { nullable: false, onDelete: 'CASCADE', eager: true })
  scene: Scene;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE', eager: false })
  owner: User;

  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'SET NULL', eager: false })
  campaign: Campaign | null;

  @Column({ type: 'text', default: 'queued' })
  status: SceneExecutionStatus;

  @Column({ type: 'datetime', nullable: true, default: null })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  finishedAt: Date | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  failedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  currentActionIndex: number;

  @Column({ type: 'integer', default: 0 })
  totalActions: number;

  @Column({ type: 'text', nullable: true, default: null })
  error: string | null;

  @Column({ type: 'text', default: 'manual' })
  triggerSource: SceneTriggerSource;

  @Column({ type: 'text', nullable: true, default: null })
  triggerShortcutId: string | null;

  @ManyToOne(() => SceneExecution, { nullable: true, onDelete: 'SET NULL', eager: false })
  parentExecution: SceneExecution | null;

  @Column({ type: 'simple-json', default: '[]' })
  executionPath: string[];

  @Column({ type: 'simple-json', default: '[]' })
  emittedCommands: SceneRuntimeCommand[];

  @Column({ type: 'simple-json', default: '{"totalActions":0,"completedActions":0,"emittedCommands":0,"nestedScenes":0,"nestedShortcuts":0,"totalDelayMs":0}' })
  summary: SceneExecutionSummary;

  @Column({ default: false })
  cancellationRequested: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}