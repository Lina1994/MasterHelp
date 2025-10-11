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

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ type: 'blob' })
  data: Buffer;

  @ManyToOne(() => MapEntity, (map) => map.images, { onDelete: 'CASCADE' })
  map: MapEntity;
}
