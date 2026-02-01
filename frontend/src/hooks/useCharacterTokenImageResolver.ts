import { useEffect, useMemo, useRef, useState } from 'react';
import { listCharacters, type CharacterPayload } from '../api/characters';

export type TokenImageResolver = (id: string) => string | undefined;

/**
 * useCharacterTokenImageResolver
 *
 * Fetches the campaign character list and builds a resolver to map a token id (character id)
 * to an image URL suitable for token rendering.
 *
 * - Prefers `tokenImageUrl`, falls back to `characterImageUrl`.
 * - Designed so map tokens created from combat (id = characterId) can automatically render
 *   the proper character token image without storing extra fields on the map token.
 */
export function useCharacterTokenImageResolver(
  campaignId: string | undefined,
  options?: { pollMs?: number },
): {
  resolver: TokenImageResolver;
  charactersById: Map<string, CharacterPayload>;
  loading: boolean;
} {
  const pollMs = options?.pollMs ?? 0;
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const lastCampaignId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (!campaignId) {
        setCharacters([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listCharacters(campaignId);
        if (disposed) return;
        setCharacters(Array.isArray(data) ? data : []);
      } catch {
        if (disposed) return;
        setCharacters([]);
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

  const resolver: TokenImageResolver = useMemo(() => {
    return (id: string) => {
      const ch = charactersById.get(id);
      if (!ch) return undefined;
      return ch.tokenImageUrl || ch.characterImageUrl || undefined;
    };
  }, [charactersById]);

  return { resolver, charactersById, loading };
}
