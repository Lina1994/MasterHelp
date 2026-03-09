import { api } from '../../apiBase';
import type { User } from '../../types';

export interface CharacterPayload {
  id?: string;
  campaignId: string;
  ownerPlayerId?: number | null;
  ownerPlayer?: User | null;
  name: string;
  kind: 'pc' | 'npc';
  className?: string;
  level?: number;
  background?: string;
  race?: string;
  alignment?: string;
  playerName?: string;
  str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number;
  proficiencyBonus?: number;
  armorClass?: number; initiative?: number; speed?: string;
  maxHp?: number; currentHp?: number; tempHp?: number; hitDice?: string;
  otherProficienciesAndLanguages?: string; equipment?: string; traitsAndFeatures?: string;
  age?: string; height?: string; weight?: string; eyes?: string; skin?: string; hair?: string;
  tokenKind?: 'color'|'image'; tokenColor?: string; tokenImageUrl?: string; characterImageUrl?: string;
  spellcastingAbility?: 'int'|'wis'|'cha' | null; spellSaveDC?: number | null; spellAttackBonus?: number | null; cantrips?: string[]; spellsByLevel?: Record<string,string[]>;
  experiencePoints?: number;
  cp?: number; sp?: number; ep?: number; gp?: number; pp?: number;
  alliesAndOrganizations?: string; backstory?: string; treasure?: string;
  attacks?: { name: string; bonus: string; damage: string }[] | null;
  attacksNotes?: string | null;
  savingThrowProficiencies?: Record<string, boolean> | null;
  skillProficiencies?: Record<string, boolean> | null;
  visibleToPlayers?: boolean;
  associatedMapIds?: string[];
}

export async function listCharacters(campaignId: string, mapId?: string) {
  const params: Record<string, string> = { campaignId };
  if (mapId) params.mapId = mapId;
  const res = await api.get('/characters', { params });
  return res.data as CharacterPayload[];
}

export async function createCharacter(payload: CharacterPayload) {
  console.debug('[characters] POST /characters payload:', payload);
  const res = await api.post('/characters', payload).catch((err) => {
    console.error('[characters] createCharacter error:', err?.response?.data || err.message);
    throw err;
  });
  return res.data as CharacterPayload;
}

export async function updateCharacter(id: string, patch: Partial<CharacterPayload>) {
  console.debug('[characters] PATCH /characters/'+id+' patch:', patch);
  const res = await api.patch(`/characters/${id}`, patch).catch((err) => {
    console.error('[characters] updateCharacter error:', err?.response?.data || err.message);
    throw err;
  });
  return res.data as CharacterPayload;
}

export async function deleteCharacter(id: string) {
  await api.delete(`/characters/${id}`);
}

export async function getCharacter(id: string) {
  const res = await api.get(`/characters/${id}`);
  return res.data as CharacterPayload;
}
