import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryGeneratedColumn, Unique, OneToMany } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Entity()
@Unique(['username', 'email'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ default: 'es' })
  language: string;

  @Column({ default: 'light' })
  theme: string;

  /**
   * JSON-serialised sidebar preferences.
   * Schema: `{ items: { key: string; visible: boolean }[] }`
   * `null` means "use default sidebar".
   */
  @Column({ type: 'text', nullable: true, default: null })
  sidebarConfig: string | null;

  /**
   * JSON-serialised shortcuts shell preferences.
   * Schema: `{ showHomeSection, showSidebarPanel, showHotbar, sidebarPanelColumns }`
   */
  @Column({ type: 'text', nullable: true, default: null })
  shortcutsConfig: string | null;

  @OneToMany(() => Campaign, (campaign) => campaign.owner)
  ownedCampaigns: Campaign[]; // Renamed from 'campaigns' to match the relation
}
