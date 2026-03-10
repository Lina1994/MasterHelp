import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Tooltip,
  Typography,
  createFilterOptions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { listCampaignFeats, CampaignFeatListItem } from '../../api/feats/featsApi';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';

/* ───────────────────────── types ───────────────────────── */

/** Represents an option in the autocomplete dropdown. */
interface FeatOption {
  /** Display label (feat name). */
  label: string;
  /** Prerequisite text shown as tooltip/secondary. */
  prerequisite?: string | null;
  /** Whether this option was typed freely by the user (not from the API). */
  isCustom?: boolean;
}

export interface FeatAutocompleteProps {
  /** Campaign ID used to fetch the feat catalogue. */
  campaignId: string;
  /** Currently selected feat names. */
  value: string[];
  /** Callback when the selection changes. */
  onChange: (feats: string[]) => void;
  /** TextField label. */
  label?: string;
  /** TextField size variant. */
  size?: 'small' | 'medium';
}

/**
 * MUI filter factory configured to also offer a "create" option
 * when the user types a name that doesn't match any catalogue feat.
 */
const filterOptions = createFilterOptions<FeatOption>({
  matchFrom: 'any',
  stringify: (opt) => opt.label,
});

/**
 * Multi-select Autocomplete that lets users pick feats from the campaign
 * catalogue **and** type custom feat names that are not in the list.
 *
 * - Fetches all feats from the campaign API.
 * - Shows feat name with prerequisite on hover.
 * - Supports free-text entry (freeSolo) so the user can add homebrew names.
 * - Typing filters the dropdown list in real time.
 */
export const FeatAutocomplete: React.FC<FeatAutocompleteProps> = ({
  campaignId: campaignIdProp,
  value,
  onChange,
  label,
  size = 'small',
}) => {
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = campaignIdProp || activeCampaign?.id || '';
  const [catalogueFeats, setCatalogueFeats] = useState<CampaignFeatListItem[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── fetch all feats ── */
  useEffect(() => {
    let cancelled = false;
    if (!campaignId) return;

    setLoading(true);
    const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';

    listCampaignFeats(
      campaignId,
      { pageSize: 9999, sort: 'name' },
      lang,
    )
      .then((res: { items: CampaignFeatListItem[] }) => {
        if (!cancelled) {
          setCatalogueFeats(res.items ?? []);
        }
      })
      .catch((err) => {
        console.error('[FeatAutocomplete] Failed to load feats:', err?.response?.data ?? err);
        if (!cancelled) setCatalogueFeats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [campaignId, i18n.language]);

  /* ── build option list ── */
  const options: FeatOption[] = useMemo(
    () =>
      catalogueFeats.map((f) => ({
        label: f.name,
        prerequisite: f.prerequisite,
      })),
    [catalogueFeats],
  );

  /* ── map current string[] values to FeatOption[] ── */
  const selectedOptions: FeatOption[] = useMemo(
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
    <Autocomplete<FeatOption, true, false, true>
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
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <Typography variant="body2">
              {option.isCustom ? `+ "${option.label}"` : option.label}
            </Typography>
            {option.prerequisite && !option.isCustom && (
              <Typography variant="caption" color="text.secondary">
                {option.prerequisite}
              </Typography>
            )}
          </Box>
        );
        if (option.prerequisite && !option.isCustom) {
          return (
            <Tooltip
              key={key ?? option.label}
              title={option.prerequisite}
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
          const featName = typeof option === 'string' ? option : option.label;
          const prereq = typeof option !== 'string' ? option.prerequisite : undefined;
          const chip = (
            <Chip
              key={key}
              size="small"
              label={featName}
              {...rest}
            />
          );
          if (prereq) {
            return (
              <Tooltip key={key} title={prereq} arrow>
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
