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
  listCampaignBackgrounds, getCampaignBackground, createCampaignBackground,
  updateCampaignBackground, deleteCampaignBackground, copyBackgroundFromManual,
  type CampaignBackgroundListItem, type CampaignBackgroundDetail,
} from '../api/backgrounds/backgroundsApi';
import EditBackgroundDialog from '../components/backgrounds/EditBackgroundDialog';

const PAGE_SIZE = 20;

/**
 * Returns true if the current user is a master (owner or master-role player) of the active campaign.
 */
function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/**
 * Campaign Backgrounds page – lists manual + campaign backgrounds with filters, detail view, and CRUD.
 */
export default function CampaignBackgroundsPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [items, setItems] = useState<CampaignBackgroundListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignBackgroundDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingBackground, setEditingBackground] = useState<CampaignBackgroundDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const loadBackgrounds = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignBackgrounds(
        campaignId,
        { q: q || undefined, origin: origin || undefined, sort: sort as any || undefined, page, pageSize },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando trasfondos');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBackgrounds(); }, [campaignId, q, origin, sort, page, lang]);

  const handleOpenDetail = async (backgroundId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignBackground(campaignId, backgroundId, lang);
      setSelected(detail);
    } catch { setSelected(null); }
    finally { setLoading(false); }
  };

  const handleDelete = async (backgroundId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignBackground(campaignId, backgroundId);
      setDeleteConfirm(null);
      loadBackgrounds();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando trasfondo');
    }
  };

  const handleOpenCreate = () => { setIsCreating(true); setEditingBackground(null); setEditDialog(true); };

  const handleOpenEdit = async (backgroundId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignBackground(campaignId, backgroundId, lang);
      setIsCreating(false);
      setEditingBackground(detail);
      setEditDialog(true);
    } catch { setError('Error cargando trasfondo para editar'); }
  };

  const handleCloseEdit = () => { setEditDialog(false); setEditingBackground(null); setIsCreating(false); };

  const handleSave = async (data: any) => {
    if (!campaignId) return;
    if (isCreating) {
      await createCampaignBackground(campaignId, data);
    } else if (editingBackground) {
      if (editingBackground.origin === 'manual' && editingBackground.sourceManual) {
        const [manualId, bgId] = editingBackground.id.split(':');
        if (manualId && bgId) {
          const copied = await copyBackgroundFromManual(campaignId, manualId, bgId, lang);
          await updateCampaignBackground(campaignId, copied.id, data);
        }
      } else {
        await updateCampaignBackground(campaignId, editingBackground.id, data);
      }
    }
    loadBackgrounds();
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

  if (!campaignId) return <Container sx={{ py: 3 }}><Alert severity="info">{t('select_campaign_backgrounds', 'Selecciona una campaña para ver los trasfondos.')}</Alert></Container>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">{t('backgrounds', 'Trasfondos')}</Typography>
        {isMaster && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            {t('add_background', 'Añadir Trasfondo')}
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
            {items.map((bg) => (
              <Card key={bg.id}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{bg.name}</Typography>
                  {bg.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {bg.description}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Chip label={originLabel(bg.origin, bg.sourceManual, bg.customOriginName)} size="small" color={originChipColor(bg.origin)} />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(bg.id)}><VisibilityIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isMaster && (
                      <Tooltip title={t('edit', 'Editar')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(bg.id)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isMaster && bg.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(bg.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          {!loading && items.length === 0 && <Alert severity="info">{t('no_backgrounds_found', 'No se encontraron trasfondos')}</Alert>}
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
              {selected.description && (
                <Typography variant="body1" gutterBottom>{selected.description}</Typography>
              )}
              {selected.skillProficiencies?.length ? (
                <Typography variant="body1" gutterBottom>
                  <strong>{t('skill_proficiencies', 'Competencias en habilidades')}:</strong> {selected.skillProficiencies.join(', ')}
                </Typography>
              ) : null}
              {selected.toolProficiencies?.length ? (
                <Typography variant="body1" gutterBottom>
                  <strong>{t('tool_proficiencies', 'Competencias en herramientas')}:</strong> {selected.toolProficiencies.join(', ')}
                </Typography>
              ) : null}
              {selected.languages != null && (
                <Typography variant="body1" gutterBottom>
                  <strong>{t('extra_languages', 'Idiomas adicionales')}:</strong> {selected.languages}
                </Typography>
              )}
              {selected.equipment?.length ? (
                <Typography variant="body1" gutterBottom>
                  <strong>{t('equipment', 'Equipo')}:</strong> {selected.equipment.join(', ')}
                </Typography>
              ) : null}
              {selected.feature && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">{t('feature', 'Rasgo')}: {selected.feature.name}</Typography>
                  {selected.feature.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{selected.feature.description}</Typography>
                  )}
                </Box>
              )}
              {selected.suggestedCharacteristics && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{t('suggested_characteristics', 'Características sugeridas')}</Typography>
                  {selected.suggestedCharacteristics.personalityTraits?.length ? (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('personality_traits', 'Rasgos de personalidad')}</Typography>
                      <ul style={{ margin: '4px 0' }}>
                        {selected.suggestedCharacteristics.personalityTraits.map((pt, i) => (
                          <li key={i}><Typography variant="body2">{pt}</Typography></li>
                        ))}
                      </ul>
                    </Box>
                  ) : null}
                  {selected.suggestedCharacteristics.ideals?.length ? (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('ideals', 'Ideales')}</Typography>
                      <ul style={{ margin: '4px 0' }}>
                        {selected.suggestedCharacteristics.ideals.map((id, i) => (
                          <li key={i}><Typography variant="body2">{id}</Typography></li>
                        ))}
                      </ul>
                    </Box>
                  ) : null}
                  {selected.suggestedCharacteristics.bonds?.length ? (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('bonds', 'Vínculos')}</Typography>
                      <ul style={{ margin: '4px 0' }}>
                        {selected.suggestedCharacteristics.bonds.map((b, i) => (
                          <li key={i}><Typography variant="body2">{b}</Typography></li>
                        ))}
                      </ul>
                    </Box>
                  ) : null}
                  {selected.suggestedCharacteristics.flaws?.length ? (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('flaws', 'Defectos')}</Typography>
                      <ul style={{ margin: '4px 0' }}>
                        {selected.suggestedCharacteristics.flaws.map((f, i) => (
                          <li key={i}><Typography variant="body2">{f}</Typography></li>
                        ))}
                      </ul>
                    </Box>
                  ) : null}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent><Typography>{t('delete_background_confirm', '¿Estás seguro de que quieres eliminar este trasfondo?')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>{t('delete', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Dialog */}
      <EditBackgroundDialog
        open={editDialog}
        backgroundData={editingBackground}
        isCreate={isCreating}
        onClose={handleCloseEdit}
        onSave={handleSave}
      />
    </Box>
  );
}
