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
  listCampaignClasses, getCampaignClass, createCampaignClass,
  updateCampaignClass, deleteCampaignClass, copyClassFromManual,
  type CampaignClassListItem, type CampaignClassDetail,
} from '../api/classes/classesApi';
import EditClassDialog from '../components/classes/EditClassDialog';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/**
 * Campaign Classes page – lists manual + campaign classes with filters, detail view, and CRUD.
 */
export default function CampaignClassesPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [items, setItems] = useState<CampaignClassListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignClassDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<CampaignClassDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const loadClasses = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignClasses(
        campaignId,
        { q: q || undefined, origin: origin || undefined, sort: sort as any || undefined, page, pageSize },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando clases');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, [campaignId, q, origin, sort, page, lang]);

  const handleOpenDetail = async (classId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignClass(campaignId, classId, lang);
      setSelected(detail);
    } catch { setSelected(null); }
    finally { setLoading(false); }
  };

  const handleDelete = async (classId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignClass(campaignId, classId);
      setDeleteConfirm(null);
      loadClasses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando clase');
    }
  };

  const handleOpenCreate = () => { setIsCreating(true); setEditingClass(null); setEditDialog(true); };

  const handleOpenEdit = async (classId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignClass(campaignId, classId, lang);
      setIsCreating(false);
      setEditingClass(detail);
      setEditDialog(true);
    } catch { setError('Error cargando clase para editar'); }
  };

  const handleCloseEdit = () => { setEditDialog(false); setEditingClass(null); setIsCreating(false); };

  const handleSave = async (data: any) => {
    if (!campaignId) return;
    if (isCreating) {
      await createCampaignClass(campaignId, data);
    } else if (editingClass) {
      if (editingClass.origin === 'manual' && editingClass.sourceManual) {
        const [manualId, classId] = editingClass.id.split(':');
        if (manualId && classId) {
          const copied = await copyClassFromManual(campaignId, manualId, classId, lang);
          await updateCampaignClass(campaignId, copied.id, data);
        }
      } else {
        await updateCampaignClass(campaignId, editingClass.id, data);
      }
    }
    loadClasses();
  };

  const getManualName = (manualId: string | null | undefined): string => {
    if (!manualId) return 'Manual';
    if (manualId === 'dnd5e-2014') return 'D&D 5e (2014)';
    if (manualId === 'dnd5e-2024') return 'D&D 5e (2024)';
    return manualId.split('-').map((p) => p.toUpperCase()).join(' ');
  };

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

  if (!campaignId) return <Container sx={{ py: 3 }}><Alert severity="info">{t('select_campaign_classes', 'Selecciona una campaña para ver las clases.')}</Alert></Container>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">{t('classes', 'Clases')}</Typography>
        {isMaster && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            {t('add_class', 'Añadir Clase')}
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
              <MenuItem value="hitDie">{t('hit_die_asc', 'Dado de golpe ↑')}</MenuItem>
              <MenuItem value="hitDie_desc">{t('hit_die_desc', 'Dado de golpe ↓')}</MenuItem>
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
            {items.map((cls) => (
              <Card key={cls.id}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{cls.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('hit_die', 'Dado de golpe')}: d{cls.hitDie}
                  </Typography>
                  {cls.primaryAbilities?.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {cls.primaryAbilities.map((a) => a.toUpperCase()).join(', ')}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Chip label={originLabel(cls.origin, cls.sourceManual, cls.customOriginName)} size="small" color={originChipColor(cls.origin)} />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(cls.id)}><VisibilityIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isMaster && (
                      <Tooltip title={t('edit', 'Editar')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(cls.id)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isMaster && cls.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(cls.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          {!loading && items.length === 0 && <Alert severity="info">{t('no_classes_found', 'No se encontraron clases')}</Alert>}
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
              <Typography variant="body1" gutterBottom><strong>{t('hit_die', 'Dado de golpe')}:</strong> d{selected.hitDie}</Typography>
              {selected.primaryAbilities?.length > 0 && (
                <Typography variant="body1" gutterBottom><strong>{t('primary_abilities', 'Habilidades principales')}:</strong> {selected.primaryAbilities.map((a) => a.toUpperCase()).join(', ')}</Typography>
              )}
              {selected.savingThrows?.length > 0 && (
                <Typography variant="body1" gutterBottom><strong>{t('saving_throws', 'Tiradas de salvación')}:</strong> {selected.savingThrows.map((a) => a.toUpperCase()).join(', ')}</Typography>
              )}
              {selected.hitPoints && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2">{t('hit_points', 'Puntos de golpe')}</Typography>
                  <Typography variant="body2">{selected.hitPoints.hitDice}</Typography>
                  <Typography variant="body2">{t('at_1st_level', 'A nivel 1')}: {selected.hitPoints.at1stLevel}</Typography>
                  <Typography variant="body2">{t('at_higher_levels', 'A niveles superiores')}: {selected.hitPoints.atHigherLevels}</Typography>
                </Box>
              )}
              {selected.proficiencies && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2">{t('proficiencies', 'Competencias')}</Typography>
                  {selected.proficiencies.armor?.length ? <Typography variant="body2">{t('armor', 'Armadura')}: {selected.proficiencies.armor.join(', ')}</Typography> : null}
                  {selected.proficiencies.weapons?.length ? <Typography variant="body2">{t('weapons', 'Armas')}: {selected.proficiencies.weapons.join(', ')}</Typography> : null}
                  {selected.proficiencies.tools?.length ? <Typography variant="body2">{t('tools', 'Herramientas')}: {selected.proficiencies.tools.join(', ')}</Typography> : null}
                </Box>
              )}
              {selected.features?.length ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">{t('features', 'Rasgos')}</Typography>
                  {selected.features.map((f: any, i: number) => (
                    <Box key={f.id || i} sx={{ mt: 1 }}>
                      <Typography variant="body2"><strong>{f.name}</strong> ({t('level', 'Nivel')} {f.level})</Typography>
                      <Typography variant="body2" whiteSpace="pre-wrap">{f.description}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent><Typography>{t('delete_class_confirm', '¿Estás seguro de que quieres eliminar esta clase?')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>{t('delete', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Dialog */}
      <EditClassDialog
        open={editDialog}
        classData={editingClass}
        isCreate={isCreating}
        onClose={handleCloseEdit}
        onSave={handleSave}
      />
    </Box>
  );
}
