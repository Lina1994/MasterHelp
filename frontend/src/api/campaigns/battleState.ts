import { api } from '../../apiBase';

export type CampaignBattleState = {
  started: boolean;
  encounterId: string | null;
  round: number;
  turnIndex: number;
  currentTurnId: string | null;
  items: Array<{ id: string; name: string; imageUrl: string | null }>;
};

export async function getCampaignBattleState(campaignId: string): Promise<CampaignBattleState> {
  const res = await api.get<{ state: CampaignBattleState }>(`/campaigns/${campaignId}/battle-state`);
  return res.data.state;
}

/**
 * Public (no-auth) read of battle state for projection.
 */
export async function getCampaignBattleStatePublic(campaignId: string): Promise<CampaignBattleState> {
  const res = await api.get<CampaignBattleState>(`/campaigns/projection/${campaignId}/battle-state`);
  return res.data;
}

export async function setCampaignBattleState(campaignId: string, state: Partial<CampaignBattleState>): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/battle-state`, state);
}
