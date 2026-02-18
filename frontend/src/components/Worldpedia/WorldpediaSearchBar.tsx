import { useCallback, useState } from 'react';
import { InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useCampaignId } from '../../hooks/useCampaignId';
import { searchNotes, type WorldpediaNoteLight } from '../../api/worldpedia/worldpediaApi';
import { Autocomplete } from '@mui/material';

interface Props {
  onSelect: (note: WorldpediaNoteLight) => void;
}

/**
 * Debounced search bar that queries notes by title/content.
 */
export default function WorldpediaSearchBar({ onSelect }: Props) {
  const { t } = useTranslation();
  const campaignId = useCampaignId();
  const [options, setOptions] = useState<WorldpediaNoteLight[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback(
    async (_: unknown, value: string) => {
      setInputValue(value);
      if (!campaignId || value.trim().length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const results = await searchNotes(campaignId, value.trim());
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [campaignId],
  );

  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.title)}
      loading={loading}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(_, value) => {
        if (value && typeof value !== 'string') {
          onSelect(value);
          setInputValue('');
          setOptions([]);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('worldpedia_search', 'Search notes…')}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}
    />
  );
}
