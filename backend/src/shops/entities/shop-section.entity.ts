import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Shop } from './shop.entity';
import { ShopColumn } from './shop-column.entity';
import { ShopEntry } from './shop-entry.entity';

/**
 * ShopSection entity - Represents a section (table) within a shop.
 * Each section has custom columns and entries (rows).
 */
@Entity()
export class ShopSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Index()
  @Column()
  shopId: string;

  @ManyToOne(() => Shop, (shop) => shop.sections, { onDelete: 'CASCADE' })
  shop: Shop;

  @OneToMany(() => ShopColumn, (column) => column.section, { cascade: true })
  columns: ShopColumn[];

  @OneToMany(() => ShopEntry, (entry) => entry.section, { cascade: true })
  entries: ShopEntry[];
}
