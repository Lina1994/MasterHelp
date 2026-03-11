import React, { useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

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
  /** Comma-separated feature/trait names for this level (e.g. "Ataque extra, Movimiento veloz"). */
  features: string;
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
      features: '',
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

/** Shared style for feature text native inputs inside table cells. */
const featInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 230,
  fontSize: '0.78rem',
  padding: '3px 6px',
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
  featurePlaceholder,
}: {
  lvl: number;
  row: LevelRowState;
  onField: (level: number, field: keyof Omit<LevelRowState, 'spellSlots'>, val: string) => void;
  onSlot: (level: number, slot: SpellSlotLevel, val: string) => void;
  featurePlaceholder: string;
}) {
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

      {/* Features */}
      <TableCell>
        <input
          style={featInputStyle}
          value={row.features}
          placeholder={featurePlaceholder}
          onChange={(e) => onField(lvl, 'features', e.target.value)}
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
 * - Features / Rasgos (comma-separated names)
 * - Cantrips Known (Trucos)
 * - Spells Known (Hechizos conocidos)
 * - Spell Slots for each spell level 1 through 9
 *
 * Native `<input>` elements are used instead of MUI TextField to keep
 * initial render fast (280 inputs would otherwise instantiate ~1400 MUI
 * sub-components).
 *
 * @param value    - Current state for all 20 levels.
 * @param onChange - Callback invoked when any cell value changes.
 */
export default function ClassLevelProgressionEditor({
  value,
  onChange,
}: ClassLevelProgressionEditorProps) {
  const { t } = useTranslation();

  const updateField = useCallback(
    (level: number, field: keyof Omit<LevelRowState, 'spellSlots'>, val: string) => {
      onChange((prev: LevelProgressionState) => ({
        ...prev,
        [level]: { ...prev[level], [field]: val },
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

  const featurePlaceholder = t('features_placeholder', 'p.ej. Ataque extra, Movimiento veloz');

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t(
          'level_progression_hint',
          'Define los rasgos, modificador de competencia y progresión de hechizos para cada nivel de clase. Los rasgos se separan por coma. Deja en blanco los campos que no apliquen.',
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
              <TableCell sx={{ fontWeight: 700, minWidth: 260 }}>
                {t('level_features_label', 'Rasgos (separados por coma)')}
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
                featurePlaceholder={featurePlaceholder}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
