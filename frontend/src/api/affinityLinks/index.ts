import { api } from '../../apiBase';
import type { CharacterPayload } from '../characters';

/** API representation of an affinity link. */
export interface AffinityLinkPayload {
  id: string;
  characterA: CharacterPayload;
  characterB: CharacterPayload;
  labelAtoB: string;
  labelBtoA: string;
  /** Sentiment from -3 (hatred) to 3 (love). */
  sentiment: number;
  color: string;
  /** Optional free-form notes about this relationship. */
  notes: string | null;
}

/**
 * Fetches all affinity links for the given campaign.
 *
 * @param campaignId - Campaign UUID.
 * @returns Array of affinity links with populated character data.
 */
export async function listAffinityLinks(campaignId: string): Promise<AffinityLinkPayload[]> {
  const res = await api.get('/affinity-links', { params: { campaignId } });
  return res.data as AffinityLinkPayload[];
}

/**
 * Creates a new affinity link between two characters.
 *
 * @param data - campaignId, characterAId, characterBId, optional labels, sentiment and color.
 * @returns The created link.
 */
export async function createAffinityLink(data: {
  campaignId: string;
  characterAId: string;
  characterBId: string;
  labelAtoB?: string;
  labelBtoA?: string;
  sentiment?: number;
  color?: string;
  notes?: string;
}): Promise<AffinityLinkPayload> {
  const res = await api.post('/affinity-links', data);
  return res.data as AffinityLinkPayload;
}

/**
 * Updates an existing affinity link.
 *
 * @param id    - Link UUID.
 * @param patch - Fields to update.
 * @returns The updated link.
 */
export async function updateAffinityLink(
  id: string,
  patch: { labelAtoB?: string; labelBtoA?: string; sentiment?: number; color?: string; notes?: string },
): Promise<AffinityLinkPayload> {
  const res = await api.patch(`/affinity-links/${id}`, patch);
  return res.data as AffinityLinkPayload;
}

/**
 * Deletes an affinity link.
 *
 * @param id - Link UUID.
 */
export async function deleteAffinityLink(id: string): Promise<void> {
  await api.delete(`/affinity-links/${id}`);
}
