import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../../campaigns/entities/campaign.entity';
import { User } from '../../../users/entities/user.entity';

@Entity()
export class SoundEffect {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string | null;

  @Column({ default: false })
  isPublic: boolean;

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ type: 'blob', select: false })
  data: Buffer;

  @Column({ type: 'datetime', nullable: true })
  lastPlayedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { eager: true })
  owner: User;

  @ManyToMany(() => Campaign)
  @JoinTable({ name: 'sound_effect_campaign' })
  campaigns: Campaign[];
}
