import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Pagination, Select, Stack,
  TextField, Typography, Paper, Tooltip, Alert, Card, CardContent, CardMedia,
  Checkbox, ListItemText
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import {
  listCampaignMonsters,
  getCampaignMonster,
  deleteCampaignMonster,
  updateCampaignMonster,
  copyMonsterFromManual,
  createCampaignMonster,
  type CampaignMonsterListItem,
  type CampaignMonsterDetail,
} from '../api/bestiary/bestiaryApi';
import MonsterStatBlock from '../components/bestiary/MonsterStatBlock';
import EditMonsterDialog from '../components/bestiary/EditMonsterDialog';
import CreateMonsterDialog from '../components/bestiary/CreateMonsterDialog';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master');
}

export default function CampaignBestiaryPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

  const [items, setItems] = useState<CampaignMonsterListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [origin, setOrigin] = useState('');
  const [crValues, setCrValues] = useState<string[]>([]);
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignMonsterDetail | null>(null);
  const [editMonster, setEditMonster] = useState<CampaignMonsterDetail | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const loadMonsters = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignMonsters(
        campaignId,
        {
          q: q || undefined,
          type: type || undefined,
          size: size || undefined,
          origin: origin || undefined,
          cr: crValues.length > 0 ? crValues.join(',') : undefined,
          sort: sort as any || undefined,
          page,
          pageSize,
        },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando bestiario');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonsters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, q, type, size, origin, crValues, sort, page, lang]);

  const handleOpenDetail = async (monsterId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignMonster(campaignId, monsterId, lang);
      setSelected(detail);
    } catch {
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (monsterId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignMonster(campaignId, monsterId);
      setDeleteConfirm(null);
      loadMonsters();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando monstruo');
    }
  };

  const handleEditClick = async (monster: CampaignMonsterListItem) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      // Load full details
      const detail = await getCampaignMonster(campaignId, monster.id, lang);
      setEditMonster(detail);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando monstruo');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (data: any) => {
    if (!campaignId || !editMonster) return;
    
    try {
      // If monster is from manual (not yet copied), copy it first
      if (editMonster.origin === 'manual' && editMonster.sourceManual) {
        // Parse the monster ID to extract manualId and slug
        const [manualId, slug] = editMonster.id.split(':');
        if (manualId && slug) {
          // Copy from manual
          const copied = await copyMonsterFromManual(campaignId, manualId, slug, lang);
          // Update the copy with new data
          await updateCampaignMonster(campaignId, copied.id, data);
        }
      } else {
        // Update existing custom/edited monster
        await updateCampaignMonster(campaignId, editMonster.id, data);
      }
      
      setEditMonster(null);
      loadMonsters();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error guardando cambios');
    }
  };

  const handleCreateMonster = async (data: any) => {
    if (!campaignId) return;
    
    try {
      await createCampaignMonster(campaignId, data);
      setCreateDialogOpen(false);
      loadMonsters();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creando monstruo');
    }
  };

  const getManualName = (manualId: string | null | undefined): string => {
    if (!manualId) return 'Manual';
    // Convert manualId to readable name
    // e.g., 'dnd5e-2014' -> 'D&D 5e (2014)'
    if (manualId === 'dnd5e-2014') return 'D&D 5e (2014)';
    if (manualId === 'dnd5e-2024') return 'D&D 5e (2024)';
    // Fallback: capitalize and format
    return manualId
      .split('-')
      .map(part => part.toUpperCase())
      .join(' ');
  };

  const originLabel = (origin: string, sourceManual?: string | null, customOriginName?: string | null) => {
    switch (origin) {
      case 'manual':
        return getManualName(sourceManual);
      case 'manual-edited':
        return `${getManualName(sourceManual)} (Editado)`;
      case 'homebrew':
        return customOriginName || 'Homebrew';
      default:
        return origin;
    }
  };

  const availableManuals = (activeCampaign?.selectedManualIds || []).map((id: string) => ({
    id,
    name: getManualName(id),
  }));

  const handleClearFilters = () => {
    setQ('');
    setType('');
    setSize('');
    setOrigin('');
    setCrValues([]);
    setSort('name');
    setPage(1);
  };

  const hasActiveFilters = q || type || size || origin || crValues.length > 0 || sort !== 'name';

  const originChipColor = (origin: string): 'default' | 'primary' | 'secondary' => {
    switch (origin) {
      case 'manual':
        return 'default';
      case 'manual-edited':
        return 'secondary';
      case 'homebrew':
        return 'primary';
      default:
        return 'default';
    }
  };

  if (!campaignId) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="info">Selecciona una campaña para ver el bestiario.</Alert>
      </Container>
    );
  }

  if (!isMaster) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="warning">Solo los masters tienen acceso al bestiario.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">{t('bestiary', 'Bestiario')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          {t('add_monster', 'Añadir Monstruo')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
            <TextField
              label={t('search', 'Buscar')}
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              size="small"
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="type-label">{t('type', 'Tipo')}</InputLabel>
              <Select labelId="type-label" value={type} label={t('type', 'Tipo')} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
                <MenuItem value="aberration">Aberration</MenuItem>
                <MenuItem value="beast">Beast</MenuItem>
                <MenuItem value="celestial">Celestial</MenuItem>
                <MenuItem value="construct">Construct</MenuItem>
                <MenuItem value="dragon">Dragon</MenuItem>
                <MenuItem value="elemental">Elemental</MenuItem>
                <MenuItem value="fey">Fey</MenuItem>
                <MenuItem value="fiend">Fiend</MenuItem>
                <MenuItem value="giant">Giant</MenuItem>
                <MenuItem value="humanoid">Humanoid</MenuItem>
                <MenuItem value="monstrosity">Monstrosity</MenuItem>
                <MenuItem value="ooze">Ooze</MenuItem>
                <MenuItem value="plant">Plant</MenuItem>
                <MenuItem value="undead">Undead</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="size-label">{t('size', 'Tamaño')}</InputLabel>
              <Select labelId="size-label" value={size} label={t('size', 'Tamaño')} onChange={(e) => { setSize(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
                <MenuItem value="Tiny">Tiny</MenuItem>
                <MenuItem value="Small">Small</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Large">Large</MenuItem>
                <MenuItem value="Huge">Huge</MenuItem>
                <MenuItem value="Gargantuan">Gargantuan</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="origin-label">{t('origin', 'Origen')}</InputLabel>
              <Select labelId="origin-label" value={origin} label={t('origin', 'Origen')} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="manual-edited">Manual (Editado)</MenuItem>
                <MenuItem value="homebrew">Homebrew</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="cr-label">Challenge Rating (CR)</InputLabel>
              <Select
                labelId="cr-label"
                multiple
                value={crValues}
                label="Challenge Rating (CR)"
                onChange={(e) => { setCrValues(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value); setPage(1); }}
                renderValue={(selected) => selected.length > 0 ? selected.join(', ') : ''}
              >
                <MenuItem value="0">
                  <Checkbox checked={crValues.indexOf('0') > -1} />
                  <ListItemText primary="0" />
                </MenuItem>
                <MenuItem value="1/8">
                  <Checkbox checked={crValues.indexOf('1/8') > -1} />
                  <ListItemText primary="1/8" />
                </MenuItem>
                <MenuItem value="1/4">
                  <Checkbox checked={crValues.indexOf('1/4') > -1} />
                  <ListItemText primary="1/4" />
                </MenuItem>
                <MenuItem value="1/2">
                  <Checkbox checked={crValues.indexOf('1/2') > -1} />
                  <ListItemText primary="1/2" />
                </MenuItem>
                <MenuItem value="1">
                  <Checkbox checked={crValues.indexOf('1') > -1} />
                  <ListItemText primary="1" />
                </MenuItem>
                <MenuItem value="2">
                  <Checkbox checked={crValues.indexOf('2') > -1} />
                  <ListItemText primary="2" />
                </MenuItem>
                <MenuItem value="3">
                  <Checkbox checked={crValues.indexOf('3') > -1} />
                  <ListItemText primary="3" />
                </MenuItem>
                <MenuItem value="4">
                  <Checkbox checked={crValues.indexOf('4') > -1} />
                  <ListItemText primary="4" />
                </MenuItem>
                <MenuItem value="5">
                  <Checkbox checked={crValues.indexOf('5') > -1} />
                  <ListItemText primary="5" />
                </MenuItem>
                <MenuItem value="6">
                  <Checkbox checked={crValues.indexOf('6') > -1} />
                  <ListItemText primary="6" />
                </MenuItem>
                <MenuItem value="7">
                  <Checkbox checked={crValues.indexOf('7') > -1} />
                  <ListItemText primary="7" />
                </MenuItem>
                <MenuItem value="8">
                  <Checkbox checked={crValues.indexOf('8') > -1} />
                  <ListItemText primary="8" />
                </MenuItem>
                <MenuItem value="9">
                  <Checkbox checked={crValues.indexOf('9') > -1} />
                  <ListItemText primary="9" />
                </MenuItem>
                <MenuItem value="10">
                  <Checkbox checked={crValues.indexOf('10') > -1} />
                  <ListItemText primary="10" />
                </MenuItem>
                <MenuItem value="11">
                  <Checkbox checked={crValues.indexOf('11') > -1} />
                  <ListItemText primary="11" />
                </MenuItem>
                <MenuItem value="12">
                  <Checkbox checked={crValues.indexOf('12') > -1} />
                  <ListItemText primary="12" />
                </MenuItem>
                <MenuItem value="13">
                  <Checkbox checked={crValues.indexOf('13') > -1} />
                  <ListItemText primary="13" />
                </MenuItem>
                <MenuItem value="14">
                  <Checkbox checked={crValues.indexOf('14') > -1} />
                  <ListItemText primary="14" />
                </MenuItem>
                <MenuItem value="15">
                  <Checkbox checked={crValues.indexOf('15') > -1} />
                  <ListItemText primary="15" />
                </MenuItem>
                <MenuItem value="16">
                  <Checkbox checked={crValues.indexOf('16') > -1} />
                  <ListItemText primary="16" />
                </MenuItem>
                <MenuItem value="17">
                  <Checkbox checked={crValues.indexOf('17') > -1} />
                  <ListItemText primary="17" />
                </MenuItem>
                <MenuItem value="18">
                  <Checkbox checked={crValues.indexOf('18') > -1} />
                  <ListItemText primary="18" />
                </MenuItem>
                <MenuItem value="19">
                  <Checkbox checked={crValues.indexOf('19') > -1} />
                  <ListItemText primary="19" />
                </MenuItem>
                <MenuItem value="20">
                  <Checkbox checked={crValues.indexOf('20') > -1} />
                  <ListItemText primary="20" />
                </MenuItem>
                <MenuItem value="21">
                  <Checkbox checked={crValues.indexOf('21') > -1} />
                  <ListItemText primary="21" />
                </MenuItem>
                <MenuItem value="22">
                  <Checkbox checked={crValues.indexOf('22') > -1} />
                  <ListItemText primary="22" />
                </MenuItem>
                <MenuItem value="23">
                  <Checkbox checked={crValues.indexOf('23') > -1} />
                  <ListItemText primary="23" />
                </MenuItem>
                <MenuItem value="24">
                  <Checkbox checked={crValues.indexOf('24') > -1} />
                  <ListItemText primary="24" />
                </MenuItem>
                <MenuItem value="25">
                  <Checkbox checked={crValues.indexOf('25') > -1} />
                  <ListItemText primary="25" />
                </MenuItem>
                <MenuItem value="26">
                  <Checkbox checked={crValues.indexOf('26') > -1} />
                  <ListItemText primary="26" />
                </MenuItem>
                <MenuItem value="27">
                  <Checkbox checked={crValues.indexOf('27') > -1} />
                  <ListItemText primary="27" />
                </MenuItem>
                <MenuItem value="28">
                  <Checkbox checked={crValues.indexOf('28') > -1} />
                  <ListItemText primary="28" />
                </MenuItem>
                <MenuItem value="29">
                  <Checkbox checked={crValues.indexOf('29') > -1} />
                  <ListItemText primary="29" />
                </MenuItem>
                <MenuItem value="30">
                  <Checkbox checked={crValues.indexOf('30') > -1} />
                  <ListItemText primary="30" />
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flexGrow: 1, minWidth: 180 }}>
              <InputLabel id="sort-label">{t('sort', 'Ordenar por')}</InputLabel>
              <Select labelId="sort-label" value={sort} label={t('sort', 'Ordenar por')} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                <MenuItem value="name">Nombre (A-Z)</MenuItem>
                <MenuItem value="name_desc">Nombre (Z-A)</MenuItem>
                <MenuItem value="type">Tipo (A-Z)</MenuItem>
                <MenuItem value="type_desc">Tipo (Z-A)</MenuItem>
                <MenuItem value="size">Tamaño (menor a mayor)</MenuItem>
                <MenuItem value="size_desc">Tamaño (mayor a menor)</MenuItem>
                <MenuItem value="cr">CR (menor a mayor)</MenuItem>
                <MenuItem value="cr_desc">CR (mayor a menor)</MenuItem>
                <MenuItem value="origin">Origen (A-Z)</MenuItem>
                <MenuItem value="origin_desc">Origen (Z-A)</MenuItem>
              </Select>
            </FormControl>
            {hasActiveFilters && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterListOffIcon />}
                onClick={handleClearFilters}
                sx={{ minWidth: 140 }}
              >
                {t('clear_filters', 'Limpiar Filtros')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {loading && !items.length ? (
        <Typography>{t('loading', 'Cargando...')}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2, mb: 3 }}>
            {items.map((monster) => (
              <Card key={monster.id} sx={{ position: 'relative' }}>
                {monster.imageUrls?.low && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={monster.imageUrls.low}
                    alt={monster.name}
                    sx={{ objectFit: 'cover' }}
                  />
                )}
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    {monster.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CR {monster.challengeRating || '?'} • {monster.size} {monster.type}
                  </Typography>
                  {monster.alignment && (
                    <Typography variant="caption" color="text.secondary">
                      {monster.alignment}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      label={originLabel(monster.origin, monster.sourceManual, monster.customOriginName)} 
                      size="small" 
                      color={originChipColor(monster.origin)}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(monster.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('edit', 'Editar')}>
                      <IconButton size="small" onClick={() => handleEditClick(monster)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {monster.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(monster.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          {!loading && items.length === 0 && (
            <Alert severity="info">{t('no_monsters_found', 'No se encontraron monstruos')}</Alert>
          )}

          <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
          </Stack>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name}
          <IconButton onClick={() => setSelected(null)} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selected && <MonsterStatBlock monster={selected} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent>
          <Typography>{t('delete_monster_confirm', '¿Estás seguro de que quieres eliminar este monstruo?')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>
            {t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Monster Dialog */}
      <CreateMonsterDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSave={handleCreateMonster}
        availableManuals={availableManuals}
      />

      {/* Edit Monster Dialog */}
      <EditMonsterDialog
        open={!!editMonster}
        monster={editMonster}
        onClose={() => setEditMonster(null)}
        onSave={handleSaveEdit}
      />
    </Container>
  );
}
