import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  group: string;

  @Column({ nullable: true })
  originalSource: string; // URL original si se subió por URL

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ default: false })
  isPublic: boolean; // visible a jugadores en campañas asociadas

  @Column({ type: 'blob' })
  data: Buffer; // audio binario

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { eager: true })
  owner: User;

  @ManyToMany(() => Campaign)
  @JoinTable({ name: 'song_campaign' })
  campaigns: Campaign[];
}
