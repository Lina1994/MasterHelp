import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Chip,
  CircularProgress,
  TextField,
  Typography,
  Box,
  createFilterOptions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  listCampaignSpells,
  CampaignSpellListItem,
} from '../../api/spells/spellsApi';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useManualNames } from '../../hooks/useManualNames';

/* ───────────────────────── types ───────────────────────── */

/** Represents an option in the autocomplete dropdown. */
interface SpellOption {
  /** Display label (spell name). */
  label: string;
  /** School of magic (for secondary info). */
  school?: string;
  /** Manual ID the spell comes from (for disambiguation). */
  sourceManual?: string | null;
  /** Whether this option was typed freely by the user (not from the API). */
  isCustom?: boolean;
}

export interface SpellAutocompleteProps {
  /** Campaign ID used to fetch the spell catalogue. */
  campaignId: string;
  /** Spell level to filter by (0 = cantrips). */
  spellLevel: number;
  /** Currently selected spell names. */
  value: string[];
  /** Callback when the selection changes. */
  onChange: (spells: string[]) => void;
  /** TextField label. */
  label?: string;
  /** TextField size variant. */
  size?: 'small' | 'medium';
}

/**
 * MUI filter factory configured to also offer a "create" option
 * when the user types a name that doesn't match any catalogue spell.
 */
const filterOptions = createFilterOptions<SpellOption>({
  matchFrom: 'any',
  stringify: (opt) => opt.label,
});

/**
 * Multi-select Autocomplete that lets users pick spells from the campaign
 * catalogue **and** type custom spell names that are not in the list.
 *
 * - Fetches all spells from the campaign API for the given `spellLevel`.
 * - Shows spell name + school in the dropdown.
 * - Supports free-text entry (freeSolo) so the user can add homebrew names.
 * - Typing filters the dropdown list in real time.
 */
export const SpellAutocomplete: React.FC<SpellAutocompleteProps> = ({
  campaignId: campaignIdProp,
  spellLevel,
  value,
  onChange,
  label,
  size = 'small',
}) => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const { getManualName } = useManualNames();
  const campaignId = campaignIdProp || activeCampaign?.id || '';
  const [catalogueSpells, setCatalogueSpells] = useState<CampaignSpellListItem[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── fetch all spells for the given level ── */
  useEffect(() => {
    let cancelled = false;
    if (!campaignId) {
      console.warn('[SpellAutocomplete] No campaignId available — skipping fetch');
      return;
    }

    setLoading(true);
    const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';

    listCampaignSpells(
      campaignId,
      { level: String(spellLevel), pageSize: 9999, sort: 'name' },
      lang,
    )
      .then((res: { items: CampaignSpellListItem[] }) => {
        if (!cancelled) {
          const items = res.items ?? [];
          setCatalogueSpells(items);
        }
      })
      .catch((err) => {
        console.error('[SpellAutocomplete] Failed to load spells:', err?.response?.data ?? err);
        if (!cancelled) setCatalogueSpells([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, spellLevel, i18n.language]);

  /* ── build option list ── */
  const options: SpellOption[] = useMemo(
    () =>
      catalogueSpells.map((s) => ({
        label: s.name,
        school: s.school,
        sourceManual: s.sourceManual ?? null,
      })),
    [catalogueSpells],
  );

  /* ── map current string[] values to SpellOption[] ── */
  const selectedOptions: SpellOption[] = useMemo(
    () =>
      value.map((name) => {
        const found = options.find(
          (o) => o.label.toLowerCase() === name.toLowerCase(),
        );
        return found ?? { label: name, isCustom: true };
      }),
    [value, options],
  );

  return (
    <Autocomplete<SpellOption, true, false, true>
      multiple
      freeSolo
      forcePopupIcon
      openOnFocus
      size={size}
      loading={loading}
      options={options}
      value={selectedOptions}
      getOptionLabel={(opt) =>
        typeof opt === 'string' ? opt : opt.label
      }
      isOptionEqualToValue={(opt, val) =>
        opt.label.toLowerCase() === val.label.toLowerCase()
      }
      filterOptions={(opts, state) => {
        const filtered = filterOptions(opts, state);
        // If the user typed something and there's no exact match, offer creation
        if (
          state.inputValue &&
          !filtered.some(
            (o) =>
              o.label.toLowerCase() === state.inputValue.toLowerCase(),
          )
        ) {
          filtered.push({
            label: state.inputValue,
            isCustom: true,
          });
        }
        return filtered;
      }}
      onChange={(_e, newValue) => {
        const names = newValue.map((v) =>
          typeof v === 'string' ? v : v.label,
        );
        onChange(names);
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props as any;
        return (
          <Box
            component="li"
            key={key ?? option.label}
            {...rest}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="body2">
              {option.isCustom ? `+ "${option.label}"` : option.label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {option.school && !option.isCustom && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {option.school}
                </Typography>
              )}
              {option.sourceManual && !option.isCustom && (
                <Typography variant="caption" color="text.secondary">
                  ({getManualName(option.sourceManual)})
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderTags={(tagValues, getTagProps) =>
        tagValues.map((option, idx) => {
          const { key, ...rest } = getTagProps({ index: idx });
          return (
            <Chip
              key={key}
              size="small"
              label={typeof option === 'string' ? option : option.label}
              {...rest}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? '...' : ''}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};
