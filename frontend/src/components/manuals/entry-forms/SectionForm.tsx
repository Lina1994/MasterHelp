import { TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SectionFormProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

/**
 * Form for section entries: title + content (markdown/free text).
 */
export default function SectionForm({ data, onChange }: SectionFormProps) {
  const { t } = useTranslation();

  const set = (key: string, value: string) => onChange({ ...data, [key]: value });

  return (
    <>
      <TextField
        label={t('manuals_field_title')}
        value={data.title ?? ''}
        onChange={e => set('title', e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />
      <TextField
        label={t('manuals_entry_content')}
        value={data.content ?? ''}
        onChange={e => set('content', e.target.value)}
        fullWidth
        multiline
        minRows={8}
        placeholder={t('manuals_entry_content_hint')}
      />
    </>
  );
}
