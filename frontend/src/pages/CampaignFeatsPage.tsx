import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Pagination,
  Paper, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import {
  listCampaignFeats, getCampaignFeat, createCampaignFeat,
  updateCampaignFeat, deleteCampaignFeat, copyFeatFromManual,
  type CampaignFeatListItem, type CampaignFeatDetail,
} from '../api/feats/featsApi';
import EditFeatDialog from '../components/feats/EditFeatDialog';
import { useManualNames } from '../hooks/useManualNames';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/**
 * Campaign Feats page – lists manual + campaign feats with filters, detail view, and CRUD.
 */
export default function CampaignFeatsPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [items, setItems] = useState<CampaignFeatListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignFeatDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingFeat, setEditingFeat] = useState<CampaignFeatDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const loadFeats = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignFeats(
        campaignId,
        { q: q || undefined, origin: origin || undefined, sort: sort as any || undefined, page, pageSize },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando dotes');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeats(); }, [campaignId, q, origin, sort, page, lang]);

  const handleOpenDetail = async (featId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignFeat(campaignId, featId, lang);
      setSelected(detail);
    } catch { setSelected(null); }
    finally { setLoading(false); }
  };

  const handleDelete = async (featId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignFeat(campaignId, featId);
      setDeleteConfirm(null);
      loadFeats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando dote');
    }
  };

  const handleOpenCreate = () => { setIsCreating(true); setEditingFeat(null); setEditDialog(true); };

  const handleOpenEdit = async (featId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignFeat(campaignId, featId, lang);
      setIsCreating(false);
      setEditingFeat(detail);
      setEditDialog(true);
    } catch { setError('Error cargando dote para editar'); }
  };

  const handleCloseEdit = () => { setEditDialog(false); setEditingFeat(null); setIsCreating(false); };

  const handleSave = async (data: any) => {
    if (!campaignId) return;
    if (isCreating) {
      await createCampaignFeat(campaignId, data);
    } else if (editingFeat) {
      if (editingFeat.origin === 'manual' && editingFeat.sourceManual) {
        const [manualId, featId] = editingFeat.id.split(':');
        if (manualId && featId) {
          const copied = await copyFeatFromManual(campaignId, manualId, featId, lang);
          await updateCampaignFeat(campaignId, copied.id, data);
        }
      } else {
        await updateCampaignFeat(campaignId, editingFeat.id, data);
      }
    }
    loadFeats();
  };

  const { getManualName } = useManualNames();

  const originLabel = (o: string, src?: string | null, custom?: string | null) => {
    switch (o) {
      case 'manual': return getManualName(src);
      case 'manual-edited': return `${getManualName(src)} (${t('edited', 'Editado')})`;
      case 'homebrew': return custom || 'Homebrew';
      default: return o;
    }
  };

  const originChipColor = (o: string): 'default' | 'primary' | 'secondary' =>
    o === 'manual-edited' ? 'secondary' : o === 'homebrew' ? 'primary' : 'default';

  const handleClearFilters = () => { setQ(''); setOrigin(''); setSort('name'); setPage(1); };
  const hasActiveFilters = q || origin || sort !== 'name';

  if (!campaignId) return <Container sx={{ py: 3 }}><Alert severity="info">{t('select_campaign_feats', 'Selecciona una campaña para ver las dotes.')}</Alert></Container>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">{t('feats', 'Dotes')}</Typography>
        {isMaster && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            {t('add_feat', 'Añadir Dote')}
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField label={t('search', 'Buscar')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} size="small" sx={{ flexGrow: 1, minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('origin', 'Origen')}</InputLabel>
            <Select value={origin} label={t('origin', 'Origen')} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}>
              <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="manual-edited">Manual ({t('edited', 'Editado')})</MenuItem>
              <MenuItem value="homebrew">Homebrew</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('sort', 'Ordenar por')}</InputLabel>
            <Select value={sort} label={t('sort', 'Ordenar por')} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <MenuItem value="name">{t('name_az', 'Nombre (A-Z)')}</MenuItem>
              <MenuItem value="name_desc">{t('name_za', 'Nombre (Z-A)')}</MenuItem>
            </Select>
          </FormControl>
          {hasActiveFilters && (
            <Button variant="outlined" size="small" startIcon={<FilterListOffIcon />} onClick={handleClearFilters}>
              {t('clear_filters', 'Limpiar Filtros')}
            </Button>
          )}
        </Stack>
      </Paper>

      {loading && !items.length ? (
        <Typography>{t('loading', 'Cargando...')}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2, mb: 3 }}>
            {items.map((feat) => (
              <Card key={feat.id}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{feat.name}</Typography>
                  {feat.prerequisite && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('prerequisite', 'Requisito')}: {feat.prerequisite}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Chip label={originLabel(feat.origin, feat.sourceManual, feat.customOriginName)} size="small" color={originChipColor(feat.origin)} />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(feat.id)}><VisibilityIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isMaster && (
                      <Tooltip title={t('edit', 'Editar')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(feat.id)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isMaster && feat.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(feat.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          {!loading && items.length === 0 && <Alert severity="info">{t('no_feats_found', 'No se encontraron dotes')}</Alert>}
          <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
          </Stack>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name}
          <IconButton onClick={() => setSelected(null)} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              {selected.prerequisite && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                  {t('prerequisite', 'Requisito')}: {selected.prerequisite}
                </Typography>
              )}
              <Typography variant="body1" whiteSpace="pre-wrap">{selected.description}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent><Typography>{t('delete_feat_confirm', '¿Estás seguro de que quieres eliminar esta dote?')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>{t('delete', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Dialog */}
      <EditFeatDialog
        open={editDialog}
        featData={editingFeat}
        isCreate={isCreating}
        onClose={handleCloseEdit}
        onSave={handleSave}
      />
    </Box>
  );
}
