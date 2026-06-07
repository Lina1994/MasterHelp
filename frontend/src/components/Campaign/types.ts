
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
  selectedManualIds?: string[];
  players: CampaignPlayer[];
  owner: User;
  activeSkylineCharacter?: {
    id: string;
    name?: string;
    tokenKind?: 'color' | 'image' | null;
    tokenColor?: string | null;
    tokenImageUrl?: string | null;
    characterImageUrl?: string | null;
  } | null;
  activeSkylineImageUrl?: string | null;
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
