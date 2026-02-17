import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { ShopSection } from './shop-section.entity';

/**
 * Shop entity - Represents a shop in a campaign.
 * Each shop can have multiple sections (tables) with custom columns.
 */
@Entity()
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index()
  @Column()
  campaignId: string;

  @ManyToOne(() => Campaign, { eager: false })
  campaign: Campaign;

  @ManyToOne(() => User, { eager: true })
  owner: User;

  @OneToMany(() => ShopSection, (section) => section.shop, { cascade: true })
  sections: ShopSection[];
}
