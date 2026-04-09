import { useParams, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, Stack, CircularProgress,
  Tabs, Tab, Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import {
  getManual, listEntries, createEntry, updateEntry, deleteEntry,
  type ManualDetail, type ManualEntry, type ManualEntryType,
} from '../api/customManuals';
import ManualMetadataForm from '../components/manuals/ManualMetadataForm';
import EntryListPanel from '../components/manuals/EntryListPanel';
import EntryEditorDialog from '../components/manuals/EntryEditorDialog';

const ENTRY_TYPES: ManualEntryType[] = [
  'section', 'monster', 'spell', 'class', 'race',
  'background', 'feat', 'trait', 'skill',
];

/**
 * Full editor page for a custom (DB) manual.
 * Includes metadata editing, tabbed entry types, and entry CRUD via dialogs.
 */
export default function ManualEditorPage() {
  const { t } = useTranslation();
  const { manualId } = useParams<{ manualId: string }>();
  const navigate = useNavigate();

  const [manual, setManual] = useState<ManualDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManualEntry | undefined>();
  const [hasCover, setHasCover] = useState(false);

  const currentType = ENTRY_TYPES[activeTab];

  const loadEntries = useCallback(() => {
    if (!manualId) return;
    listEntries(manualId, currentType)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [manualId, currentType]);

  useEffect(() => {
    if (!manualId) return;
    getManual(manualId)
      .then(m => {
        setManual(m);
        setHasCover(!!m.coverImageMimeType);
      })
      .catch(() => navigate('/manuals'))
      .finally(() => setLoading(false));
  }, [manualId, navigate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleAdd = () => {
    setEditingEntry(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (entry: ManualEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDelete = async (entry: ManualEntry) => {
    if (!manualId) return;
    const name = entry.data?.name ?? entry.entryKey;
    if (!window.confirm(t('manuals_entry_delete_confirm', { name }))) return;
    await deleteEntry(manualId, entry.id);
    loadEntries();
  };

  const handleSave = async (entryKey: string, lang: string, data: Record<string, any>) => {
    if (!manualId) return;
    if (editingEntry) {
      await updateEntry(manualId, editingEntry.id, { lang, data });
    } else {
      await createEntry(manualId, { entryType: currentType, entryKey, lang, data });
    }
    loadEntries();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (!manual) return null;

  return (
    <Box p={2}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate('/manuals')}>
          <ArrowBackIcon />
        </IconButton>
        <ManualMetadataForm
          manual={manual}
          hasCover={hasCover}
          onUpdated={setManual}
          onCoverChanged={() => {
            setHasCover(prev => !prev);
            getManual(manualId!).then(m => setHasCover(!!m.coverImageMimeType));
          }}
        />
      </Stack>

      <Paper variant="outlined" sx={{ mt: 1 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {ENTRY_TYPES.map(type => (
            <Tab key={type} label={t(`manuals_type_${type}`)} />
          ))}
        </Tabs>

        <Box p={2}>
          <EntryListPanel
            entries={entries}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Box>
      </Paper>

      <EntryEditorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        entry={editingEntry}
        entryType={currentType}
        languages={manual.languages ?? ['es']}
        onSave={handleSave}
      />
    </Box>
  );
}
