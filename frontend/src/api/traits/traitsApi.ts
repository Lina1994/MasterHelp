import { api } from '../../apiBase';

export interface CampaignTraitListItem {
  id: string;
  name: string;
  description: string;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignTraitDetail extends CampaignTraitListItem {
  [key: string]: any;
}

export interface ListCampaignTraitsParams {
  q?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignTraitDto {
  sourceManualId?: string;
  sourceTraitId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all traits for a campaign (manual + campaign-specific).
 */
export async function listCampaignTraits(
  campaignId: string,
  params: ListCampaignTraitsParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/traits`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single trait detail by ID.
 */
export async function getCampaignTrait(
  campaignId: string,
  traitId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignTraitDetail> {
  const res = await api.get(`/campaigns/${campaignId}/traits/${traitId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew trait in a campaign.
 */
export async function createCampaignTrait(
  campaignId: string,
  data: CreateCampaignTraitDto,
): Promise<CampaignTraitDetail> {
  const res = await api.post(`/campaigns/${campaignId}/traits`, data);
  return res.data;
}

/**
 * Updates a campaign trait.
 */
export async function updateCampaignTrait(
  campaignId: string,
  traitId: string,
  data: Partial<CreateCampaignTraitDto>,
): Promise<CampaignTraitDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/traits/${traitId}`, data);
  return res.data;
}

/**
 * Deletes a campaign trait.
 */
export async function deleteCampaignTrait(
  campaignId: string,
  traitId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/traits/${traitId}`);
}

/**
 * Copies a manual trait to the campaign for editing.
 */
export async function copyTraitFromManual(
  campaignId: string,
  manualId: string,
  traitId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignTraitDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/traits/copy/${manualId}/${traitId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
