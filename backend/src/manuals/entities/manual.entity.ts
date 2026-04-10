import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ManualEntry } from './manual-entry.entity';

/**
 * User-created custom manual stored in the database.
 *
 * File-based manuals (dnd5e-2014, dnd5e-2024) remain read-only on disk;
 * this entity covers only user-authored manuals.
 */
@Entity()
export class Manual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Display title of the manual (e.g. "My Homebrew Compendium"). */
  @Column({ type: 'text' })
  title: string;

  /** Optional description / flavour text. */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Optional version string (e.g. "1.0"). */
  @Column({ type: 'text', nullable: true })
  version?: string | null;

  /**
   * ISO 639-1 codes of the languages this manual has content for.
   * Stored as JSON array, e.g. ["en","es"].
   */
  @Column({ type: 'simple-json', nullable: true })
  languages?: string[] | null;

  /** ID of the user who created the manual. */
  @Column({ type: 'integer' })
  createdByUserId: number;

  /** Optional cover image stored as a binary blob. Excluded from default queries. */
  @Column({ type: 'blob', nullable: true, select: false })
  coverImageData?: Buffer | null;

  /** MIME type of the cover image (e.g. "image/png"). */
  @Column({ type: 'text', nullable: true })
  coverImageMimeType?: string | null;

  /** Free-form "About" text (Markdown) shown in the manual viewer. */
  @Column({ type: 'text', nullable: true })
  about?: string | null;

  @OneToMany(() => ManualEntry, (entry) => entry.manual, { cascade: true })
  entries: ManualEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
