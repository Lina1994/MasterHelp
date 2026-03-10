import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Chip,
  CircularProgress,
  TextField,
  Tooltip,
  Typography,
  Box,
  createFilterOptions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { listCampaignTraits, CampaignTraitListItem } from '../../api/traits/traitsApi';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';

/* ───────────────────────── types ───────────────────────── */

/** Represents an option in the autocomplete dropdown. */
interface TraitOption {
  /** Display label (trait name). */
  label: string;
  /** Short description for tooltip. */
  description?: string;
  /** Whether this option was typed freely by the user (not from the API). */
  isCustom?: boolean;
}

export interface TraitAutocompleteProps {
  /** Campaign ID used to fetch the trait catalogue. */
  campaignId: string;
  /** Currently selected trait names. */
  value: string[];
  /** Callback when the selection changes. */
  onChange: (traits: string[]) => void;
  /** TextField label. */
  label?: string;
  /** TextField size variant. */
  size?: 'small' | 'medium';
}

/**
 * MUI filter factory configured to also offer a "create" option
 * when the user types a name that doesn't match any catalogue trait.
 */
const filterOptions = createFilterOptions<TraitOption>({
  matchFrom: 'any',
  stringify: (opt) => opt.label,
});

/**
 * Multi-select Autocomplete that lets users pick traits from the campaign
 * catalogue **and** type custom trait names that are not in the list.
 *
 * - Fetches all traits from the campaign API.
 * - Shows trait name in the dropdown with description on hover.
 * - Supports free-text entry (freeSolo) so the user can add homebrew names.
 * - Typing filters the dropdown list in real time.
 */
export const TraitAutocomplete: React.FC<TraitAutocompleteProps> = ({
  campaignId: campaignIdProp,
  value,
  onChange,
  label,
  size = 'small',
}) => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = campaignIdProp || activeCampaign?.id || '';
  const [catalogueTraits, setCatalogueTraits] = useState<CampaignTraitListItem[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── fetch all traits ── */
  useEffect(() => {
    let cancelled = false;
    if (!campaignId) return;

    setLoading(true);
    const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';

    listCampaignTraits(
      campaignId,
      { pageSize: 9999, sort: 'name' },
      lang,
    )
      .then((res: { items: CampaignTraitListItem[] }) => {
        if (!cancelled) {
          setCatalogueTraits(res.items ?? []);
        }
      })
      .catch((err) => {
        console.error('[TraitAutocomplete] Failed to load traits:', err?.response?.data ?? err);
        if (!cancelled) setCatalogueTraits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [campaignId, i18n.language]);

  /* ── build option list ── */
  const options: TraitOption[] = useMemo(
    () =>
      catalogueTraits.map((t) => ({
        label: t.name,
        description: t.description,
      })),
    [catalogueTraits],
  );

  /* ── map current string[] values to TraitOption[] ── */
  const selectedOptions: TraitOption[] = useMemo(
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
    <Autocomplete<TraitOption, true, false, true>
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
        const content = (
          <Box
            component="li"
            key={key ?? option.label}
            {...rest}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
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
              title={option.description.length > 200 ? option.description.slice(0, 200) + '…' : option.description}
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
          const traitName = typeof option === 'string' ? option : option.label;
          const desc = typeof option !== 'string' ? option.description : undefined;
          const chip = (
            <Chip
              key={key}
              size="small"
              label={traitName}
              {...rest}
            />
          );
          if (desc) {
            return (
              <Tooltip key={key} title={desc.length > 200 ? desc.slice(0, 200) + '…' : desc} arrow>
                {chip}
              </Tooltip>
            );
          }
          return chip;
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
