import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  createFilterOptions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { listCampaignTraits, CampaignTraitListItem } from '../../api/traits/traitsApi';

/** A feature/trait entry stored in editor state — preserves description alongside the name. */
export interface FeatureEntry {
  name: string;
  description?: string;
}

/** Option shape for the feature/trait autocomplete in each level row. */
interface TraitOption {
  label: string;
  description?: string;
  isCustom?: boolean;
}

const filterTraitOptions = createFilterOptions<TraitOption>({
  matchFrom: 'any',
  stringify: (opt) => opt.label,
});

/** Spell slot levels supported by D&D 5e (1 through 9). */
export const SPELL_SLOT_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type SpellSlotLevel = typeof SPELL_SLOT_LEVELS[number];

/** Default proficiency bonus per character level (D&D 5e standard). */
export const DEFAULT_PB: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6,
};

/**
 * Mutable state for a single class level row.
 * All numeric values are stored as strings to support blank (empty) inputs.
 */
export interface LevelRowState {
  /** Proficiency bonus value as a string (e.g. "2"). */
  proficiencyBonus: string;
  /** Feature/trait entries for this level. Each entry stores name and optional description. */
  features: FeatureEntry[];
  /** Number of cantrips known at this level, or '' if not applicable. */
  cantripsKnown: string;
  /** Number of spells known at this level, or '' if not applicable. */
  knownSpellsCount: string;
  /** Spell slot counts per spell level (1–9), or '' if not applicable. */
  spellSlots: Record<SpellSlotLevel, string>;
}

/** Map from class level (1–20) to its editable row state. */
export type LevelProgressionState = Record<number, LevelRowState>;

/**
 * Creates a default level progression state with standard D&D 5e proficiency bonuses
 * and all other fields blank.
 *
 * @returns A `LevelProgressionState` covering levels 1 through 20.
 */
export function createDefaultLevelProgression(): LevelProgressionState {
  const state: LevelProgressionState = {};
  for (let lvl = 1; lvl <= 20; lvl++) {
    state[lvl] = {
      proficiencyBonus: String(DEFAULT_PB[lvl]),
      features: [],
      cantripsKnown: '',
      knownSpellsCount: '',
      spellSlots: Object.fromEntries(
        SPELL_SLOT_LEVELS.map((k) => [k, '']),
      ) as Record<SpellSlotLevel, string>,
    };
  }
  return state;
}

interface ClassLevelProgressionEditorProps {
  /** Current progression state for all 20 levels. */
  value: LevelProgressionState;
  /** Callback invoked whenever any cell value changes. Receives either the next state or a functional updater. */
  onChange: (next: LevelProgressionState | ((prev: LevelProgressionState) => LevelProgressionState)) => void;
  /** Campaign ID used to fetch the trait catalogue for the features autocomplete. */
  campaignId?: string;
}

const NUM_CELL_SX = {
  position: 'sticky' as const,
} as const; // unused — kept for reference, native inputs are used instead

const STICKY_COL_SX = {
  position: 'sticky',
  left: 0,
  bgcolor: 'background.paper',
  zIndex: 2,
} as const;

/** Shared style for numeric native inputs inside table cells. */
const numInputStyle: React.CSSProperties = {
  width: 44,
  textAlign: 'center',
  fontSize: '0.78rem',
  padding: '3px 2px',
  border: '1px solid rgba(0,0,0,0.23)',
  borderRadius: 4,
  background: 'transparent',
  outline: 'none',
  color: 'inherit',
};

/**
 * Single memoised row to avoid re-rendering all 20 rows on every keystroke.
 */
const LevelRow = React.memo(function LevelRow({
  lvl,
  row,
  onField,
  onSlot,
  onFeatures,
  traitOptions,
  featurePlaceholder,
}: {
  lvl: number;
  row: LevelRowState;
  onField: (level: number, field: keyof Omit<LevelRowState, 'spellSlots' | 'features'>, val: string) => void;
  onSlot: (level: number, slot: SpellSlotLevel, val: string) => void;
  onFeatures: (level: number, features: FeatureEntry[]) => void;
  traitOptions: TraitOption[];
  featurePlaceholder: string;
}) {
  const selectedOptions: TraitOption[] = useMemo(
    () =>
      row.features.map((entry) => {
        const found = traitOptions.find(
          (o) => o.label.toLowerCase() === entry.name.toLowerCase(),
        );
        // Prefer catalogue data but fall back to stored description for custom entries
        return found ?? { label: entry.name, description: entry.description, isCustom: true };
      }),
    [row.features, traitOptions],
  );

  return (
    <TableRow hover>
      <TableCell align="center" sx={{ fontWeight: 700, ...STICKY_COL_SX }}>
        {lvl}
      </TableCell>

      {/* Proficiency Bonus */}
      <TableCell align="center">
        <input
          style={numInputStyle}
          inputMode="numeric"
          value={row.proficiencyBonus}
          onChange={(e) => onField(lvl, 'proficiencyBonus', e.target.value)}
        />
      </TableCell>

      {/* Features — multi freeSolo Autocomplete */}
      <TableCell sx={{ minWidth: 280, py: 0.5 }}>
        <Autocomplete<TraitOption, true, false, true>
          multiple
          freeSolo
          forcePopupIcon
          openOnFocus
          size="small"
          options={traitOptions}
          value={selectedOptions}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
          isOptionEqualToValue={(opt, val) =>
            opt.label.toLowerCase() === val.label.toLowerCase()
          }
          filterOptions={(opts, state) => {
            const filtered = filterTraitOptions(opts, state);
            if (
              state.inputValue &&
              !filtered.some(
                (o) => o.label.toLowerCase() === state.inputValue.toLowerCase(),
              )
            ) {
              filtered.push({ label: state.inputValue, isCustom: true });
            }
            return filtered;
          }}
          onChange={(_e, newValue) => {
            onFeatures(
              lvl,
              newValue.map((v): FeatureEntry =>
                typeof v === 'string'
                  ? { name: v }
                  : { name: v.label, description: v.description },
              ),
            );
          }}
          renderOption={(props, option) => {
            const { key, ...rest } = props as any;
            const content = (
              <Box
                component="li"
                key={key ?? option.label}
                {...rest}
                sx={{ display: 'flex', gap: 1 }}
              >
                <Typography variant="body2">
                  {option.isCustom ? `+ "${option.label}"` : option.label}
                </Typography>
              </Box>
            );
            if (option.description && !option.isCustom) {
              return (
                <Tooltip
                  key={key ?? option.label}
                  title={
                    option.description.length > 200
                      ? option.description.slice(0, 200) + '…'
                      : option.description
                  }
                  placement="right"
                  arrow
                >
                  {content}
                </Tooltip>
              );
            }
            return content;
          }}
          renderTags={(tagValues, getTagProps) =>
            tagValues.map((option, idx) => {
              const { key, ...rest } = getTagProps({ index: idx });
              const label = typeof option === 'string' ? option : option.label;
              return <Chip key={key} size="small" label={label} {...rest} />;
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder={featurePlaceholder}
              sx={{ '& .MuiInputBase-root': { fontSize: '0.78rem' } }}
            />
          )}
        />
      </TableCell>

      {/* Cantrips Known */}
      <TableCell align="center">
        <input
          style={numInputStyle}
          inputMode="numeric"
          placeholder="-"
          value={row.cantripsKnown}
          onChange={(e) => onField(lvl, 'cantripsKnown', e.target.value)}
        />
      </TableCell>

      {/* Spells Known */}
      <TableCell align="center">
        <input
          style={numInputStyle}
          inputMode="numeric"
          placeholder="-"
          value={row.knownSpellsCount}
          onChange={(e) => onField(lvl, 'knownSpellsCount', e.target.value)}
        />
      </TableCell>

      {/* Spell Slots per spell level */}
      {SPELL_SLOT_LEVELS.map((k) => (
        <TableCell key={k} align="center">
          <input
            style={numInputStyle}
            inputMode="numeric"
            placeholder="-"
            value={row.spellSlots[k]}
            onChange={(e) => onSlot(lvl, k, e.target.value)}
          />
        </TableCell>
      ))}
    </TableRow>
  );
});

/**
 * Editable table for D&D 5e class level progression (levels 1–20).
 *
 * Each row exposes:
 * - Proficiency Bonus (PB)
 * - Features / Rasgos (multi-select autocomplete with campaign traits + free text)
 * - Cantrips Known (Trucos)
 * - Spells Known (Hechizos conocidos)
 * - Spell Slots for each spell level 1 through 9
 *
 * Native `<input>` elements are used for numeric fields. An MUI Autocomplete
 * is used for the features column so users can pick from the campaign trait
 * catalogue or type custom names freely.
 *
 * @param value      - Current state for all 20 levels.
 * @param onChange   - Callback invoked when any cell value changes.
 * @param campaignId - Campaign ID used to fetch the trait catalogue.
 */
export default function ClassLevelProgressionEditor({
  value,
  onChange,
  campaignId,
}: ClassLevelProgressionEditorProps) {
  const { t, i18n } = useTranslation();
  const [catalogueTraits, setCatalogueTraits] = useState<CampaignTraitListItem[]>([]);

  /* ── fetch campaign traits once ── */
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
    listCampaignTraits(campaignId, { pageSize: 9999, sort: 'name' }, lang)
      .then((res) => { if (!cancelled) setCatalogueTraits(res.items ?? []); })
      .catch(() => { if (!cancelled) setCatalogueTraits([]); });
    return () => { cancelled = true; };
  }, [campaignId, i18n.language]);

  const traitOptions: TraitOption[] = useMemo(
    () => catalogueTraits.map((tr) => ({ label: tr.name, description: tr.description })),
    [catalogueTraits],
  );

  const updateField = useCallback(
    (level: number, field: keyof Omit<LevelRowState, 'spellSlots' | 'features'>, val: string) => {
      onChange((prev: LevelProgressionState) => ({
        ...prev,
        [level]: { ...prev[level], [field]: val },
      }));
    },
    [onChange],
  );

  const updateFeatures = useCallback(
    (level: number, features: FeatureEntry[]) => {
      onChange((prev: LevelProgressionState) => ({
        ...prev,
        [level]: { ...prev[level], features },
      }));
    },
    [onChange],
  );

  const updateSlot = useCallback(
    (level: number, slot: SpellSlotLevel, val: string) => {
      onChange((prev: LevelProgressionState) => ({
        ...prev,
        [level]: {
          ...prev[level],
          spellSlots: { ...prev[level].spellSlots, [slot]: val },
        },
      }));
    },
    [onChange],
  );

  const featurePlaceholder = t('features_placeholder', 'Ej: Ataque extra');

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t(
          'level_progression_hint',
          'Define los rasgos, modificador de competencia y progresión de hechizos para cada nivel de clase. Puedes elegir rasgos del catálogo de la campaña o escribir nombres personalizados libremente. Deja en blanco los campos que no apliquen.',
        )}
      </Typography>
      <TableContainer sx={{ maxHeight: 500, overflowX: 'auto' }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell
                align="center"
                sx={{ fontWeight: 700, minWidth: 40, ...STICKY_COL_SX, zIndex: 4 }}
              >
                {t('level_abbrev', 'Niv')}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 60 }}>
                PB
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>
                {t('level_features_label', 'Rasgos')}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 68 }}>
                {t('cantrips_known', 'Trucos')}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80 }}>
                {t('spells_known', 'Hechizos')}
              </TableCell>
              {SPELL_SLOT_LEVELS.map((k) => (
                <TableCell key={k} align="center" sx={{ fontWeight: 700, minWidth: 48 }}>
                  {t('spell_slot_label', 'N{{n}}', { n: k })}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
              <LevelRow
                key={lvl}
                lvl={lvl}
                row={value[lvl]}
                onField={updateField}
                onSlot={updateSlot}
                onFeatures={updateFeatures}
                traitOptions={traitOptions}
                featurePlaceholder={featurePlaceholder}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
