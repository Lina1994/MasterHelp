import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from './campaign.entity';

@Entity()
export class CampaignPlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.id)
  campaign: Campaign;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @Column({ default: 'player' })
  role: 'player' | 'master';

  @Column({ default: 'active' })
  status: 'active' | 'invited' | 'declined';
}
