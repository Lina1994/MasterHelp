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
  listCampaignRaces, getCampaignRace, createCampaignRace,
  updateCampaignRace, deleteCampaignRace, copyRaceFromManual,
  type CampaignRaceListItem, type CampaignRaceDetail,
} from '../api/races/racesApi';
import EditRaceDialog from '../components/races/EditRaceDialog';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/**
 * Campaign Races page – lists manual + campaign races with filters, detail view, and CRUD.
 */
export default function CampaignRacesPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [items, setItems] = useState<CampaignRaceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignRaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingRace, setEditingRace] = useState<CampaignRaceDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const loadRaces = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignRaces(
        campaignId,
        { q: q || undefined, origin: origin || undefined, sort: sort as any || undefined, page, pageSize },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando razas');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRaces(); }, [campaignId, q, origin, sort, page, lang]);

  const handleOpenDetail = async (raceId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignRace(campaignId, raceId, lang);
      setSelected(detail);
    } catch { setSelected(null); }
    finally { setLoading(false); }
  };

  const handleDelete = async (raceId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignRace(campaignId, raceId);
      setDeleteConfirm(null);
      loadRaces();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando raza');
    }
  };

  const handleOpenCreate = () => { setIsCreating(true); setEditingRace(null); setEditDialog(true); };

  const handleOpenEdit = async (raceId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignRace(campaignId, raceId, lang);
      setIsCreating(false);
      setEditingRace(detail);
      setEditDialog(true);
    } catch { setError('Error cargando raza para editar'); }
  };

  const handleCloseEdit = () => { setEditDialog(false); setEditingRace(null); setIsCreating(false); };

  const handleSave = async (data: any) => {
    if (!campaignId) return;
    if (isCreating) {
      await createCampaignRace(campaignId, data);
    } else if (editingRace) {
      if (editingRace.origin === 'manual' && editingRace.sourceManual) {
        const [manualId, raceId] = editingRace.id.split(':');
        if (manualId && raceId) {
          const copied = await copyRaceFromManual(campaignId, manualId, raceId, lang);
          await updateCampaignRace(campaignId, copied.id, data);
        }
      } else {
        await updateCampaignRace(campaignId, editingRace.id, data);
      }
    }
    loadRaces();
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

  const formatSpeed = (speed: Record<string, number> | undefined) => {
    if (!speed) return '-';
    return Object.entries(speed).map(([k, v]) => `${k} ${v} ft`).join(', ');
  };

  const handleClearFilters = () => { setQ(''); setOrigin(''); setSort('name'); setPage(1); };
  const hasActiveFilters = q || origin || sort !== 'name';

  if (!campaignId) return <Container sx={{ py: 3 }}><Alert severity="info">{t('select_campaign_races', 'Selecciona una campaña para ver las razas.')}</Alert></Container>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">{t('races', 'Razas')}</Typography>
        {isMaster && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            {t('add_race', 'Añadir Raza')}
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
              <MenuItem value="size">{t('size_asc', 'Tamaño (A-Z)')}</MenuItem>
              <MenuItem value="size_desc">{t('size_desc_label', 'Tamaño (Z-A)')}</MenuItem>
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
            {items.map((race) => (
              <Card key={race.id}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{race.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('size', 'Tamaño')}: {race.size}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('speed', 'Velocidad')}: {formatSpeed(race.speed)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip label={originLabel(race.origin, race.sourceManual, race.customOriginName)} size="small" color={originChipColor(race.origin)} />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(race.id)}><VisibilityIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isMaster && (
                      <Tooltip title={t('edit', 'Editar')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(race.id)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isMaster && race.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(race.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          {!loading && items.length === 0 && <Alert severity="info">{t('no_races_found', 'No se encontraron razas')}</Alert>}
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
              <Typography variant="body1" gutterBottom><strong>{t('size', 'Tamaño')}:</strong> {selected.size}</Typography>
              <Typography variant="body1" gutterBottom><strong>{t('speed', 'Velocidad')}:</strong> {formatSpeed(selected.speed)}</Typography>
              {selected.abilityBonuses && Object.keys(selected.abilityBonuses).length > 0 && (
                <Typography variant="body1" gutterBottom>
                  <strong>{t('ability_bonuses', 'Bonificadores de característica')}:</strong>{' '}
                  {Object.entries(selected.abilityBonuses).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}
                </Typography>
              )}
              {selected.languages?.length ? (
                <Typography variant="body1" gutterBottom><strong>{t('languages', 'Idiomas')}:</strong> {selected.languages.join(', ')}</Typography>
              ) : null}
              {selected.traits?.length ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">{t('racial_traits', 'Rasgos raciales')}</Typography>
                  {selected.traits.map((tr: any, i: number) => (
                    <Box key={tr.id || i} sx={{ mt: 1 }}>
                      <Typography variant="body2"><strong>{tr.name}</strong></Typography>
                      {tr.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{tr.description}</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : null}
              {selected.subraces?.length ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">{t('subraces', 'Subrazas')}</Typography>
                  {selected.subraces.map((sr: any, i: number) => (
                    <Box key={sr.id || i} sx={{ mt: 1.5, pl: 1, borderLeft: '3px solid', borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight="bold">{sr.name}</Typography>
                      {sr.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{sr.description}</Typography>
                      )}
                      {sr.abilityBonuses && Object.keys(sr.abilityBonuses).length > 0 && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          <strong>{t('ability_bonuses', 'Bonificadores')}:</strong>{' '}
                          {Object.entries(sr.abilityBonuses).map(([ab, val]) => `${ab.toUpperCase()} +${val}`).join(', ')}
                        </Typography>
                      )}
                      {sr.proficiencies && (
                        <Box sx={{ mt: 0.5 }}>
                          {sr.proficiencies.armor?.length > 0 && (
                            <Typography variant="body2"><strong>{t('armor', 'Armaduras')}:</strong> {sr.proficiencies.armor.join(', ')}</Typography>
                          )}
                          {sr.proficiencies.weapons?.length > 0 && (
                            <Typography variant="body2"><strong>{t('weapons', 'Armas')}:</strong> {sr.proficiencies.weapons.join(', ')}</Typography>
                          )}
                        </Box>
                      )}
                      {sr.traits?.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          {sr.traits.map((tr: any, j: number) => (
                            <Box key={tr.id || j} sx={{ mt: 0.5 }}>
                              <Typography variant="body2"><strong>{tr.name}</strong></Typography>
                              {tr.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>{tr.description}</Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
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
        <DialogContent><Typography>{t('delete_race_confirm', '¿Estás seguro de que quieres eliminar esta raza?')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>{t('delete', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Dialog */}
      <EditRaceDialog
        open={editDialog}
        raceData={editingRace}
        isCreate={isCreating}
        onClose={handleCloseEdit}
        onSave={handleSave}
      />
    </Box>
  );
}
