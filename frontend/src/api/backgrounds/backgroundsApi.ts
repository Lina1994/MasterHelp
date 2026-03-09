import { api } from '../../apiBase';

export interface CampaignBackgroundListItem {
  id: string;
  name: string;
  description?: string;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignBackgroundDetail extends CampaignBackgroundListItem {
  skillProficiencies?: string[];
  toolProficiencies?: string[];
  languages?: number;
  equipment?: string[];
  feature?: { id: string; name: string; description?: string };
  suggestedCharacteristics?: {
    personalityTraits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
  };
  [key: string]: any;
}

export interface ListCampaignBackgroundsParams {
  q?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignBackgroundDto {
  sourceManualId?: string;
  sourceBackgroundId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all backgrounds for a campaign (manual + campaign-specific).
 */
export async function listCampaignBackgrounds(
  campaignId: string,
  params: ListCampaignBackgroundsParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/backgrounds`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single background detail by ID.
 */
export async function getCampaignBackground(
  campaignId: string,
  backgroundId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignBackgroundDetail> {
  const res = await api.get(`/campaigns/${campaignId}/backgrounds/${backgroundId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew background in a campaign.
 */
export async function createCampaignBackground(
  campaignId: string,
  data: CreateCampaignBackgroundDto,
): Promise<CampaignBackgroundDetail> {
  const res = await api.post(`/campaigns/${campaignId}/backgrounds`, data);
  return res.data;
}

/**
 * Updates a campaign background.
 */
export async function updateCampaignBackground(
  campaignId: string,
  backgroundId: string,
  data: Partial<CreateCampaignBackgroundDto>,
): Promise<CampaignBackgroundDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/backgrounds/${backgroundId}`, data);
  return res.data;
}

/**
 * Deletes a campaign background.
 */
export async function deleteCampaignBackground(
  campaignId: string,
  backgroundId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/backgrounds/${backgroundId}`);
}

/**
 * Copies a manual background to the campaign for editing.
 */
export async function copyBackgroundFromManual(
  campaignId: string,
  manualId: string,
  backgroundId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignBackgroundDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/backgrounds/copy/${manualId}/${backgroundId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
