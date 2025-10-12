import { api } from '../../apiBase';

export type GridOverlaySettings = {
  enabled: boolean;
  type: 'square' | 'hex';
  cellSize: number;
  color: string;
  opacity: number; // 0..1
  lineWidth: number; // px
};

export async function getGridOverlaySettings(campaignId: string): Promise<GridOverlaySettings> {
  const res = await api.get<{ settings: GridOverlaySettings }>(`/campaigns/${campaignId}/grid-overlay`);
  return res.data.settings;
}

export async function setGridOverlaySettings(campaignId: string, settings: GridOverlaySettings): Promise<void> {
  await api.patch(`/campaigns/${campaignId}/grid-overlay`, settings);
}
