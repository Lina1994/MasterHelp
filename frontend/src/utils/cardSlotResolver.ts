/**
 * Tiny dot-path resolver for card slot bindings. Equivalent to a minimal
 * lodash.get — keeps the card runtime dependency-free so the preview can
 * render synchronously while the editor is open.
 */

/**
 * Walks `path` (dot-notation, e.g. "stats.str") on `source` and returns the
 * resolved value, or `undefined` if any segment is missing.
 */
export function resolveCardPath(source: unknown, path: string): unknown {
  if (!source || typeof path !== 'string' || path.length === 0) return undefined;
  const segments = path.split('.');
  let cursor: unknown = source;
  for (const segment of segments) {
    if (cursor == null) return undefined;
    if (typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * Renders the binding value for a slot given the entity payload. Supports
 * static text, prefixes/suffixes, formatString with `{value}`, and a
 * `fallbackText` when the resolved value is undefined.
 */
export function renderSlotValue(
  binding: { fieldPath?: string; fallbackText?: string; isStatic?: boolean; formatString?: string; prefix?: string; suffix?: string } | undefined,
  entity: Record<string, unknown>,
): string {
  if (!binding) return '';
  if (binding.isStatic) return binding.fallbackText ?? '';

  const raw = resolveCardPath(entity, binding.fieldPath ?? '');
  let value = raw == null ? '' : String(raw);
  if (!value && binding.fallbackText) {
    value = binding.fallbackText;
  }
  if (binding.formatString && binding.formatString.includes('{value}')) {
    value = binding.formatString.split('{value}').join(value);
  }
  if (binding.prefix) value = `${binding.prefix}${value}`;
  if (binding.suffix) value = `${value}${binding.suffix}`;
  return value;
}
