import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorldpediaFolder } from './worldpedia-folder.entity';
import { WorldpediaNoteLink } from './worldpedia-note-link.entity';

/**
 * A single Worldpedia note (article / lore entry) belonging to a campaign.
 *
 * A note can optionally belong to a {@link WorldpediaFolder}.  When `folderId`
 * is `null` the note lives at the root of the Worldpedia tree.
 */
@Entity()
@Index(['campaignId'])
@Index(['folderId'])
export class WorldpediaNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaignId: string;

  /** Owning folder – `null` means the note is at root level. */
  @Column({ type: 'uuid', nullable: true })
  folderId: string | null;

  @ManyToOne(() => WorldpediaFolder, (folder) => folder.notes, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  folder?: WorldpediaFolder | null;

  @Column({ type: 'text' })
  title: string;

  /** Rich-text content stored as sanitised HTML. */
  @Column({ type: 'text', nullable: true })
  html: string | null;

  /** Display order among sibling notes (lower = first). */
  @Column({ type: 'int', default: 0 })
  position: number;

  /** Outgoing links from this note. */
  @OneToMany(() => WorldpediaNoteLink, (link) => link.note)
  links?: WorldpediaNoteLink[];

  /** Incoming links that point to this note (backlinks). */
  @OneToMany(() => WorldpediaNoteLink, (link) => link.targetNote)
  backlinks?: WorldpediaNoteLink[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
