import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorldpediaNote } from './worldpedia-note.entity';

/**
 * A folder used to organise Worldpedia notes within a campaign.
 *
 * Folders live at the root level (no nested folders) and hold an ordered
 * collection of notes.  Notes may also exist outside any folder.
 */
@Entity()
@Index(['campaignId'])
export class WorldpediaFolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'text' })
  name: string;

  /** Display order among sibling folders (lower = first). */
  @Column({ type: 'int', default: 0 })
  position: number;

  @OneToMany(() => WorldpediaNote, (note) => note.folder)
  notes?: WorldpediaNote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
