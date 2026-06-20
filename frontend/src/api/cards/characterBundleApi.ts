import { api } from '../../apiBase';
import type {
  ListCampaignSpellsParams,
  CampaignSpellListItem,
} from '../spells/spellsApi';
import type {
  ListCampaignTraitsParams,
  CampaignTraitListItem,
} from '../traits/traitsApi';
import type {
  ListCampaignFeatsParams,
  CampaignFeatListItem,
} from '../feats/featsApi';

// Re-export the list item types so dialogs can pull both the fetching
// function and its payload type from a single module.
export type { CampaignSpellListItem, CampaignTraitListItem, CampaignFeatListItem };

/** Reduced character listing for picker UIs. */
export interface CharacterLite {
  id: string;
  name: string;
  kind?: 'pc' | 'npc';
}

/**
 * Lightweight character listing: returns only id + name. Avoids dragging the
 * full CharacterPayload through dialogs that don't need it.
 */
export async function listCampaignCharactersLite(campaignId: string): Promise<CharacterLite[]> {
  const res = await api.get(`/characters`, { params: { campaignId } });
  return (res.data ?? []).map((c: any) => ({ id: c.id, name: c.name, kind: c.kind }));
}

/**
 * Re-export of the canonical campaign spell list used by the character card
 * generator. Returns the raw `{ items, total, ... }` shape so callers can
 * split into "all" and "selected" sets without re-querying.
 */
export async function listCampaignSpells(
  campaignId: string,
  params: ListCampaignSpellsParams = {},
  lang: 'en' | 'es' = 'en',
): Promise<{ items: CampaignSpellListItem[]; total: number }> {
  const res = await api.get(`/campaigns/${campaignId}/spells`, { params: { ...params, lang } });
  return res.data;
}

/**
 * Re-export of the canonical campaign trait list.
 */
export async function listCampaignTraits(
  campaignId: string,
  params: ListCampaignTraitsParams = {},
  lang: 'en' | 'es' = 'en',
): Promise<{ items: CampaignTraitListItem[]; total: number }> {
  const res = await api.get(`/campaigns/${campaignId}/traits`, { params: { ...params, lang } });
  return res.data;
}

/**
 * Re-export of the canonical campaign feat list.
 */
export async function listCampaignFeats(
  campaignId: string,
  params: ListCampaignFeatsParams = {},
  lang: 'en' | 'es' = 'en',
): Promise<{ items: CampaignFeatListItem[]; total: number }> {
  const res = await api.get(`/campaigns/${campaignId}/feats`, { params: { ...params, lang } });
  return res.data;
}
