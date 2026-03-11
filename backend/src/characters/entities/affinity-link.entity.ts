import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Character } from './character.entity';

/**
 * Represents a relationship link between two characters in the affinity chart.
 * Each link connects `characterA` and `characterB` with a label describing
 * their relationship.
 */
@Entity()
export class AffinityLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: false })
  campaign: Campaign;

  @ManyToOne(() => Character, { onDelete: 'CASCADE', nullable: false, eager: true })
  characterA: Character;

  @ManyToOne(() => Character, { onDelete: 'CASCADE', nullable: false, eager: true })
  characterB: Character;

  /** Describes the relationship from A's perspective towards B (e.g. "es hijo de"). */
  @Column({ type: 'varchar', length: 255, default: '' })
  labelAtoB: string;

  /** Describes the relationship from B's perspective towards A (e.g. "es madre de"). */
  @Column({ type: 'varchar', length: 255, default: '' })
  labelBtoA: string;

  /**
   * Sentiment level on a scale from -3 to 3.
   * -3 = hatred, -2 = grudge, -1 = distrust, 0 = indifference,
   *  1 = respect,  2 = admiration, 3 = love.
   */
  @Column({ type: 'integer', default: 0 })
  sentiment: number;

  /** Hex colour used to render the connecting line (e.g. "#4caf50"). */
  @Column({ type: 'varchar', length: 20, default: '#90caf9' })
  color: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
