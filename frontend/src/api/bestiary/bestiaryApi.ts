import { api } from '../../apiBase';

export interface CampaignMonsterListItem {
  id: string;
  name: string;
  type: string;
  size: string;
  alignment?: string;
  challengeRating?: string;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  tokenKind?: 'color' | 'image' | null;
  tokenColor?: string | null;
  tokenImageUrl?: string | null;
  imageUrls?: {
    low?: string;
    medium?: string;
    high?: string;
  } | null;
  isCustom: boolean;
}

export interface CampaignMonsterDetail extends CampaignMonsterListItem {
  subtype?: string;
  challengeRating?: string;
  experiencePoints?: number;
  armorClass?: { value: number; type?: string; notes?: string };
  hitPoints?: { average: number; roll?: string };
  speed?: Record<string, number>;
  abilities?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  damageVulnerabilities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: Record<string, any>;
  languages?: string;
  traits?: Array<{ name?: string; text: string }>;
  actions?: Array<{ name?: string; text: string }>;
  reactions?: Array<{ name?: string; text: string }>;
  legendaryActions?: Array<{ name?: string; text: string }>;
  description?: string;
}

export interface ListCampaignMonstersParams {
  q?: string;
  type?: string;
  size?: string;
  alignment?: string;
  origin?: string;
  cr?: string; // comma-separated CR values
  sort?: 'name' | 'name_desc' | 'type' | 'type_desc' | 'size' | 'size_desc' | 'cr' | 'cr_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignMonsterDto {
  sourceManualId?: string;
  sourceSlug?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
  tokenKind?: 'color' | 'image';
  tokenColor?: string;
  tokenImageUrl?: string;
  imageUrls?: {
    low?: string;
    medium?: string;
    high?: string;
  };
}

export async function listCampaignMonsters(
  campaignId: string,
  params: ListCampaignMonstersParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/bestiary`, {
    params: { ...params, lang },
  });
  return res.data;
}

export async function getCampaignMonster(
  campaignId: string,
  monsterId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignMonsterDetail> {
  const res = await api.get(`/campaigns/${campaignId}/bestiary/${monsterId}`, {
    params: { lang },
  });
  return res.data;
}

export async function createCampaignMonster(
  campaignId: string,
  data: CreateCampaignMonsterDto,
): Promise<CampaignMonsterDetail> {
  const res = await api.post(`/campaigns/${campaignId}/bestiary`, data);
  return res.data;
}

export async function updateCampaignMonster(
  campaignId: string,
  monsterId: string,
  data: Partial<CreateCampaignMonsterDto>,
): Promise<CampaignMonsterDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/bestiary/${monsterId}`, data);
  return res.data;
}

export async function deleteCampaignMonster(campaignId: string, monsterId: string): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/bestiary/${monsterId}`);
}

export async function copyMonsterFromManual(
  campaignId: string,
  manualId: string,
  slug: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignMonsterDetail> {
  const res = await api.post(`/campaigns/${campaignId}/bestiary/copy/${manualId}/${slug}`, null, {
    params: { lang },
  });
  return res.data;
}
