import { api } from '../../apiBase';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'night';

export async function getCampaignTimeOfDay(campaignId: string): Promise<TimeOfDay | null> {
  const res = await api.get<{ timeOfDay: TimeOfDay | null }>(`/campaigns/${campaignId}/time-of-day`);
  return (res.data?.timeOfDay as any) || null;
}

export async function setCampaignTimeOfDay(campaignId: string, timeOfDay: TimeOfDay): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/time-of-day`, { timeOfDay });
}
