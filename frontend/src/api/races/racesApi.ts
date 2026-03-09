import { api } from '../../apiBase';

export interface CampaignRaceListItem {
  id: string;
  name: string;
  size: string;
  speed: Record<string, number>;
  origin: 'manual' | 'manual-edited' | 'homebrew';
  sourceManual?: string | null;
  customOriginName?: string | null;
  isCustom: boolean;
}

export interface CampaignRaceDetail extends CampaignRaceListItem {
  abilityBonuses?: Record<string, number>;
  age?: { maturity?: number; max?: number };
  languages?: string[];
  proficiencies?: { weapons?: string[]; armor?: string[]; tools?: string[] };
  senses?: Record<string, number>;
  traits?: any[];
  subraces?: any[];
  [key: string]: any;
}

export interface ListCampaignRacesParams {
  q?: string;
  origin?: string;
  sort?: 'name' | 'name_desc' | 'size' | 'size_desc' | 'origin' | 'origin_desc';
  page?: number;
  pageSize?: number;
}

export interface CreateCampaignRaceDto {
  sourceManualId?: string;
  sourceRaceId?: string;
  customOriginName?: string;
  customData?: Record<string, any>;
}

/**
 * Lists all races for a campaign (manual + campaign-specific).
 */
export async function listCampaignRaces(
  campaignId: string,
  params: ListCampaignRacesParams = {},
  lang: 'en' | 'es' = 'en',
) {
  const res = await api.get(`/campaigns/${campaignId}/races`, {
    params: { ...params, lang },
  });
  return res.data;
}

/**
 * Gets a single race detail by ID.
 */
export async function getCampaignRace(
  campaignId: string,
  raceId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignRaceDetail> {
  const res = await api.get(`/campaigns/${campaignId}/races/${raceId}`, {
    params: { lang },
  });
  return res.data;
}

/**
 * Creates a new homebrew race in a campaign.
 */
export async function createCampaignRace(
  campaignId: string,
  data: CreateCampaignRaceDto,
): Promise<CampaignRaceDetail> {
  const res = await api.post(`/campaigns/${campaignId}/races`, data);
  return res.data;
}

/**
 * Updates a campaign race.
 */
export async function updateCampaignRace(
  campaignId: string,
  raceId: string,
  data: Partial<CreateCampaignRaceDto>,
): Promise<CampaignRaceDetail> {
  const res = await api.patch(`/campaigns/${campaignId}/races/${raceId}`, data);
  return res.data;
}

/**
 * Deletes a campaign race.
 */
export async function deleteCampaignRace(
  campaignId: string,
  raceId: string,
): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/races/${raceId}`);
}

/**
 * Copies a manual race to the campaign for editing.
 */
export async function copyRaceFromManual(
  campaignId: string,
  manualId: string,
  raceId: string,
  lang: 'en' | 'es' = 'en',
): Promise<CampaignRaceDetail> {
  const res = await api.post(
    `/campaigns/${campaignId}/races/copy/${manualId}/${raceId}`,
    null,
    { params: { lang } },
  );
  return res.data;
}
