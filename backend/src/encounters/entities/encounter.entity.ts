import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

export type EncounterDifficulty = 'Fácil' | 'Medio' | 'Difícil' | 'Mortal';

export interface EncounterParticipant {
  id: string;
  name: string;
  kind: 'character' | 'enemy';
  role?: 'ally' | 'foe';
  level?: number;
  cr?: number;
  maxHp?: number;
  currentHp?: number;
}

@Entity()
export class Encounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  musicLabel: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  musicSongId: string | null;

  @Column({ type: 'varchar', length: 16 })
  difficulty: EncounterDifficulty;

  @Column({ type: 'simple-json', nullable: true })
  participants: EncounterParticipant[] | null;

  @ManyToOne(() => Campaign, (campaign) => campaign.id, { onDelete: 'CASCADE' })
  campaign: Campaign;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
