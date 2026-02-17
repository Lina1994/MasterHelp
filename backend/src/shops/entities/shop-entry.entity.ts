import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { ShopSection } from './shop-section.entity';
import { ShopCell } from './shop-cell.entity';

/**
 * ShopEntry entity - Represents a row/entry in a section.
 * Each entry contains multiple cells (one per column).
 */
@Entity()
export class ShopEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Index()
  @Column()
  sectionId: string;

  @ManyToOne(() => ShopSection, (section) => section.entries, { onDelete: 'CASCADE' })
  section: ShopSection;

  @OneToMany(() => ShopCell, (cell) => cell.entry, { cascade: true })
  cells: ShopCell[];
}
