import type { CardTemplate } from '../../types/cardTemplates';
import { STARTER_TEMPLATE_MTG } from './mtg';
import { STARTER_TEMPLATE_POKEMON } from './pokemon';
import { STARTER_TEMPLATE_TAROT } from './tarot';

/**
 * Shape of a built-in starter template. The same object exposes every data
 * field needed by the editor and the preview; we synthesise a `CardTemplate`
 * payload from it on demand so existing UI code (CardPreview, CardRenderer)
 * can render the starter without any special-casing.
 */
export interface CardStarterTemplate {
  /** Stable identifier used for keys + duplicate tracking. */
  id: string;
  /** Short user-visible label shown in the "Plantillas de ejemplo" section. */
  label: string;
  /** Longer translation key used as headline / tooltip. */
  descriptionI18nKey: string;
  /** Default fallback translation for the description. */
  descriptionFallback: string;
  /** Materialised CardTemplate payload (no real id, owner, timestamps). */
  template: CardTemplate;
  /** The serialisable CardTemplateInput used when calling createCardTemplate. */
  input: typeof STARTER_TEMPLATE_MTG;
}

const wrapStarter = (
  id: string,
  label: string,
  descriptionI18nKey: string,
  descriptionFallback: string,
  input: typeof STARTER_TEMPLATE_MTG,
): CardStarterTemplate => {
  // The editor and renderer expect a CardTemplate with id/owner, but the
  // server will re-create it under the new owner on duplicate. We synthesise
  // a placeholder CardTemplate just for the read-only preview so existing
  // utility code doesn't need a special case.
  const now = new Date().toISOString();
  const asTemplate: CardTemplate = {
    id: `starter-${id}`,
    name: input.name,
    description: input.description ?? null,
    widthMm: input.widthMm ?? 63,
    heightMm: input.heightMm ?? 88,
    orientation: input.orientation ?? 'portrait',
    sizePreset: input.sizePreset ?? 'POKER',
    globalStyle: input.globalStyle ?? {},
    slots: input.slots ?? [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    id,
    label,
    descriptionI18nKey,
    descriptionFallback,
    template: asTemplate,
    input,
  };
};

export const CARD_STARTER_TEMPLATES: CardStarterTemplate[] = [
  wrapStarter(
    'mtg',
    'Magic',
    'cards_starter_mtg_desc',
    'Plantilla clásica estilo Magic The Gathering (63 × 88 mm) con marco, nombre, coste, ilustración grande, línea de tipo, descripción y power/toughness.',
    STARTER_TEMPLATE_MTG,
  ),
  wrapStarter(
    'pokemon',
    'Mascotas coleccionables',
    'cards_starter_pokemon_desc',
    'Variante estilo mascota / Pokémon con marco amarillo, HP destacado, etapa, ilustración, descripción y badges de debilidad/resistencia/retirada.',
    STARTER_TEMPLATE_POKEMON,
  ),
  wrapStarter(
    'tarot',
    'Tarot',
    'cards_starter_tarot_desc',
    'Baraja de Tarot o cartas grandes (70 × 120 mm) con marco ornamental fino, fondo oscuro y tipografía serif.',
    STARTER_TEMPLATE_TAROT,
  ),
];
