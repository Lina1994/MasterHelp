import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { MapEntity } from './map.entity';

export type MapSkylineVariant = 'thumb' | 'preview' | 'full';

@Entity()
export class MapSkylineImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  variant: MapSkylineVariant; // 'thumb' | 'preview' | 'full'

  /** Optional time-of-day tag for this skyline image (per-variant). */
  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night' | null;

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ type: 'blob' })
  data: Buffer;

  @ManyToOne(() => MapEntity, (map) => map.skylines, { onDelete: 'CASCADE' })
  map: MapEntity;
}
