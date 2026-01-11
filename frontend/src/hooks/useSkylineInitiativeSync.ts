import { useEffect } from 'react';
import { EncounterSummary } from '../api/encounters';
import { CharacterPayload } from '../api/characters';
import { setCampaignBattleState } from '../api/campaigns/battleState';

export interface SkylineSyncParams {
  campaignId?: string | null;
  battleStarted: boolean;
  encounterId?: string | null;
  round: number;
  turnIndex: number;
  currentTurnId?: string | null;
  orderedParticipants: EncounterSummary['participants'];
  enemyDisplayNameById: Record<string, string>;
  charMap: Map<string, CharacterPayload>;
  showInitiativeStrip: boolean;
}

/**
 * Encapsula la sincronización del estado de combate con Skyline:
 * - Persistencia en servidor del estado de batalla para la web de Skyline
 * - Broadcast de la tira de iniciativa (localStorage + BroadcastChannel)
 */
export function useSkylineInitiativeSync(params: SkylineSyncParams) {
  const {
    campaignId,
    battleStarted,
    encounterId,
    round,
    turnIndex,
    currentTurnId,
    orderedParticipants,
    enemyDisplayNameById,
    charMap,
    showInitiativeStrip,
  } = params;

  // Persistir estado de batalla para Skyline web (servidor)
  useEffect(() => {
    const cid = campaignId ?? undefined;
    if (!cid) return;
    const t = setTimeout(() => {
      const maxItems = 10;
      const turnIdx = Math.max(0, Math.min(orderedParticipants.length - 1, turnIndex));
      const orderedByTurn = [...orderedParticipants.slice(turnIdx), ...orderedParticipants.slice(0, turnIdx)];
      const items = orderedByTurn.slice(0, maxItems).map((p) => ({
        id: p.id,
        name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
        imageUrl: (p.role !== 'foe' && p.kind === 'character') ? (charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null) : null,
      }));
      const payload: any = {
        started: !!battleStarted,
        encounterId: encounterId || null,
        round,
        turnIndex,
        currentTurnId: currentTurnId || null,
        items,
      };
      setCampaignBattleState(cid, payload).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [campaignId, battleStarted, encounterId, round, turnIndex, currentTurnId, orderedParticipants, enemyDisplayNameById, charMap]);

  // Broadcast tira de iniciativa a Skyline (local + canal)
  useEffect(() => {
    const cid = campaignId ?? undefined;
    if (!cid) return;
    const enabled = showInitiativeStrip && battleStarted;
    const maxItems = 10;
    const turnIdx = Math.max(0, Math.min(orderedParticipants.length - 1, turnIndex));
    const orderedByTurn = enabled ? [...orderedParticipants.slice(turnIdx), ...orderedParticipants.slice(0, turnIdx)] : [];
    const payload = {
      type: 'initiativeStripUpdated',
      campaignId: cid,
      battleStarted,
      enabled: showInitiativeStrip,
      currentTurnId: currentTurnId || null,
      items: orderedByTurn.slice(0, maxItems).map((p) => ({
        id: p.id,
        name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
        imageUrl: (p.role !== 'foe' && p.kind === 'character') ? (charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null) : null,
      })),
      at: Date.now(),
    } as const;
    try { localStorage.setItem('app.skyline.initiativeStrip', JSON.stringify(payload)); } catch {}
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage(payload);
        bc.close();
      }
    } catch {}
  }, [campaignId, showInitiativeStrip, battleStarted, orderedParticipants, turnIndex, currentTurnId, enemyDisplayNameById, charMap]);
}
