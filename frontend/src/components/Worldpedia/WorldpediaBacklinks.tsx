import { Box, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { WorldpediaBacklink } from '../../api/worldpedia/worldpediaApi';

interface Props {
  backlinks: WorldpediaBacklink[];
  onNavigateNote: (noteId: string) => void;
}

/**
 * Displays a list of notes that link to the current note (backlinks).
 */
export default function WorldpediaBacklinks({ backlinks, onNavigateNote }: Props) {
  const { t } = useTranslation();

  if (!backlinks.length) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {t('worldpedia_backlinks', 'Backlinks')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {backlinks.map((bl) => (
          <Chip
            key={bl.id}
            label={bl.note?.title ?? bl.noteId}
            size="small"
            color="info"
            variant="outlined"
            clickable
            onClick={() => onNavigateNote(bl.noteId)}
          />
        ))}
      </Stack>
    </Box>
  );
}
