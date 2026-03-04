/**
 * charSheetShared.tsx
 *
 * Shared helpers, constants and presentational sub-components used by both
 * CharacterDetailPage (full route) and CharacterSheetModal (inline dialog).
 */

import React from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Computes the ability modifier string for a given score (e.g. "+2", "-1").
 * @param score - Ability score (e.g. 10, 14, 8).
 */
export const abilityMod = (score: number | undefined): string => {
  if (score === undefined || score === null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

/**
 * Returns the numeric ability modifier for a given score.
 * @param score - Ability score (e.g. 10, 14, 8).
 * @returns Numeric modifier (e.g. 0, 2, -1).
 */
export const abilityModNum = (score: number | undefined): number => {
  if (score === undefined || score === null) return 0;
  return Math.floor((score - 10) / 2);
};

/**
 * Formats a numeric modifier with a sign prefix.
 * @param mod - Numeric modifier.
 * @returns Formatted string (e.g. "+2", "-1", "+0").
 */
export const formatMod = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);

/**
 * Extracts up to two initials from a name string.
 * @param name - The name to extract initials from.
 */
export const getInitials = (name: string | undefined | null): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
  return (a + b).toUpperCase();
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** The six D&D ability score keys. */
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/**
 * D&D 5e skill definitions: internal key, i18n label key with Spanish fallback,
 * and the governing ability.
 */
export const SKILL_DEFS: {
  key: string;
  labelKey: string;
  fallback: string;
  ability: typeof ABILITY_KEYS[number];
}[] = [
  { key: 'acrobatics',     labelKey: 'skill_acrobatics',      fallback: 'Acrobacias',        ability: 'dex' },
  { key: 'athletics',      labelKey: 'skill_athletics',       fallback: 'Atletismo',         ability: 'str' },
  { key: 'arcana',         labelKey: 'skill_arcana',          fallback: 'C. Arcano',         ability: 'int' },
  { key: 'deception',      labelKey: 'skill_deception',       fallback: 'Engaño',            ability: 'cha' },
  { key: 'history',        labelKey: 'skill_history',         fallback: 'Historia',          ability: 'int' },
  { key: 'performance',    labelKey: 'skill_performance',     fallback: 'Interpretación',    ability: 'cha' },
  { key: 'intimidation',   labelKey: 'skill_intimidation',    fallback: 'Intimidación',      ability: 'cha' },
  { key: 'investigation',  labelKey: 'skill_investigation',   fallback: 'Investigación',     ability: 'int' },
  { key: 'sleightOfHand',  labelKey: 'skill_sleight_of_hand', fallback: 'Juego de Manos',    ability: 'dex' },
  { key: 'medicine',       labelKey: 'skill_medicine',        fallback: 'Medicina',          ability: 'wis' },
  { key: 'nature',         labelKey: 'skill_nature',          fallback: 'Naturaleza',        ability: 'int' },
  { key: 'perception',     labelKey: 'skill_perception',      fallback: 'Percepción',        ability: 'wis' },
  { key: 'insight',        labelKey: 'skill_insight',         fallback: 'Perspicacia',       ability: 'wis' },
  { key: 'persuasion',     labelKey: 'skill_persuasion',      fallback: 'Persuasión',        ability: 'cha' },
  { key: 'religion',       labelKey: 'skill_religion',        fallback: 'Religión',          ability: 'int' },
  { key: 'stealth',        labelKey: 'skill_stealth',         fallback: 'Sigilo',            ability: 'dex' },
  { key: 'survival',       labelKey: 'skill_survival',        fallback: 'Supervivencia',     ability: 'wis' },
  { key: 'animalHandling', labelKey: 'skill_animal_handling', fallback: 'T. con Animales',   ability: 'wis' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * AbilityBlock
 *
 * Renders one ability score in the classic D&D vertical style:
 * abbreviation on top, modifier large, score small below.
 */
export const AbilityBlock: React.FC<{ label: string; score: number | undefined }> = ({ label, score }) => (
  <Paper
    variant="outlined"
    sx={{
      width: 72,
      textAlign: 'center',
      py: 1,
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
    }}
  >
    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.65rem' }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
      {abilityMod(score)}
    </Typography>
    <Paper
      variant="outlined"
      sx={{
        width: 32,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        mt: 0.25,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
        {score ?? '—'}
      </Typography>
    </Paper>
  </Paper>
);

/**
 * StatBox
 *
 * A compact stat box used for AC / Initiative / Speed.
 */
export const StatBox: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      textAlign: 'center',
      py: 1.5,
      px: 1,
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.5,
    }}
  >
    {icon}
    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 0.5 }}>
      {label}
    </Typography>
  </Paper>
);

/**
 * HpBar
 *
 * Horizontal HP bar showing current / max, plus temp HP if any.
 */
export const HpBar: React.FC<{ current?: number; max?: number; temp?: number }> = ({ current, max, temp }) => {
  const cur = current ?? 0;
  const mx = max ?? 1;
  const pct = Math.max(0, Math.min(100, (cur / mx) * 100));
  const color = pct > 50 ? 'success.main' : pct > 25 ? 'warning.main' : 'error.main';
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Hit Points
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {cur} / {mx}
          {(temp ?? 0) > 0 && (
            <Typography component="span" variant="body2" color="info.main" sx={{ ml: 0.5 }}>
              (+{temp} temp)
            </Typography>
          )}
        </Typography>
      </Stack>
      <Box sx={{ width: '100%', height: 8, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 1, transition: 'width .3s' }} />
      </Box>
    </Paper>
  );
};

/**
 * SheetSection
 *
 * A labeled section card with a primary-colour title stripe.
 */
export const SheetSection: React.FC<{ title: string; children?: React.ReactNode; noPadding?: boolean }> = ({ title, children, noPadding }) => (
  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
    <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
        {title}
      </Typography>
    </Box>
    <Box sx={noPadding ? {} : { p: 1.5 }}>
      {children}
    </Box>
  </Paper>
);

/**
 * SheetRow
 *
 * A simple key→value row for the sheet.
 */
export const SheetRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
    <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }} color="text.secondary">{label}</Typography>
    <Typography variant="body2">{value || '—'}</Typography>
  </Stack>
);

/**
 * ReadOnlyProficiencyRow
 *
 * Read-only proficiency row for saving throws / skills.
 * Shows a filled/empty circle, the modifier, and the label.
 */
export const ReadOnlyProficiencyRow: React.FC<{
  label: string;
  proficient: boolean;
  modifier: number;
}> = ({ label, proficient, modifier }) => (
  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.15 }}>
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: '1.5px solid',
        borderColor: 'text.secondary',
        bgcolor: proficient ? 'text.primary' : 'transparent',
        flexShrink: 0,
      }}
    />
    <Typography
      variant="body2"
      sx={{ width: 32, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}
    >
      {formatMod(modifier)}
    </Typography>
    <Typography variant="body2" sx={{ fontSize: '0.8rem', ml: 0.5 }}>
      {label}
    </Typography>
  </Stack>
);

/**
 * SpellInfoRow
 *
 * A small labelled row used inside the spell detail dialog.
 */
export const SpellInfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
      <Typography variant="body2" sx={{ minWidth: 130, fontWeight: 600 }} color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
};
