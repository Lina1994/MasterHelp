import { api } from '../../apiBase';

export interface CampaignClassListItem {
  id: string;
  name: string;
  hitDie: number;
  primaryAbilities: string[];
  savingThrows: string[];
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignClassDetail extends CampaignClassListItem {
  hitPoints?: { hitDice: string; at1stLevel: string; atHigherLevels: string };
  proficiencies?: { armor?: string[]; weapons?: string[]; tools?: string[] };
  skills?: { choose: number; from: string[] };
  features?: any[];
  levels?: any[];
  subclasses?: any[];
  spellcasting?: any;
  [key: string]: any;
}

export interface ListCampaignClassesParams {
  q?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'hitDie' | 'hitDie_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignClassDto {
  sourceManualId?: string;
  sourceClassId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all classes for a campaign (manual + campaign-specific).
 */
export async function listCampaignClasses(
  campaignId: string,
  params: ListCampaignClassesParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/classes`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single class detail by ID.
 */
export async function getCampaignClass(
  campaignId: string,
  classId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignClassDetail> {
  const res = await api.get(`/campaigns/${campaignId}/classes/${classId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew class in a campaign.
 */
export async function createCampaignClass(
  campaignId: string,
  data: CreateCampaignClassDto,
): Promise<CampaignClassDetail> {
  const res = await api.post(`/campaigns/${campaignId}/classes`, data);
  return res.data;
}

/**
 * Updates a campaign class.
 */
export async function updateCampaignClass(
  campaignId: string,
  classId: string,
  data: Partial<CreateCampaignClassDto>,
): Promise<CampaignClassDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/classes/${classId}`, data);
  return res.data;
}

/**
 * Deletes a campaign class.
 */
export async function deleteCampaignClass(
  campaignId: string,
  classId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/classes/${classId}`);
}

/**
 * Copies a manual class to the campaign for editing.
 */
export async function copyClassFromManual(
  campaignId: string,
  manualId: string,
  classId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignClassDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/classes/copy/${manualId}/${classId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
