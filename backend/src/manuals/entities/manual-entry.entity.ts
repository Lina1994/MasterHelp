import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Manual } from './manual.entity';

/**
 * Allowed element types that a manual can contain.
 */
export type ManualEntryType =
  | 'monster'
  | 'spell'
  | 'class'
  | 'race'
  | 'background'
  | 'feat'
  | 'trait'
  | 'skill'
  | 'section';

/**
 * A single content entry inside a user-created manual.
 *
 * Each entry is uniquely identified within its manual by the combination
 * of (entryType, entryKey, lang).  The `data` column stores the full
 * JSON payload whose schema depends on `entryType` (same structure used
 * by the file-based manuals).
 */
@Entity()
@Unique(['manual', 'entryType', 'entryKey', 'lang'])
export class ManualEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Manual, (manual) => manual.entries, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  manual: Manual;

  /** Convenience column for the FK value. */
  @Column({ type: 'text' })
  manualId: string;

  /** Element category (monster, spell, class, …). */
  @Column({ type: 'text' })
  entryType: ManualEntryType;

  /** Slug-like key that identifies the element within its type (e.g. 'fireball', 'orc'). */
  @Column({ type: 'text' })
  entryKey: string;

  /** ISO 639-1 language code (e.g. 'en', 'es'). */
  @Column({ type: 'text' })
  lang: string;

  /**
   * Full JSON payload for this entry.  Schema depends on `entryType`:
   * - monster  → MonsterDetail
   * - spell    → SpellDetail
   * - class    → ClassDetail
   * - race     → RaceDetail
   * - etc.
   */
  @Column({ type: 'simple-json' })
  data: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
