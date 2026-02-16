import { api } from '../../apiBase';

export interface CampaignSpellListItem {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  isConcentration?: boolean;
  isRitual?: boolean;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignSpellDetail extends CampaignSpellListItem {
  classes?: string[];
  materials?: string;
  ritual?: boolean;
  concentration?: boolean;
  description?: string;
  savingThrow?: string;
  areaOfEffect?: string;
}

export interface ListCampaignSpellsParams {
  q?: string;
  level?: string; // comma-separated levels
  school?: string;
  concentration?: 'true' | 'false';
  ritual?: 'true' | 'false';
  origin?: string;
  sort?: 'name' | 'name_desc' | 'level' | 'level_desc' | 'school' | 'school_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignSpellDto {
  sourceManualId?: string;
  sourceSpellId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

export async function listCampaignSpells(
  campaignId: string,
  params: ListCampaignSpellsParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/spells`, {
    params: { ...params, lang },
  });
  return res.data;
}

export async function getCampaignSpell(
  campaignId: string,
  spellId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignSpellDetail> {
  const res = await api.get(`/campaigns/${campaignId}/spells/${spellId}`, {
    params: { lang },
  });
  return res.data;
}

export async function createCampaignSpell(
  campaignId: string,
  data: CreateCampaignSpellDto,
): Promise<CampaignSpellDetail> {
  const res = await api.post(`/campaigns/${campaignId}/spells`, data);
  return res.data;
}

export async function updateCampaignSpell(
  campaignId: string,
  spellId: string,
  data: Partial<CreateCampaignSpellDto>,
): Promise<CampaignSpellDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/spells/${spellId}`, data);
  return res.data;
}

export async function deleteCampaignSpell(campaignId: string, spellId: string): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/spells/${spellId}`);
}

export async function copySpellFromManual(
  campaignId: string,
  manualId: string,
  spellId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignSpellDetail> {
  const res = await api.post(`/campaigns/${campaignId}/spells/copy/${manualId}/${spellId}`, null, {
    params: { lang },
  });
  return res.data;
}
