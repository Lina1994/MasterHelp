import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

export type CharacterVisibility = 'private' | 'players';

@Entity()
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign)
  campaign: Campaign;

  /** Owner player for PC; null for NPCs created by the master. */
  @ManyToOne(() => User, { nullable: true, eager: true })
  ownerPlayer?: User | null;

  /** Master/creator for editing authority; also campaign.owner may act. */
  @ManyToOne(() => User, { eager: true })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // --- Core identity ---
  @Column()
  name: string;

  /** 'pc' = playable character; 'npc' = non-player character. */
  @Column({ type: 'text', default: 'pc' })
  kind: 'pc' | 'npc';

  @Column({ type: 'text', nullable: true })
  className?: string | null;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'text', nullable: true })
  background?: string | null;

  @Column({ type: 'text', nullable: true })
  race?: string | null;

  @Column({ type: 'text', nullable: true })
  alignment?: string | null;

  @Column({ type: 'text', nullable: true })
  playerName?: string | null;

  // --- Abilities ---
  @Column({ type: 'int', default: 10 })
  str: number;
  @Column({ type: 'int', default: 10 })
  dex: number;
  @Column({ type: 'int', default: 10 })
  con: number;
  @Column({ type: 'int', default: 10 })
  int: number;
  @Column({ type: 'int', default: 10 })
  wis: number;
  @Column({ type: 'int', default: 10 })
  cha: number;

  // --- Combat stats ---
  @Column({ type: 'int', default: 2 })
  proficiencyBonus: number; // e.g., +2 at low levels

  @Column({ type: 'int', default: 10 })
  armorClass: number;
  
  @Column({ type: 'int', default: 0 })
  initiative: number; // modifier

  @Column({ type: 'text', default: '30 ft' })
  speed: string; // allow text like "30 ft" to support race/armor modifiers

  @Column({ type: 'int', default: 8 })
  maxHp: number;
  @Column({ type: 'int', default: 8 })
  currentHp: number;
  @Column({ type: 'int', default: 0 })
  tempHp: number;

  @Column({ type: 'text', default: '1d8' })
  hitDice: string;

  // --- Notes & proficiencies ---
  @Column({ type: 'text', nullable: true })
  otherProficienciesAndLanguages?: string | null;
  @Column({ type: 'text', nullable: true })
  equipment?: string | null;
  @Column({ type: 'text', nullable: true })
  traitsAndFeatures?: string | null;

  // --- Description ---
  @Column({ type: 'text', nullable: true })
  age?: string | null;
  @Column({ type: 'text', nullable: true })
  height?: string | null;
  @Column({ type: 'text', nullable: true })
  weight?: string | null;
  @Column({ type: 'text', nullable: true })
  eyes?: string | null;
  @Column({ type: 'text', nullable: true })
  skin?: string | null;
  @Column({ type: 'text', nullable: true })
  hair?: string | null;

  // --- Token & Image ---
  @Column({ type: 'text', nullable: true })
  tokenKind?: 'color' | 'image' | null;
  @Column({ type: 'text', nullable: true })
  tokenColor?: string | null; // hex
  @Column({ type: 'text', nullable: true })
  tokenImageUrl?: string | null; // stored as URL or data URI
  @Column({ type: 'text', nullable: true })
  characterImageUrl?: string | null;

  // --- Spellcasting ---
  @Column({ type: 'text', nullable: true })
  spellcastingAbility?: 'int' | 'wis' | 'cha' | null; // Aptitud Mágica
  @Column({ type: 'int', nullable: true })
  spellSaveDC?: number | null; // CD Tirada de Salvación de Conjuros
  @Column({ type: 'int', nullable: true })
  spellAttackBonus?: number | null; // Bonificador de Ataque de Conjuro
  @Column({ type: 'simple-json', nullable: true })
  cantrips?: string[] | null;
  @Column({ type: 'simple-json', nullable: true })
  spellsByLevel?: { [level: string]: string[] } | null; // e.g., { '1': ['Magic Missile'], '2': [...] }

  // --- Experience ---
  /** Total experience points accumulated. */
  @Column({ type: 'int', default: 0 })
  experiencePoints: number;

  // --- Currency (D&D standard denominations) ---
  /** Copper pieces. */
  @Column({ type: 'int', default: 0 })
  cp: number;
  /** Silver pieces. */
  @Column({ type: 'int', default: 0 })
  sp: number;
  /** Electrum pieces. */
  @Column({ type: 'int', default: 0 })
  ep: number;
  /** Gold pieces. */
  @Column({ type: 'int', default: 0 })
  gp: number;
  /** Platinum pieces. */
  @Column({ type: 'int', default: 0 })
  pp: number;

  // --- Social & story ---
  @Column({ type: 'text', nullable: true })
  alliesAndOrganizations?: string | null;
  @Column({ type: 'text', nullable: true })
  backstory?: string | null;
  @Column({ type: 'text', nullable: true })
  treasure?: string | null;

  // --- Attacks & Spellcasting ---
  /** JSON array of attack entries: each with name, bonus, and damage/type. */
  @Column({ type: 'simple-json', nullable: true })
  attacks?: { name: string; bonus: string; damage: string }[] | null;

  /** Free-text notes shown below the attacks table. */
  @Column({ type: 'text', nullable: true })
  attacksNotes?: string | null;

  // --- Saving throw proficiencies ---
  /** JSON map of saving throw proficiency flags. Keys: str, dex, con, int, wis, cha. */
  @Column({ type: 'simple-json', nullable: true })
  savingThrowProficiencies?: Record<string, boolean> | null;

  // --- Skill proficiencies ---
  /** JSON map of skill proficiency flags. Keys match D&D 5e skill names in camelCase. */
  @Column({ type: 'simple-json', nullable: true })
  skillProficiencies?: Record<string, boolean> | null;

  // --- Visibility ---
  /** visible to players when true; master always sees all. */
  @Column({ type: 'boolean', default: false })
  visibleToPlayers: boolean;
}
