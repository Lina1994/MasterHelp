import {
  Box, List, ListItem, ListItemText, IconButton, Tooltip,
  Typography, Stack, Button, Divider, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ManualEntry } from '../../api/customManuals';

interface EntryListPanelProps {
  entries: ManualEntry[];
  onAdd: () => void;
  onEdit: (entry: ManualEntry) => void;
  onDelete: (entry: ManualEntry) => void;
}

/**
 * Displays a list of manual entries with add / edit / delete actions.
 * Used inside each tab of the ManualEditorPage.
 */
export default function EntryListPanel({ entries, onAdd, onEdit, onDelete }: EntryListPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = search
    ? entries.filter((e) => {
        const name = (e.data?.name ?? e.entryKey).toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : entries;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('manuals_entry_count', { count: entries.length })}
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
          {t('manuals_entry_add')}
        </Button>
      </Stack>

      {entries.length > 5 && (
        <TextField
          size="small"
          fullWidth
          placeholder={t('search', 'Buscar')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> } }}
          sx={{ mb: 1 }}
        />
      )}

      {filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {search ? t('no_results', 'Sin resultados') : t('manuals_entry_empty')}
        </Typography>
      )}

      <List disablePadding>
        {filtered.map((entry, idx) => (
          <Box key={entry.id}>
            {idx > 0 && <Divider />}
            <ListItem
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title={t('manuals_edit')}>
                    <IconButton size="small" onClick={() => onEdit(entry)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('delete')}>
                    <IconButton size="small" color="error" onClick={() => onDelete(entry)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
            >
              <ListItemText
                primary={entry.data?.name ?? entry.entryKey}
                secondary={`${entry.entryKey} · ${entry.lang}`}
              />
            </ListItem>
          </Box>
        ))}
      </List>
    </Box>
  );
}
