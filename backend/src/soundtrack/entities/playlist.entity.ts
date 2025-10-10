import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Song } from './song.entity';

@Entity()
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Campaign, { eager: true })
  campaign: Campaign;

  @ManyToMany(() => Song)
  @JoinTable({ name: 'playlist_song' })
  songs: Song[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
