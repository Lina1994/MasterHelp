/** Shared lightweight types for E2E test assertions. */
export interface TestUserRef {
  id?: string;
  email?: string;
  username?: string;
}

export interface TestCampaignPlayer {
  id: string;
  status: 'active' | 'invited' | 'declined';
  role?: string;
  user?: TestUserRef;
}

export interface TestCampaign {
  id: string;
  name: string;
  description?: string;
  players: TestCampaignPlayer[];
}
