import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { SoundPreset } from './sound-preset.entity';
import { SoundEffect } from './sound-effect.entity';

export type LoopMode = 'continuous' | 'fixed' | 'random';

@Entity()
export class SoundPresetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SoundPreset, (p) => p.items, { onDelete: 'CASCADE' })
  preset: SoundPreset;

  @ManyToOne(() => SoundEffect, { eager: true })
  soundEffect: SoundEffect;

  @Column('float', { default: 1 })
  volume: number;

  @Column({ type: 'varchar' })
  loopMode: LoopMode;

  @Column('int', { nullable: true })
  waitMs: number | null; // for fixed

  @Column('int', { nullable: true })
  randomMinMs: number | null; // for random

  @Column('int', { nullable: true })
  randomMaxMs: number | null; // for random
}
