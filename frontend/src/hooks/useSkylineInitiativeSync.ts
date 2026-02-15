import { useEffect, useRef } from 'react';
import { EncounterSummary } from '../api/encounters';
import { CharacterPayload } from '../api/characters';
import { setCampaignBattleState } from '../api/campaigns/battleState';
import type { CampaignMonsterDetail } from '../api/bestiary/bestiaryApi';

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
  monsterDetailByPid: Record<string, CampaignMonsterDetail | null>;
  showInitiativeStrip: boolean;
  isInitialized?: boolean; // Prevents broadcasts during initial mount/hydration
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
    monsterDetailByPid,
    showInitiativeStrip,
    isInitialized = true, // Default to true for backward compatibility
  } = params;

  // Track if we've already sent a valid payload (with participants) to avoid resetting on remount
  const lastPayloadRef = useRef<string | null>(null);

  // Persistir estado de batalla para Skyline web (servidor)
  useEffect(() => {
    // Skip if not yet initialized to prevent premature broadcasts during mount
    if (!isInitialized) return;
    
    const cid = campaignId ?? undefined;
    if (!cid) return;
    const t = setTimeout(() => {
      const maxItems = 10;
      const turnIdx = Math.max(0, Math.min(orderedParticipants.length - 1, turnIndex));
      const orderedByTurn = [...orderedParticipants.slice(turnIdx), ...orderedParticipants.slice(0, turnIdx)];
      const items = orderedByTurn.slice(0, maxItems).map((p) => {
        let imageUrl: string | null = null;
        if (p.role === 'foe') {
          // For enemies, use tokenImageUrl from monster details
          const md = monsterDetailByPid[p.id];
          imageUrl = md?.tokenImageUrl || null;
        } else if (p.kind === 'character') {
          // For allies, use tokenImageUrl or characterImageUrl
          imageUrl = charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null;
        }
        return {
          id: p.id,
          name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
          imageUrl,
          role: p.role,
        };
      });
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
  }, [isInitialized, campaignId, battleStarted, encounterId, round, turnIndex, currentTurnId, orderedParticipants, enemyDisplayNameById, charMap, monsterDetailByPid]);

  // Broadcast tira de iniciativa a Skyline (local + canal)
  useEffect(() => {
    // Skip if not yet initialized to prevent premature broadcasts during mount
    if (!isInitialized) return;
    
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
      items: orderedByTurn.slice(0, maxItems).map((p) => {
        let imageUrl: string | null = null;
        if (p.role === 'foe') {
          // For enemies, use tokenImageUrl from monster details
          const md = monsterDetailByPid[p.id];
          imageUrl = md?.tokenImageUrl || null;
        } else if (p.kind === 'character') {
          // For allies, use tokenImageUrl or characterImageUrl
          imageUrl = charMap.get(p.id)?.tokenImageUrl || charMap.get(p.id)?.characterImageUrl || null;
        }
        return {
          id: p.id,
          name: p.role === 'foe' ? (enemyDisplayNameById[p.id] || p.name) : p.name,
          imageUrl,
          role: p.role,
        };
      }),
      at: Date.now(),
    } as const;

    // Check if there's existing valid data in localStorage
    let existingPayload: any = null;
    try {
      const raw = localStorage.getItem('app.skyline.initiativeStrip');
      if (raw) {
        existingPayload = JSON.parse(raw);
      }
    } catch {}

    // Serialize payload without 'at' field for comparison
    const payloadForComparison = { ...payload, at: 0 };
    const payloadString = JSON.stringify(payloadForComparison);

    // Skip broadcast if:
    // 1. We're in a loading state (empty participants during active battle)
    // 2. There's existing valid data in localStorage with items
    // 3. The existing data is for the same campaign
    // This prevents flickering when re-mounting CombatView while data loads
    const isLoadingState = orderedParticipants.length === 0 && showInitiativeStrip && battleStarted;
    const hasExistingData = existingPayload && Array.isArray(existingPayload.items) && existingPayload.items.length > 0;
    const sameContext = existingPayload?.campaignId === cid && existingPayload?.enabled === true;
    if (isLoadingState && hasExistingData && sameContext) {
      // Don't overwrite existing valid data with empty data during loading
      // Update lastPayloadRef to avoid rebroadcasting when data eventually loads with same content
      if (!lastPayloadRef.current) {
        const existingForComparison = { ...existingPayload, at: 0 };
        lastPayloadRef.current = JSON.stringify(existingForComparison);
      }
      return;
    }

    // Only broadcast if payload actually changed
    if (lastPayloadRef.current === payloadString) {
      return;
    }

    lastPayloadRef.current = payloadString;

    try { localStorage.setItem('app.skyline.initiativeStrip', JSON.stringify(payload)); } catch {}
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage(payload);
        bc.close();
      }
    } catch {}
  }, [isInitialized, campaignId, showInitiativeStrip, battleStarted, orderedParticipants, turnIndex, currentTurnId, enemyDisplayNameById, charMap, monsterDetailByPid]);
}
