import { TextField, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ManualEntryType } from '../../../api/customManuals';

interface SimpleEntryFormProps {
  entryType: ManualEntryType;
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Form for simple entry types: feat, trait, skill.
 * All share name + description; feat adds prerequisite, skill adds ability.
 */
export default function SimpleEntryForm({ entryType, data, onChange }: SimpleEntryFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  return (
    <>
      <TextField
        label={t('manuals_entry_name')}
        value={data.name ?? ''}
        onChange={e => set('name', e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      {entryType === 'feat' && (
        <TextField
          label={t('manuals_entry_prerequisite')}
          value={data.prerequisite ?? ''}
          onChange={e => set('prerequisite', e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
      )}

      {entryType === 'skill' && (
        <TextField
          label={t('manuals_entry_ability')}
          value={data.ability ?? ''}
          onChange={e => set('ability', e.target.value)}
          select
          fullWidth
          sx={{ mb: 2 }}
        >
          {ABILITIES.map(ab => (
            <MenuItem key={ab} value={ab}>{ab.toUpperCase()}</MenuItem>
          ))}
        </TextField>
      )}

      <TextField
        label={t('manuals_field_description')}
        value={data.description ?? ''}
        onChange={e => set('description', e.target.value)}
        fullWidth
        multiline
        minRows={4}
      />
    </>
  );
}
