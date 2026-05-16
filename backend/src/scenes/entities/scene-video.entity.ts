import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Persistent metadata for uploaded scene video assets.
 * The file binary is stored on disk and referenced via relativePath.
 */
@Entity()
export class SceneVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'text' })
  originalFilename: string;

  @Column({ type: 'text' })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'text' })
  checksumSha256: string;

  @Column({ type: 'text' })
  relativePath: string;

  @Column({ type: 'integer', nullable: true, default: null })
  durationMs: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  width: number | null;

  @Column({ type: 'integer', nullable: true, default: null })
  height: number | null;

  @Column({ type: 'text', default: 'ready' })
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';

  @Column({ type: 'text', nullable: true, default: null })
  processingError: string | null;

  @Column({ type: 'text', default: 'original' })
  derivationType: 'original' | 'clip';

  @ManyToOne(() => SceneVideo, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'parentVideoId' })
  parentVideo: SceneVideo | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  parentVideoId: string | null;

  @Column({ type: 'real', nullable: true, default: null })
  sourceStartSec: number | null;

  @Column({ type: 'real', nullable: true, default: null })
  sourceEndSec: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  owner: User;

  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'CASCADE', eager: false })
  campaign: Campaign | null;
}
