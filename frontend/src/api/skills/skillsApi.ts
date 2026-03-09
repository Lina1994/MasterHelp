import { api } from '../../apiBase';

export interface CampaignSkillListItem {
  id: string;
  name: string;
  ability: string;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignSkillDetail extends CampaignSkillListItem {
  description: string;
  [key: string]: any;
}

export interface ListCampaignSkillsParams {
  q?: string;
  ability?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'ability' | 'ability_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignSkillDto {
  sourceManualId?: string;
  sourceSkillId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all skills for a campaign (manual + campaign-specific).
 */
export async function listCampaignSkills(
  campaignId: string,
  params: ListCampaignSkillsParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/skills`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single skill detail by ID.
 */
export async function getCampaignSkill(
  campaignId: string,
  skillId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignSkillDetail> {
  const res = await api.get(`/campaigns/${campaignId}/skills/${skillId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew skill in a campaign.
 */
export async function createCampaignSkill(
  campaignId: string,
  data: CreateCampaignSkillDto,
): Promise<CampaignSkillDetail> {
  const res = await api.post(`/campaigns/${campaignId}/skills`, data);
  return res.data;
}

/**
 * Updates a campaign skill.
 */
export async function updateCampaignSkill(
  campaignId: string,
  skillId: string,
  data: Partial<CreateCampaignSkillDto>,
): Promise<CampaignSkillDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/skills/${skillId}`, data);
  return res.data;
}

/**
 * Deletes a campaign skill.
 */
export async function deleteCampaignSkill(
  campaignId: string,
  skillId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/skills/${skillId}`);
}

/**
 * Copies a manual skill to the campaign for editing.
 */
export async function copySkillFromManual(
  campaignId: string,
  manualId: string,
  skillId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignSkillDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/skills/copy/${manualId}/${skillId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
