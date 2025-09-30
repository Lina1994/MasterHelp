import { Exclude } from 'class-transformer'; // 1. Importar Exclude
import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Campaign } from '../../campaigns/entities/campaign.entity';
import { OneToMany } from 'typeorm';

@Entity()
@Unique(['username', 'email'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Exclude() // 2. Añadir decorador para excluir este campo
  @Column()
  password: string;

  @Column({ default: 'es' })
  language: string;

  @Column({ default: 'light' })
  theme: string;

  @OneToMany(() => Campaign, campaign => campaign.owner)
  campaigns: Campaign[];
}