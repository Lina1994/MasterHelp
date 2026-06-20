import { api } from '../../apiBase';

export interface CampaignFeatListItem {
  id: string;
  name: string;
  prerequisite?: string | null;
  /**
   * Backend list endpoint includes the feat description; the bulk card
   * generator and any other renderer can read it directly without an extra
   * request.
   */
  description: string;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignFeatDetail extends CampaignFeatListItem {
  description: string;
  source?: string;
  [key: string]: any;
}

export interface ListCampaignFeatsParams {
  q?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignFeatDto {
  sourceManualId?: string;
  sourceFeatId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all feats for a campaign (manual + campaign-specific).
 */
export async function listCampaignFeats(
  campaignId: string,
  params: ListCampaignFeatsParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/feats`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single feat detail by ID.
 */
export async function getCampaignFeat(
  campaignId: string,
  featId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignFeatDetail> {
  const res = await api.get(`/campaigns/${campaignId}/feats/${featId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew feat in a campaign.
 */
export async function createCampaignFeat(
  campaignId: string,
  data: CreateCampaignFeatDto,
): Promise<CampaignFeatDetail> {
  const res = await api.post(`/campaigns/${campaignId}/feats`, data);
  return res.data;
}

/**
 * Updates a campaign feat.
 */
export async function updateCampaignFeat(
  campaignId: string,
  featId: string,
  data: Partial<CreateCampaignFeatDto>,
): Promise<CampaignFeatDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/feats/${featId}`, data);
  return res.data;
}

/**
 * Deletes a campaign feat.
 */
export async function deleteCampaignFeat(
  campaignId: string,
  featId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/feats/${featId}`);
}

/**
 * Copies a manual feat to the campaign for editing.
 */
export async function copyFeatFromManual(
  campaignId: string,
  manualId: string,
  featId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignFeatDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/feats/copy/${manualId}/${featId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
