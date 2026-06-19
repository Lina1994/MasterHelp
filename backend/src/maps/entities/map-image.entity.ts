import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { MapEntity } from './map.entity';

export type MapImageVariant = 'thumb' | 'preview' | 'full';

@Entity()
export class MapImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  variant: MapImageVariant; // 'thumb' | 'preview' | 'full'

  /** Optional time-of-day tag for this image (per-variant). */
  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null;

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ type: 'blob', nullable: true })
  data: Buffer | null;

  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  storageKind?: 'db' | 'fs' | null;

  @Column({ type: 'text', nullable: true })
  relativePath?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName?: string | null;

  @Column({ type: 'datetime', nullable: true })
  migratedAt?: Date | null;

  @Index()
  @ManyToOne(() => MapEntity, (map) => map.images, { onDelete: 'CASCADE' })
  map: MapEntity;
}
