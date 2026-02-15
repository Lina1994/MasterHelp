import { useEffect, useMemo, useRef, useState } from 'react';
import { listCharacters, type CharacterPayload } from '../api/characters';
import { listCampaignMonsters, type CampaignMonsterListItem } from '../api/bestiary/bestiaryApi';

export type TokenImageResolver = (id: string) => string | undefined;

/**
 * useTokenImageResolver
 *
 * Fetches both campaign characters (allies) and campaign monsters (enemies) 
 * and builds a unified resolver to map a token id to an image URL.
 *
 * For characters (allies):
 * - Prefers `tokenImageUrl`, falls back to `characterImageUrl`.
 *
 * For monsters (enemies):
 * - Uses `tokenImageUrl` from the campaign bestiary.
 *
 * This hook is designed for the projection window where both types of tokens need to be rendered.
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
  const [loading, setLoading] = useState(false);
  const lastCampaignId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (!campaignId) {
        setCharacters([]);
        setMonsters([]);
        return;
      }
      setLoading(true);
      try {
        // Load characters and monsters in parallel
        const [charsData, monstersData] = await Promise.all([
          listCharacters(campaignId),
          listCampaignMonsters(campaignId, { pageSize: 1000 }, 'es'), // Load with large page size to get all
        ]);
        
        if (disposed) return;
        setCharacters(Array.isArray(charsData) ? charsData : []);
        setMonsters(monstersData?.items || []);
      } catch {
        if (disposed) return;
        setCharacters([]);
        setMonsters([]);
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
      
      // Try to resolve as monster (enemy)
      const monster = monstersById.get(id);
      if (monster) {
        return monster.tokenImageUrl || undefined;
      }
      
      return undefined;
    };
  }, [charactersById, monstersById]);

  return { resolver, charactersById, monstersById, loading };
}
