import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCharacterDto {
  /** Campaign ID to attach this character to. */
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  /** Optional owner player userId for PCs; omit for NPCs. */
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' || value === undefined ? undefined : Number(value)))
  @IsNumber()
  ownerPlayerId?: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['pc', 'npc'])
  kind!: 'pc' | 'npc';

  @IsOptional() @IsString() className?: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) level?: number = 1;
  @IsOptional() @IsString() background?: string;
  @IsOptional() @IsString() race?: string;
  @IsOptional() @IsString() alignment?: string;
  @IsOptional() @IsString() playerName?: string;

  @IsOptional() @IsInt() str?: number;
  @IsOptional() @IsInt() dex?: number;
  @IsOptional() @IsInt() con?: number;
  @IsOptional() @IsInt() int?: number;
  @IsOptional() @IsInt() wis?: number;
  @IsOptional() @IsInt() cha?: number;

  @IsOptional() @IsInt() proficiencyBonus?: number;
  @IsOptional() @IsInt() armorClass?: number;
  @IsOptional() @IsInt() initiative?: number;
  @IsOptional() @IsString() speed?: string;
  @IsOptional() @IsInt() maxHp?: number;
  @IsOptional() @IsInt() currentHp?: number;
  @IsOptional() @IsInt() tempHp?: number;
  @IsOptional() @IsString() hitDice?: string;

  @IsOptional() @IsString() otherProficienciesAndLanguages?: string;
  @IsOptional() @IsString() equipment?: string;
  @IsOptional() @IsString() traitsAndFeatures?: string;

  @IsOptional() @IsString() age?: string;
  @IsOptional() @IsString() height?: string;
  @IsOptional() @IsString() weight?: string;
  @IsOptional() @IsString() eyes?: string;
  @IsOptional() @IsString() skin?: string;
  @IsOptional() @IsString() hair?: string;

  @IsOptional() @IsIn(['color','image']) tokenKind?: 'color'|'image';
  @IsOptional() @IsString() tokenColor?: string;
  @IsOptional() @IsString() tokenImageUrl?: string;
  @IsOptional() @IsString() characterImageUrl?: string;

  @IsOptional() @IsIn(['int','wis','cha']) spellcastingAbility?: 'int'|'wis'|'cha';
  @IsOptional() @IsInt() spellSaveDC?: number;
  @IsOptional() @IsInt() spellAttackBonus?: number;
  @IsOptional() @IsArray() @Transform(({ value }) => Array.isArray(value) ? value.map(String) : []) cantrips?: string[];
  @IsOptional() @IsObject() spellsByLevel?: { [level: string]: string[] };

  @IsOptional() @IsString() alliesAndOrganizations?: string;
  @IsOptional() @IsString() backstory?: string;
  @IsOptional() @IsString() treasure?: string;

  @IsOptional() @IsBoolean() visibleToPlayers?: boolean;
}
