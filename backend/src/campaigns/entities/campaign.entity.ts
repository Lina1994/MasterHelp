import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

import { CampaignPlayer } from './campaign-player.entity';

@Entity()
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @ManyToOne(() => User, user => user.campaigns, { eager: true })
  owner: User;

  @OneToMany(() => CampaignPlayer, campaignPlayer => campaignPlayer.campaign, { cascade: true })
  players: CampaignPlayer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
