/**
 * Canonical list of every sidebar-eligible tool.
 *
 * Used by HomePage (to show all tools), MainLayout (to render the sidebar),
 * and SidebarSettings (to let users toggle/reorder).
 */
export interface SidebarItemDef {
  /** Unique key – must be stable across releases. */
  key: string;
  /** i18n translation key. */
  labelKey: string;
  /** Fallback label when i18n key is missing. */
  fallback: string;
  /** MUI icon component name (resolved at render time). */
  iconName: string;
  /** Route to navigate to. */
  route: string;
  /** If true, the item is disabled when there is no active campaign. */
  requiresCampaign?: boolean;
  /** If true, only visible when the current user is master. */
  masterOnly?: boolean;
}

/**
 * Default sidebar items in their default order.
 * This is the single source of truth for all sidebar-eligible tools.
 */
export const DEFAULT_SIDEBAR_ITEMS: SidebarItemDef[] = [
  { key: 'campaigns',        labelKey: 'campaigns',  fallback: 'Campañas',    iconName: 'FolderSpecial',    route: '/campaigns' },
  { key: 'soundtrack',       labelKey: 'soundtrack',  fallback: 'Soundtrack',  iconName: 'MusicNote',        route: '/soundtrack' },
  { key: 'manuals',          labelKey: 'manuals',     fallback: 'Manuales',    iconName: 'MenuBook',         route: '/manuals' },
  { key: 'maps',             labelKey: 'maps',        fallback: 'Mapas',       iconName: 'Map',              route: '/maps' },
  { key: 'shortcuts',        labelKey: 'shortcuts',   fallback: 'Atajos',      iconName: 'Bolt',             route: '/shortcuts',         masterOnly: true },
  { key: 'combat',           labelKey: 'combat',      fallback: 'Combate',     iconName: 'SportsKabaddi',    route: '/combat',            requiresCampaign: true },
  { key: 'characters',       labelKey: 'characters',  fallback: 'Personajes',  iconName: 'People',           route: '/characters',        requiresCampaign: true },
  { key: 'quests',           labelKey: 'quests',      fallback: 'Misiones',    iconName: 'Assignment',       route: '/quests',            requiresCampaign: true },
  { key: 'shops',            labelKey: 'shops',       fallback: 'Tiendas',     iconName: 'Storefront',       route: '/shops',             requiresCampaign: true },
  { key: 'worldpedia',       labelKey: 'worldpedia',  fallback: 'Worldpedia',  iconName: 'AutoStories',      route: '/worldpedia',        requiresCampaign: true, masterOnly: true },
  { key: 'diary',            labelKey: 'diary',       fallback: 'Diario',      iconName: 'EventNote',        route: '/diary',             requiresCampaign: true },
  { key: 'campaign-bestiary', labelKey: 'bestiary',   fallback: 'Bestiario',   iconName: 'Pets',             route: '/campaign-bestiary', requiresCampaign: true },
  { key: 'campaign-spells',  labelKey: 'spells',      fallback: 'Conjuros',    iconName: 'AutoFixHigh',      route: '/campaign-spells',   requiresCampaign: true },
];

/** Persisted sidebar configuration shape. */
export interface SidebarConfig {
  /** Ordered list of item keys with their visibility. */
  items: { key: string; visible: boolean }[];
}

/**
 * Builds the default SidebarConfig (everything visible, default order).
 *
 * @returns Default sidebar configuration.
 */
export function getDefaultSidebarConfig(): SidebarConfig {
  return {
    items: DEFAULT_SIDEBAR_ITEMS.map((i) => ({ key: i.key, visible: true })),
  };
}

/**
 * Parses a raw JSON string into a SidebarConfig.
 * Returns null if the string is invalid or null.
 *
 * @param raw - JSON string from the backend.
 * @returns Parsed config or null.
 */
export function parseSidebarConfig(raw: string | null | undefined): SidebarConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) return parsed as SidebarConfig;
    return null;
  } catch {
    return null;
  }
}

/**
 * Merges a user's persisted config with the canonical item list.
 * Ensures newly added items appear at the end and removed items are dropped.
 *
 * @param config - User's persisted config (or null for defaults).
 * @returns Merged ordered list with visibility flags.
 */
export function mergeSidebarConfig(
  config: SidebarConfig | null,
): { key: string; visible: boolean }[] {
  if (!config) return getDefaultSidebarConfig().items;

  const knownKeys = new Set(DEFAULT_SIDEBAR_ITEMS.map((i) => i.key));
  // Keep only items that still exist in the canonical list.
  const ordered = config.items.filter((i) => knownKeys.has(i.key));
  // Append any new canonical items not yet in the user's config.
  const existing = new Set(ordered.map((i) => i.key));
  for (const def of DEFAULT_SIDEBAR_ITEMS) {
    if (!existing.has(def.key)) {
      ordered.push({ key: def.key, visible: true });
    }
  }
  return ordered;
}
