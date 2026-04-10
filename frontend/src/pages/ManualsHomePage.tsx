import { useCallback, useEffect, useState } from 'react';
import { api } from '../apiBase';
import {
  Box, Grid, Card, CardActionArea, CardContent, CardMedia, Typography,
  Button, IconButton, Tooltip, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createManual,
  deleteManual,
  downloadManualExport,
  importManual,
  getManualCoverUrl,
  type ManualSummary,
  type CreateManualDto,
  type ImportManualPayload,
} from '../api/customManuals';
import CreateManualDialog from '../components/manuals/CreateManualDialog';
import ImportManualDialog from '../components/manuals/ImportManualDialog';
import AuthImage from '../components/common/AuthImage';

export default function ManualsHomePage() {
  const { t } = useTranslation();
  const [list, setList] = useState<ManualSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();

  const loadManuals = useCallback(() => {
    api.get('/manuals').then(r => setList(r.data)).catch(() => setList([]));
  }, []);

  useEffect(() => { loadManuals(); }, [loadManuals]);

  const handleCreate = async (dto: CreateManualDto) => {
    await createManual(dto);
    loadManuals();
  };

  const handleImport = async (payload: ImportManualPayload) => {
    await importManual(payload);
    loadManuals();
  };

  const handleDelete = async (m: ManualSummary) => {
    if (!window.confirm(t('manuals_delete_confirm', { title: m.title }))) return;
    await deleteManual(m.id);
    loadManuals();
  };

  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{t('manuals_page_title')}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportOpen(true)}
          >
            {t('manuals_import')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            {t('manuals_create')}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} columns={12}>
        {list.map(m => {
          const editable = m.source === 'db';
          return (
            <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined">
                <CardActionArea
                  onClick={() => navigate(`/manuals/${m.id}`)}
                >
                  {m.hasCover && (
                    <Box sx={{ height: 160, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                      <AuthImage
                        src={getManualCoverUrl(m.id)}
                        alt={m.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  )}
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {!editable && (
                        <Tooltip title={t('manuals_readonly')}>
                          <LockIcon fontSize="small" color="action" />
                        </Tooltip>
                      )}
                      <Typography variant="h6">{m.title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {m.version ? `v${m.version}` : ''}
                      {m.licenseName ? ` · ${m.licenseName}` : ''}
                      {m.description ? ` — ${m.description}` : ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>

                {editable && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pb: 1, gap: 0.5 }}>
                    <Tooltip title={t('manuals_edit')}>
                      <IconButton size="small" onClick={() => navigate(`/manuals/${m.id}/edit`)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('manuals_export')}>
                      <IconButton size="small" onClick={() => downloadManualExport(m.id, m.title)}>
                        <FileDownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('delete')}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(m)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <CreateManualDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />
      <ImportManualDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    </Box>
  );
}
