import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { ShopSection } from './shop-section.entity';

export type CellType = 'text' | 'image' | 'video' | 'audio' | 'gif';

/**
 * ShopColumn entity - Defines a column in a section.
 * Each column has a name, type, and order.
 */
@Entity()
export class ShopColumn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'varchar', length: 20 })
  cellType: CellType;

  @Index()
  @Column()
  sectionId: string;

  @ManyToOne(() => ShopSection, (section) => section.columns, { onDelete: 'CASCADE' })
  section: ShopSection;
}
