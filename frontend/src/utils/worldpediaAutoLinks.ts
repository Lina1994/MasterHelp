/**
 * worldpediaAutoLinks.ts
 *
 * Utilities for the Worldpedia "Auto-links" feature.
 *
 * Auto-links let the user configure a set of keyword → link rules.
 * Whenever a keyword appears as plain text in a Worldpedia note, it is
 * automatically rendered as a hyperlink to the configured target (a URL,
 * another Worldpedia note, or any app entity such as a character).
 *
 * Rules are stored per-campaign in localStorage so that no backend changes
 * are needed. The transformation is applied at read/render time only — the
 * stored HTML is never modified — ensuring that editing remains clean and
 * auto-link rules can be updated retroactively.
 */

import type { NoteLinkPayload } from '../api/worldpedia/worldpediaApi';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A single auto-link rule.
 *
 * @property id      - Unique identifier (uuid v4 generated client-side).
 * @property keyword - The plain-text keyword to match (case-insensitive).
 * @property link    - The link target (same payload shape as WorldpediaLinkInserter).
 * @property label   - Human-readable description of the target (for display in the list).
 */
export interface AutoLinkRule {
  id: string;
  keyword: string;
  link: NoteLinkPayload;
  /** Resolved display label stored at creation time (e.g. the entity name). */
  label: string;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const storageKey = (campaignId: string) => `worldpedia.autolinks.${campaignId}`;

/**
 * Loads the auto-link rules for a campaign from localStorage.
 *
 * @param campaignId - Active campaign ID.
 * @returns Array of rules, or empty array if none configured.
 */
export function loadAutoLinkRules(campaignId: string): AutoLinkRule[] {
  try {
    const raw = localStorage.getItem(storageKey(campaignId));
    if (!raw) return [];
    return JSON.parse(raw) as AutoLinkRule[];
  } catch {
    return [];
  }
}

/**
 * Persists the auto-link rules for a campaign to localStorage.
 *
 * @param campaignId - Active campaign ID.
 * @param rules      - Rules array to persist.
 */
export function saveAutoLinkRules(campaignId: string, rules: AutoLinkRule[]): void {
  localStorage.setItem(storageKey(campaignId), JSON.stringify(rules));
}

// ─── Link href builder ────────────────────────────────────────────────────────

/**
 * Builds the `href` string for a given link payload, using the same
 * `worldpedia://` protocol understood by the note viewer and editor.
 *
 * @param link - The link payload.
 * @returns A URL string suitable for an `<a href>` attribute.
 */
export function buildAutoLinkHref(link: NoteLinkPayload): string {
  if (link.type === 'url') return link.targetUrl || '#';
  if (link.type === 'note') return `worldpedia://note/${link.targetNoteId ?? ''}`;
  if (link.type === 'entity')
    return `worldpedia://entity/${link.targetEntityType ?? ''}/${link.targetEntityId ?? ''}`;
  return '#';
}

// ─── HTML transformer ─────────────────────────────────────────────────────────

/**
 * Applies auto-link rules to an HTML string by wrapping matching plain-text
 * keywords with `<a>` elements.
 *
 * The transformation is:
 * - Case-insensitive keyword matching.
 * - Longer keywords take precedence over shorter ones (sorted before iteration).
 * - Existing `<a>` elements are never modified — text inside them is skipped.
 * - Only real text nodes are touched; tag attributes are safe.
 *
 * **DOM-based approach**: the function creates a temporary `div`, sets its
 * `innerHTML`, walks the text-node tree via `TreeWalker`, replaces nodes with
 * document fragments where matches are found, then serialises back to HTML.
 *
 * @param html  - The raw HTML string from the note.
 * @param rules - The active auto-link rules.
 * @returns The transformed HTML string.
 */
export function applyAutoLinks(html: string, rules: AutoLinkRule[]): string {
  if (!html || rules.length === 0) return html;

  // Sort: longest keyword first to avoid partial matches eating shorter ones
  const sorted = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

  // Parse HTML in a detached container
  const div = document.createElement('div');
  div.innerHTML = html;

  /**
   * Walk all text nodes that are NOT inside an <a> element, and replace
   * keyword occurrences with anchor nodes.
   */
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip text nodes inside <a> elements
      if ((node.parentElement as HTMLElement | null)?.closest('a')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // Collect text nodes first (modifying the tree during walk is unsafe)
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent ?? '';
    if (!original.trim()) continue;

    // Check whether any rule matches anywhere in this text node
    const hasMatch = sorted.some((r) =>
      original.toLowerCase().includes(r.keyword.toLowerCase()),
    );
    if (!hasMatch) continue;

    // Build a DocumentFragment replacing keywords with <a> nodes
    const fragment = document.createDocumentFragment();
    let remaining = original;

    while (remaining.length > 0) {
      // Find the earliest occurrence of any rule keyword
      let earliest: { index: number; rule: AutoLinkRule } | null = null;
      for (const rule of sorted) {
        const idx = remaining.toLowerCase().indexOf(rule.keyword.toLowerCase());
        if (idx !== -1 && (earliest === null || idx < earliest.index)) {
          earliest = { index: idx, rule };
        }
      }

      if (!earliest) {
        // No more matches — append the rest as plain text
        fragment.appendChild(document.createTextNode(remaining));
        break;
      }

      // Text before the match
      if (earliest.index > 0) {
        fragment.appendChild(document.createTextNode(remaining.slice(0, earliest.index)));
      }

      // The linked keyword
      const anchor = document.createElement('a');
      anchor.href = buildAutoLinkHref(earliest.rule.link);
      // Preserve the original casing from the source text
      anchor.textContent = remaining.slice(
        earliest.index,
        earliest.index + earliest.rule.keyword.length,
      );
      fragment.appendChild(anchor);

      remaining = remaining.slice(earliest.index + earliest.rule.keyword.length);
    }

    // Replace the original text node with the fragment
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return div.innerHTML;
}
