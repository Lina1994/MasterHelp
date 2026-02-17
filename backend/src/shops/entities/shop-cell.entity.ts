import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { ShopEntry } from './shop-entry.entity';
import { ShopColumn } from './shop-column.entity';

/**
 * ShopCell entity - Represents a cell value in an entry.
 * Can store text or binary media (image, video, audio, gif).
 */
@Entity()
export class ShopCell {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  textValue: string | null;

  @Column({ type: 'blob', nullable: true, select: false })
  blobData: Buffer | null;

  @Column({ nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ nullable: true })
  originalUrl: string | null;

  @Index()
  @Column()
  entryId: string;

  @Index()
  @Column()
  columnId: string;

  @ManyToOne(() => ShopEntry, (entry) => entry.cells, { onDelete: 'CASCADE' })
  entry: ShopEntry;

  @ManyToOne(() => ShopColumn, { eager: true })
  column: ShopColumn;
}
