/**
 * API client para gestión de encuentros y combate.
 * Conecta contra los endpoints reales del backend (NestJS) bajo `/campaigns/:campaignId/encounters`.
 */
import { api } from '../apiBase';

export type EncounterDifficulty = 'Fácil' | 'Medio' | 'Difícil' | 'Mortal';

export interface EncounterParticipant {
  id: string;
  name: string;
  kind: 'character' | 'enemy';
  role?: 'ally' | 'foe';
  level?: number;
  cr?: number;
  maxHp?: number;
  currentHp?: number;
  initiative?: number;
  monsterManualId?: string;
  monsterSlug?: string;
}

export interface EncounterSummary {
  id: string;
  name: string;
  difficulty: EncounterDifficulty;
  musicLabel?: string;
  musicSongId?: string;
  participants: EncounterParticipant[];
}

/**
 * Lista encuentros para una campaña concreta.
 */
export async function listEncounters(campaignId: string): Promise<EncounterSummary[]> {
  const { data } = await api.get(`/campaigns/${campaignId}/encounters`);
  return data;
}

/**
 * Crea un encuentro.
 */
export async function createEncounter(campaignId: string, payload: Partial<EncounterSummary>): Promise<EncounterSummary> {
  const { data } = await api.post(`/campaigns/${campaignId}/encounters`, payload);
  return data;
}

/**
 * Actualiza un encuentro existente.
 */
export async function updateEncounter(campaignId: string, encounterId: string, payload: Partial<EncounterSummary>): Promise<EncounterSummary> {
  const { data } = await api.patch(`/campaigns/${campaignId}/encounters/${encounterId}`, payload);
  return data;
}

/**
 * Elimina un encuentro.
 */
export async function deleteEncounter(campaignId: string, encounterId: string): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/encounters/${encounterId}`);
}
