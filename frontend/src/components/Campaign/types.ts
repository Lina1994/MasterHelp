
import { User } from '../../types';

export type CampaignRole = 'master' | 'player';

export interface CampaignPlayer {
  id: string;
  user: User;
  role: CampaignRole;
  status: 'active' | 'invited' | 'declined';
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  players: CampaignPlayer[];
  owner: User;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignInvite {
  campaignId: string;
  email: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  sentAt: string;
}
