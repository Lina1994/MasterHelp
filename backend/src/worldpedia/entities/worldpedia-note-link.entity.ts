import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorldpediaNote } from './worldpedia-note.entity';

/**
 * Represents a typed link inside a Worldpedia note.
 *
 * There are three link types:
 * - **url** – external hyperlink (opens a browser window).
 * - **note** – link to another Worldpedia note.
 * - **entity** – link to an app entity (character, map, monster, spell …).
 */
@Entity()
@Index(['noteId'])
@Index(['targetNoteId'])
export class WorldpediaNoteLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The note that contains this link (source). */
  @Column({ type: 'uuid' })
  noteId: string;

  @ManyToOne(() => WorldpediaNote, (note) => note.links, { onDelete: 'CASCADE' })
  note: WorldpediaNote;

  @Column({ type: 'text' })
  type: 'url' | 'note' | 'entity';

  /** Human-readable label displayed in the link. */
  @Column({ type: 'text', nullable: true })
  label: string | null;

  // ── URL links ──────────────────────────────────────────────────────

  /** External URL (only used when type = 'url'). */
  @Column({ type: 'text', nullable: true })
  targetUrl: string | null;

  // ── Note links ─────────────────────────────────────────────────────

  /** Target note id (only used when type = 'note'). */
  @Column({ type: 'uuid', nullable: true })
  targetNoteId: string | null;

  @ManyToOne(() => WorldpediaNote, (note) => note.backlinks, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  targetNote?: WorldpediaNote | null;

  // ── Entity links ───────────────────────────────────────────────────

  /**
   * Type of the referenced app entity.
   *
   * Accepted values: `character`, `map`, `monster`, `spell`.
   * Only used when type = 'entity'.
   */
  @Column({ type: 'text', nullable: true })
  targetEntityType: string | null;

  /** UUID (or numeric id serialised as string) of the referenced entity. */
  @Column({ type: 'text', nullable: true })
  targetEntityId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
