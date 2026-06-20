import { useEffect, useState } from 'react';
import { api } from '../../apiBase';
import { entityNormalisers } from './cardsFieldCatalog';
import type { CardEntityKind, CardEntityPayload } from '../../types/cardTemplates';

/**
 * Mapping mirroring {@link CardSamplePicker} so the list and the editor
 * hit the exact same backend routes for any given entity kind.
 */
function kindToPath(kind: CardEntityKind): string {
  switch (kind) {
    case 'spell': return 'spells';
    case 'trait': return 'traits';
    case 'feat': return 'feats';
    case 'monster': return 'monsters';
    case 'character': return 'characters';
    case 'shop-item': return 'shops';
    default: return 'spells';
  }
}

/**
 * Default manual a fresh install will always have. If a deployment hasn't
 * shipped the manuals registry, any call would 404, so we hardcode the
 * most common slug and let the user override via the picker in the editor.
 */
const DEFAULT_MANUAL = 'dnd5e-2014';

/**
 * Module-level promise cache. One real sample per (kind, lang) tuple is
 * fetched per session; the promise itself is cached so concurrent
 * components share the same in-flight request.
 */
type SamplePromise = Promise<CardEntityPayload | null>;
const SAMPLE_CACHE: Map<string, SamplePromise> = new Map();

function cacheKey(kind: CardEntityKind, manualId: string, lang: 'en' | 'es'): string {
  return `${manualId}|${kind}|${lang}`;
}

/**
 * Fetches a single representative real sample for the given kind from the
 * given manual. Returns `null` on any error so callers can transparently
 * fall back to a synthetic sample.
 */
function fetchRealSample(
  kind: CardEntityKind,
  manualId: string,
  lang: 'en' | 'es',
): SamplePromise {
  const key = cacheKey(kind, manualId, lang);
  const inflight = SAMPLE_CACHE.get(key);
  if (inflight) return inflight;
  const url = `/manuals/${encodeURIComponent(manualId)}/${kindToPath(kind)}`;
  const promise: SamplePromise = api
    .get(url, { params: { page: 1, pageSize: 1, sortBy: 'name', sortDir: 'asc', lang } })
    .then((res) => {
      const raw = Array.isArray(res.data) ? res.data[0] : res.data?.items?.[0];
      if (!raw) return null;
      return entityNormalisers[kind](raw) as CardEntityPayload;
    })
    .catch(() => null)
    .finally(() => {
      // Drop successful resolutions after a microtask so we don't hold the
      // payload forever; keep failed promises so retry mechanisms (logout +
      // reload) are the only path for fresh attempts.
      setTimeout(() => SAMPLE_CACHE.delete(key), 60_000);
    });
  SAMPLE_CACHE.set(key, promise);
  return promise;
}

/**
 * Hook returning a real sample for the given kind. The first component
 * that asks for a kind pays the network cost; siblings get the cached
 * promise. Use a single `kind` value per template to avoid waterfall.
 *
 * `manualId` defaults to 'dnd5e-2014' which is the stock manual every
 * install ships with; deployments without it will fall through to the
 * synthetic placeholder.
 *
 * The hook returns a tri-state:
 *   - `{ status: 'idle' }` — no fetch in progress (or kind is null).
 *   - `{ status: 'loading' }` — first fetch pending.
 *   - `{ status: 'ok', payload }` — fetch succeeded.
 *   - `{ status: 'error' }` — fetch failed; cached null promise resolved.
 *
 * Returning a discriminated union lets the list distinguish a perpetual
 * "loading" state from a failed fetch that the cache has turned sticky
 * for the 60-second eviction window — otherwise the user saw
 * "Cargando ejemplo real…" forever and couldn't tell why.
 */
export function useRealCardSample(
  kind: CardEntityKind | null,
  lang: 'en' | 'es',
  manualId: string = DEFAULT_MANUAL,
):
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ok'; payload: CardEntityPayload } {
  const [state, setState] = useState<
    | { status: 'idle' | 'loading' | 'error' }
    | { status: 'ok'; payload: CardEntityPayload }
  >({ status: 'idle' });
  useEffect(() => {
    if (!kind) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    fetchRealSample(kind, manualId, lang).then((payload) => {
      if (cancelled) return;
      setState(payload ? { status: 'ok', payload } : { status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, lang, manualId]);
  return state;
}

/**
 * Clears the module cache. Call on logout / campaign change so the next
 * user plays against their active manual.
 */
export function resetRealSampleCache(): void {
  SAMPLE_CACHE.clear();
}

/**
 * Best-effort inference of the entity kind that "fits" a template the
 * most. We scan every slot binding and pick the kind whose prefix appears
 * in the fewest distinct templates so the most diverse kind wins. Returns
 * `null` when every slot is fully static (no `fieldPath` at all) so the
 * callers don't fetch a fireball for a Tarot deck.
 */
export function inferKindFromSlots(slots: { binding?: { fieldPath?: string } }[]): CardEntityKind | null {
  const tally: Record<string, number> = { spell: 0, trait: 0, feat: 0, monster: 0, character: 0, 'shop-item': 0 };
  let anyBinding = false;
  for (const s of slots) {
    const p = s.binding?.fieldPath;
    if (!p) continue;
    anyBinding = true;
    if (p.startsWith('prerequisite')) tally.feat++;
    else if (p.startsWith('abilities') || p.startsWith('armorClass') || p.startsWith('hitPoints')) tally.monster++;
    else if (p.startsWith('className') || p.startsWith('dexterity') || p.startsWith('wisdom') || p.startsWith('maxHp')) tally.character++;
    else if (p.startsWith('price') || p.startsWith('currency') || p.startsWith('rarity')) tally['shop-item']++;
    else if (p === 'school' || p === 'castingTime' || p === 'range') tally.spell++;
    else tally.spell++;
  }
  if (!anyBinding) return null;
  let best: CardEntityKind = 'spell';
  let bestScore = -1;
  for (const [k, v] of Object.entries(tally) as [CardEntityKind, number][]) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }
  return best;
}
