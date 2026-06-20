/**
 * Catalogue of fields that the user can bind to a slot, grouped by the
 * entity kinds they apply to. The same logical field can appear in multiple
 * groups (e.g. "name" is shared across spells, traits, feats, characters,
 * etc.).
 *
 * The generator normalises each entity to a flat record accessible via
 * these paths so the same template can render multiple entity kinds.
 */

import type { CardEntityKind } from '../../types/cardTemplates';

export interface CardFieldChoice {
  /** Path component (will be joined with dot-notation). */
  path: string;
  /** UI label shown in the picker. */
  label: string;
  /** Optional helper hint shown next to the option. */
  hint?: string;
}

export interface CardFieldGroup {
  /** Discriminator for the entity kind the fields apply to. */
  kind: CardEntityKind;
  /** User-visible group title. */
  label: string;
  fields: CardFieldChoice[];
}

/**
 * Static field catalogue. Generic fields (name, description, source) are
 * repeated across groups so the picker UX always shows something useful
 * per entity type.
 */
export const CARD_FIELD_GROUPS: CardFieldGroup[] = [
  {
    kind: 'spell',
    label: 'Conjuros',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'school', label: 'Escuela' },
      { path: 'level', label: 'Nivel' },
      { path: 'castingTime', label: 'Tiempo de lanzamiento' },
      { path: 'range', label: 'Alcance' },
      { path: 'duration', label: 'Duración' },
      { path: 'components', label: 'Componentes' },
      { path: 'materials', label: 'Materiales' },
      { path: 'classes', label: 'Clases' },
      { path: 'savingThrow', label: 'Tirada de salvación' },
      { path: 'areaOfEffect', label: 'Área de efecto' },
      { path: 'description', label: 'Descripción' },
      { path: 'source', label: 'Origen' },
    ],
  },
  {
    kind: 'trait',
    label: 'Rasgos',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'description', label: 'Descripción' },
      { path: 'source', label: 'Origen' },
    ],
  },
  {
    kind: 'feat',
    label: 'Dotes',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'prerequisite', label: 'Prerrequisito' },
      { path: 'description', label: 'Descripción' },
      { path: 'source', label: 'Origen' },
    ],
  },
  {
    kind: 'monster',
    label: 'Bestiario',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'size', label: 'Tamaño' },
      { path: 'type', label: 'Tipo' },
      { path: 'alignment', label: 'Alineamiento' },
      { path: 'challengeRating', label: 'Desafío (CR)' },
      { path: 'armorClass', label: 'CA' },
      { path: 'hitPoints', label: 'PG' },
      { path: 'speed', label: 'Velocidad' },
      { path: 'abilities.strength', label: 'Fue' },
      { path: 'abilities.dexterity', label: 'Des' },
      { path: 'abilities.constitution', label: 'Con' },
      { path: 'abilities.intelligence', label: 'Int' },
      { path: 'abilities.wisdom', label: 'Sab' },
      { path: 'abilities.charisma', label: 'Car' },
      { path: 'description', label: 'Descripción / Rasgos' },
      { path: 'source', label: 'Origen' },
      { path: 'image', label: 'Imagen (URL)' },
      { path: 'imageHigh', label: 'Imagen HD' },
      { path: 'imageMedium', label: 'Imagen media' },
      { path: 'tokenImageUrl', label: 'Imagen del token' },
    ],
  },
  {
    kind: 'character',
    label: 'Personajes',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'className', label: 'Clase' },
      { path: 'subclassName', label: 'Subclase' },
      { path: 'level', label: 'Nivel' },
      { path: 'race', label: 'Raza' },
      { path: 'background', label: 'Trasfondo' },
      { path: 'alignment', label: 'Alineamiento' },
      { path: 'strength', label: 'Fuerza' },
      { path: 'dexterity', label: 'Destreza' },
      { path: 'constitution', label: 'Constitución' },
      { path: 'intelligence', label: 'Inteligencia' },
      { path: 'wisdom', label: 'Sabiduría' },
      { path: 'charisma', label: 'Carisma' },
      { path: 'armorClass', label: 'CA' },
      { path: 'initiative', label: 'Iniciativa' },
      { path: 'speed', label: 'Velocidad' },
      { path: 'maxHp', label: 'PG máx' },
      { path: 'currentHp', label: 'PG actuales' },
      { path: 'description', label: 'Descripción' },
      { path: 'image', label: 'Imagen por defecto' },
      { path: 'characterImageUrl', label: 'Imagen del personaje' },
      { path: 'tokenImageUrl', label: 'Imagen del token' },
    ],
  },
  {
    kind: 'shop-item',
    label: 'Objetos de tienda',
    fields: [
      { path: 'name', label: 'Nombre' },
      { path: 'price', label: 'Precio' },
      { path: 'currency', label: 'Moneda' },
      { path: 'rarity', label: 'Rareza' },
      { path: 'category', label: 'Categoría' },
      { path: 'description', label: 'Descripción' },
      { path: 'weight', label: 'Peso' },
      { path: 'source', label: 'Procedencia' },
    ],
  },
];

/**
 * Returns the catalogue group for a given entity kind, or undefined when the
 * kind has no entries (which only happens for kinds that are deprecated).
 */
export function getFieldGroupFor(kind: CardEntityKind): CardFieldGroup | undefined {
  return CARD_FIELD_GROUPS.find((group) => group.kind === kind);
}

/**
 * Normalises a small entity record (spell/trait/feat/monster/character/
 * shop-item) into the flat shape used by both the renderer and the field
 * picker. Unknown fields end up under the `extras` namespace so users with
 * access to advanced templates can still reference them.
 */
import type { CardEntityPayload } from '../../types/cardTemplates';
import type {
  CampaignMonsterListItem,
  CampaignMonsterDetail,
} from '../../api/bestiary/bestiaryApi';
import type {
  CampaignSpellListItem,
  CampaignSpellDetail,
} from '../../api/spells/spellsApi';
import type {
  CampaignTraitListItem,
  CampaignTraitDetail,
} from '../../api/traits/traitsApi';
import type {
  CampaignFeatListItem,
  CampaignFeatDetail,
} from '../../api/feats/featsApi';
import type { CharacterPayload } from '../../api/characters';

/**
 * Field normalisation is intentionally permissive: each adapter returns a
 * plain `Record<string, unknown>` and is the only place that needs to know
 * the source-entity shape. New entity types only require adding a group to
 * {@link CARD_FIELD_GROUPS} and a normaliser below.
 */
export const entityNormalisers: Record<CardEntityKind, (raw: any) => CardEntityPayload> = {
  spell: (raw: CampaignSpellListItem | CampaignSpellDetail): CardEntityPayload => ({
    kind: 'spell',
    sourceId: raw.id,
    data: {
      name: raw.name,
      school: 'school' in raw ? raw.school : '',
      level: 'level' in raw ? raw.level : '',
      castingTime: 'castingTime' in raw ? raw.castingTime : '',
      range: 'range' in raw ? raw.range : '',
      duration: 'duration' in raw ? raw.duration : '',
      components: 'components' in raw ? raw.components : '',
      materials: 'materials' in raw ? raw.materials ?? '' : '',
      classes: 'classes' in raw && raw.classes ? raw.classes.join(', ') : '',
      savingThrow: 'savingThrow' in raw ? raw.savingThrow ?? '' : '',
      areaOfEffect: 'areaOfEffect' in raw ? raw.areaOfEffect ?? '' : '',
      description: 'description' in raw ? raw.description ?? '' : '',
      source: 'origin' in raw ? raw.origin : 'manual',
    },
  }),
  trait: (raw: CampaignTraitListItem | CampaignTraitDetail): CardEntityPayload => ({
    kind: 'trait',
    sourceId: raw.id,
    data: {
      name: raw.name,
      description: raw.description ?? '',
      source: raw.origin ?? 'manual',
    },
  }),
  feat: (raw: CampaignFeatListItem | CampaignFeatDetail): CardEntityPayload => ({
    kind: 'feat',
    sourceId: raw.id,
    data: {
      name: raw.name,
      prerequisite: 'prerequisite' in raw ? raw.prerequisite ?? '' : '',
      description: 'description' in raw ? raw.description ?? '' : '',
      source: raw.origin ?? 'manual',
    },
  }),
  monster: (raw: CampaignMonsterListItem | CampaignMonsterDetail): CardEntityPayload => ({
    kind: 'monster',
    sourceId: raw.id,
    data: {
      name: raw.name,
      size: raw.size ?? '',
      type: raw.type ?? '',
      alignment: raw.alignment ?? '',
      challengeRating: raw.challengeRating ?? '',
      armorClass: (raw as any).armorClass ?? '',
      hitPoints: (raw as any).hitPoints ?? '',
      speed: (raw as any).speed ?? '',
      abilities: (raw as any).abilities ?? {},
      description: (raw as any).description ?? '',
      source: raw.origin ?? 'manual',
      // Image fields — the user said not every monster carries images so we
      // expose multiple resolutions and pick the highest available by default.
      image: raw.imageUrls?.high ?? raw.imageUrls?.medium ?? raw.imageUrls?.low ?? '',
      imageHigh: raw.imageUrls?.high ?? '',
      imageMedium: raw.imageUrls?.medium ?? '',
      tokenImageUrl: raw.tokenImageUrl ?? '',
    },
  }),
  character: (raw: CharacterPayload): CardEntityPayload => ({
    kind: 'character',
    sourceId: raw.id ?? '',
    data: {
      name: raw.name ?? '',
      className: raw.className ?? '',
      subclassName: (raw as any).subclassName ?? '',
      level: raw.level ?? '',
      race: raw.race ?? '',
      background: raw.background ?? '',
      alignment: raw.alignment ?? '',
      strength: raw.str ?? '',
      dexterity: raw.dex ?? '',
      constitution: raw.con ?? '',
      intelligence: raw.int ?? '',
      wisdom: raw.wis ?? '',
      charisma: raw.cha ?? '',
      armorClass: raw.armorClass ?? '',
      initiative: raw.initiative ?? '',
      speed: raw.speed ?? '',
      maxHp: raw.maxHp ?? '',
      currentHp: raw.currentHp ?? '',
      // Characters don't have a literal `description` column; surface the
      // most narrative-feeling free-text field a user typically binds to
      // "description" so the bulk generator matches the editor preview.
      description: raw.backstory ?? raw.traitsAndFeatures ?? raw.equipment ?? '',
      // Image fields — characterImageUrl is the canonical image; fall back
      // to the first characterImages entry's URL when it's missing.
      image: raw.characterImageUrl ?? raw.characterImages?.find((img) => img.isDefault)?.url ?? raw.characterImages?.[0]?.url ?? '',
      characterImageUrl: raw.characterImageUrl ?? '',
      tokenImageUrl: raw.tokenImageUrl ?? '',
    },
  }),
  'shop-item': (raw: any): CardEntityPayload => ({
    kind: 'shop-item',
    sourceId: String(raw?.id ?? ''),
    data: {
      name: raw?.name ?? '',
      price: raw?.price ?? '',
      currency: raw?.currency ?? 'gp',
      rarity: raw?.rarity ?? '',
      category: raw?.category ?? '',
      description: raw?.description ?? '',
      weight: raw?.weight ?? '',
      source: raw?.source ?? 'shop',
    },
  }),
};
