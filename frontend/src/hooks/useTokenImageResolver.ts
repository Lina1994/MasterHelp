import { useEffect, useMemo, useRef, useState } from 'react';
import { listCharacters, type CharacterPayload } from '../api/characters';
import { listCampaignMonsters, type CampaignMonsterListItem } from '../api/bestiary/bestiaryApi';
import { getParticipantMonsterMapPublic } from '../api/campaigns/battleState';

export type TokenImageResolver = (id: string) => string | undefined;

/**
 * useTokenImageResolver
 *
 * Fetches campaign characters (allies), campaign monsters (enemies) and the
 * active encounter's participant→monster mapping.  Builds a unified resolver
 * to map a token / participant id to an image URL.
 *
 * For characters (allies):
 * - Prefers `tokenImageUrl`, falls back to `characterImageUrl`.
 *
 * For monsters (enemies):
 * - Uses `tokenImageUrl` from the campaign bestiary.
 * - Token ids on the map are encounter **participant** ids which differ from
 *   bestiary monster ids.  The `participantToMonsterId` mapping (fetched from
 *   a public endpoint) bridges this gap.
 *
 * This hook is designed for the projection window where both types of tokens
 * need to be rendered.
 */
export function useTokenImageResolver(
  campaignId: string | undefined,
  options?: { pollMs?: number },
): {
  resolver: TokenImageResolver;
  charactersById: Map<string, CharacterPayload>;
  monstersById: Map<string, CampaignMonsterListItem>;
  loading: boolean;
} {
  const pollMs = options?.pollMs ?? 0;
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [monsters, setMonsters] = useState<CampaignMonsterListItem[]>([]);
  /** Maps encounter participantId → bestiary monsterCampaignId */
  const [participantToMonsterId, setParticipantToMonsterId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const lastCampaignId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (!campaignId) {
        setCharacters([]);
        setMonsters([]);
        setParticipantToMonsterId({});
        return;
      }
      setLoading(true);
      try {
        // Load characters, monsters, and participant mapping in parallel
        const [charsData, monstersData, mapping] = await Promise.all([
          listCharacters(campaignId),
          listCampaignMonsters(campaignId, { pageSize: 1000 }, 'es'),
          getParticipantMonsterMapPublic(campaignId).catch(() => ({} as Record<string, string>)),
        ]);
        
        if (disposed) return;
        setCharacters(Array.isArray(charsData) ? charsData : []);
        setMonsters(monstersData?.items || []);
        setParticipantToMonsterId(mapping && typeof mapping === 'object' ? mapping : {});
      } catch {
        if (disposed) return;
        setCharacters([]);
        setMonsters([]);
        setParticipantToMonsterId({});
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    // If campaign changes, load immediately.
    if (lastCampaignId.current !== campaignId) {
      lastCampaignId.current = campaignId;
      load();
    } else if (campaignId) {
      load();
    }

    if (pollMs && pollMs > 0 && campaignId) {
      const id = window.setInterval(load, pollMs);
      return () => {
        disposed = true;
        window.clearInterval(id);
      };
    }

    return () => {
      disposed = true;
    };
  }, [campaignId, pollMs]);

  const charactersById = useMemo(() => {
    const m = new Map<string, CharacterPayload>();
    for (const ch of characters || []) {
      if (ch?.id) m.set(ch.id, ch);
    }
    return m;
  }, [characters]);

  const monstersById = useMemo(() => {
    const m = new Map<string, CampaignMonsterListItem>();
    for (const monster of monsters || []) {
      if (monster?.id) m.set(monster.id, monster);
    }
    return m;
  }, [monsters]);

  const resolver: TokenImageResolver = useMemo(() => {
    return (id: string) => {
      // Try to resolve as character first (ally)
      const ch = charactersById.get(id);
      if (ch) {
        return ch.tokenImageUrl || ch.characterImageUrl || undefined;
      }
      
      // Try direct bestiary monster id match
      const monster = monstersById.get(id);
      if (monster) {
        return monster.tokenImageUrl || undefined;
      }

      // Try via participant→monster mapping (encounter participant id → bestiary monster id)
      const monsterCampaignId = participantToMonsterId[id];
      if (monsterCampaignId) {
        const mapped = monstersById.get(monsterCampaignId);
        if (mapped) {
          return mapped.tokenImageUrl || undefined;
        }
      }
      
      return undefined;
    };
  }, [charactersById, monstersById, participantToMonsterId]);

  return { resolver, charactersById, monstersById, loading };
}
