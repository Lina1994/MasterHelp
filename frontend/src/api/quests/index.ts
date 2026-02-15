import { api } from '../../apiBase';
import type { User } from '../../types';

export type QuestStatus = 'not_accepted' | 'accepted' | 'completed';

export interface QuestPayload {
  id: string;
  campaignId: string;
  createdBy: User;
  title: string;
  description: string | null;
  status: QuestStatus;
  prerequisiteQuest: QuestPayload | null;
  prerequisiteQuestId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  lastStatusChangedBy: User | null;
  statusChangedAt: string | null;
}

export interface CreateQuestPayload {
  campaignId: string;
  title: string;
  description?: string | null;
  status?: QuestStatus;
  prerequisiteQuestId?: string | null;
  order?: number;
}

export interface UpdateQuestPayload {
  title?: string;
  description?: string | null;
  status?: QuestStatus;
  prerequisiteQuestId?: string | null;
  order?: number;
}

export async function listQuests(campaignId: string): Promise<QuestPayload[]> {
  const res = await api.get('/quests', { params: { campaignId } });
  return res.data;
}

export async function getQuest(id: string): Promise<QuestPayload> {
  const res = await api.get(`/quests/${id}`);
  return res.data;
}

export async function createQuest(payload: CreateQuestPayload): Promise<QuestPayload> {
  const res = await api.post('/quests', payload);
  return res.data;
}

export async function updateQuest(id: string, payload: UpdateQuestPayload): Promise<QuestPayload> {
  const res = await api.patch(`/quests/${id}`, payload);
  return res.data;
}

export async function deleteQuest(id: string): Promise<void> {
  await api.delete(`/quests/${id}`);
}
