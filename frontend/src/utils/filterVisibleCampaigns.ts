import { Campaign } from '../components/Campaign/types';
import { getCurrentUser } from '../utils/getCurrentUser';

export function filterVisibleCampaigns(campaigns: Campaign[]): Campaign[] {
  const user = getCurrentUser();
  if (!user) return [];
  return campaigns.filter(campaign => {
    // Siempre mostrar si eres el owner
    if (campaign.owner && campaign.owner.id === user.id) return true;
    // Si eres player, pero NO solo con status 'declined'
    const player = campaign.players?.find(p => p.user?.id === user.id);
    if (!player) return false;
    // Solo mostrar si status no es 'declined'
    return player.status !== 'declined';
  });
}
