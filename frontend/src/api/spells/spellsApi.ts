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
  /**
   * Optional body text. The list endpoint does not always include it for
   * performance reasons; the bulk card generator and similar consumers must
   * fall back to `getCampaignSpell` to receive the full description.
   */
  description?: string;
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

/**
 * Downloads the campaign spell list as an .xlsx file and triggers browser download.
 * @param campaignId - Campaign UUID.
 * @param lang       - Language code for spell names.
 */
export async function exportSpellsExcel(
  campaignId: string,
  lang: 'en' | 'es' = 'en',
): Promise<void> {
  const res = await api.get(`/campaigns/${campaignId}/spells/export`, {
    params: { lang },
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spells-${campaignId}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Uploads an .xlsx file to import spells into a campaign.
 * @param campaignId - Campaign UUID.
 * @param file       - The Excel File object.
 * @param lang       - Language code for manual spell look-ups.
 * @returns          - Summary with created, updated, skipped counts.
 */
export async function importSpellsExcel(
  campaignId: string,
  file: File,
  lang: 'en' | 'es' = 'en',
): Promise<{ created: number; updated: number; skipped: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/campaigns/${campaignId}/spells/import`, formData, {
    params: { lang },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
