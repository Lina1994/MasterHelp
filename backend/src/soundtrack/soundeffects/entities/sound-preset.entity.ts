import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../../campaigns/entities/campaign.entity';
import { SoundPresetItem } from './sound-preset-item.entity';

@Entity()
export class SoundPreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Campaign, { eager: true })
  campaign: Campaign;

  @OneToMany(() => SoundPresetItem, (i) => i.preset, { cascade: true, eager: true })
  items: SoundPresetItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
