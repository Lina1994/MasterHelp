import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Pagination, Select, Stack,
  TextField, Typography, Paper, Tooltip, Alert, Card, CardContent,
  Checkbox, ListItemText, Snackbar
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import {
  listCampaignSpells,
  getCampaignSpell,
  deleteCampaignSpell,
  updateCampaignSpell,
  copySpellFromManual,
  createCampaignSpell,
  exportSpellsExcel,
  importSpellsExcel,
  type CampaignSpellListItem,
  type CampaignSpellDetail,
} from '../api/spells/spellsApi';
import SpellStatBlock from '../components/spells/SpellStatBlock';
import EditSpellDialog from '../components/spells/EditSpellDialog';
import { useManualNames } from '../hooks/useManualNames';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master');
}

export default function CampaignSpellsPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

  const [items, setItems] = useState<CampaignSpellListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [school, setSchool] = useState('');
  const [levelValues, setLevelValues] = useState<string[]>([]);
  const [concentration, setConcentration] = useState('');
  const [ritual, setRitual] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignSpellDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingSpell, setEditingSpell] = useState<CampaignSpellDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [importSnackbar, setImportSnackbar] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const loadSpells = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignSpells(
        campaignId,
        {
          q: q || undefined,
          school: school || undefined,
          level: levelValues.length > 0 ? levelValues.join(',') : undefined,
          concentration: concentration as any || undefined,
          ritual: ritual as any || undefined,
          origin: origin || undefined,
          sort: sort as any || undefined,
          page,
          pageSize,
        },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando hechizos');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpells();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, q, school, levelValues, concentration, ritual, origin, sort, page, lang]);

  const handleOpenDetail = async (spellId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignSpell(campaignId, spellId, lang);
      setSelected(detail);
    } catch {
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (spellId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignSpell(campaignId, spellId);
      setDeleteConfirm(null);
      loadSpells();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando hechizo');
    }
  };

  const handleOpenCreateDialog = () => {
    setIsCreating(true);
    setEditingSpell(null);
    setEditDialog(true);
  };

  const handleOpenEditDialog = async (spellId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignSpell(campaignId, spellId, lang);
      setIsCreating(false);
      setEditingSpell(detail);
      setEditDialog(true);
    } catch (err) {
      setError('Error cargando hechizo para editar');
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialog(false);
    setEditingSpell(null);
    setIsCreating(false);
  };

  const handleSaveSpell = async (data: any) => {
    if (!campaignId) return;
    try {
      if (isCreating) {
        await createCampaignSpell(campaignId, data);
      } else if (editingSpell) {
        // If spell is from manual (not yet copied), copy it first
        if (editingSpell.origin === 'manual' && editingSpell.sourceManual) {
          // Parse the spell ID to extract manualId and spellId
          const [manualId, spellId] = editingSpell.id.split(':');
          if (manualId && spellId) {
            // Copy from manual
            const copied = await copySpellFromManual(campaignId, manualId, spellId, lang);
            // Update the copy with new data
            await updateCampaignSpell(campaignId, copied.id, data);
          }
        } else {
          // Update existing custom/edited spell
          await updateCampaignSpell(campaignId, editingSpell.id, data);
        }
      }
      loadSpells();
    } catch (err: any) {
      throw err;
    }
  };

  const { getManualName } = useManualNames();

  const availableManuals = (activeCampaign?.selectedManualIds || []).map((id: string) => ({
    id,
    name: getManualName(id),
  }));

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

  const handleClearFilters = () => {
    setQ('');
    setSchool('');
    setLevelValues([]);
    setConcentration('');
    setRitual('');
    setOrigin('');
    setSort('name');
    setPage(1);
  };

  const hasActiveFilters = q || school || levelValues.length > 0 || concentration || ritual || origin || sort !== 'name';

  /** Export all campaign spells to an .xlsx file. */
  const handleExport = async () => {
    if (!campaignId) return;
    setExporting(true);
    try {
      await exportSpellsExcel(campaignId, lang);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al exportar hechizos');
    } finally {
      setExporting(false);
    }
  };

  /** Open file picker for import. */
  const handleImportClick = () => fileInputRef.current?.click();

  /** Handle the selected file and upload it. */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importSpellsExcel(campaignId, file, lang);
      setImportSnackbar(
        t('import_result', 'Importación completada: {{created}} creados, {{updated}} actualizados, {{skipped}} omitidos', result),
      );
      loadSpells();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al importar hechizos');
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
        <Alert severity="info">Selecciona una campaña para ver los hechizos.</Alert>
      </Container>
    );
  }

  if (!isMaster) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="warning">Solo los masters tienen acceso a los hechizos.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">{t('spells', 'Hechizos')}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            disabled={exporting}
          >
            {t('export_spells', 'Exportar')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={handleImportClick}
            disabled={importing}
          >
            {t('import_spells', 'Importar')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
            {t('add_spell', 'Añadir Hechizo')}
          </Button>
        </Stack>
      </Stack>

      {/* Hidden file input for Excel import */}
      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInputRef}
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

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
              <InputLabel id="school-label">{t('school', 'Escuela')}</InputLabel>
              <Select labelId="school-label" value={school} label={t('school', 'Escuela')} onChange={(e) => { setSchool(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
                <MenuItem value="Abjuration">Abjuration</MenuItem>
                <MenuItem value="Conjuration">Conjuration</MenuItem>
                <MenuItem value="Divination">Divination</MenuItem>
                <MenuItem value="Enchantment">Enchantment</MenuItem>
                <MenuItem value="Evocation">Evocation</MenuItem>
                <MenuItem value="Illusion">Illusion</MenuItem>
                <MenuItem value="Necromancy">Necromancy</MenuItem>
                <MenuItem value="Transmutation">Transmutation</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="concentration-label">Concentración</InputLabel>
              <Select labelId="concentration-label" value={concentration} label="Concentración" onChange={(e) => { setConcentration(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>Todos</em></MenuItem>
                <MenuItem value="true">Sí</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="ritual-label">Ritual</InputLabel>
              <Select labelId="ritual-label" value={ritual} label="Ritual" onChange={(e) => { setRitual(e.target.value); setPage(1); }}>
                <MenuItem value=""><em>Todos</em></MenuItem>
                <MenuItem value="true">Sí</MenuItem>
                <MenuItem value="false">No</MenuItem>
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
              <InputLabel id="level-label">Nivel</InputLabel>
              <Select
                labelId="level-label"
                multiple
                value={levelValues}
                label="Nivel"
                onChange={(e) => { setLevelValues(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value); setPage(1); }}
                renderValue={(selected) => selected.length > 0 ? selected.join(', ') : ''}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                  <MenuItem key={level} value={String(level)}>
                    <Checkbox checked={levelValues.indexOf(String(level)) > -1} />
                    <ListItemText primary={level === 0 ? 'Cantrip' : `Level ${level}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flexGrow: 1, minWidth: 180 }}>
              <InputLabel id="sort-label">{t('sort', 'Ordenar por')}</InputLabel>
              <Select labelId="sort-label" value={sort} label={t('sort', 'Ordenar por')} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                <MenuItem value="name">Nombre (A-Z)</MenuItem>
                <MenuItem value="name_desc">Nombre (Z-A)</MenuItem>
                <MenuItem value="level">Nivel (menor a mayor)</MenuItem>
                <MenuItem value="level_desc">Nivel (mayor a menor)</MenuItem>
                <MenuItem value="school">Escuela (A-Z)</MenuItem>
                <MenuItem value="school_desc">Escuela (Z-A)</MenuItem>
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
            {items.map((spell) => (
              <Card key={spell.id}>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    {spell.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} • {spell.school}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {spell.isConcentration && <Chip label="Concentration" size="small" color="warning" />}
                    {spell.isRitual && <Chip label="Ritual" size="small" color="info" />}
                  </Stack>
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      label={originLabel(spell.origin, spell.sourceManual, spell.customOriginName)} 
                      size="small" 
                      color={originChipColor(spell.origin)}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(spell.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('edit', 'Editar')}>
                      <IconButton size="small" onClick={() => handleOpenEditDialog(spell.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {spell.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(spell.id)}>
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
            <Alert severity="info">{t('no_spells_found', 'No se encontraron hechizos')}</Alert>
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
          {selected && <SpellStatBlock spell={selected} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent>
          <Typography>{t('delete_spell_confirm', '¿Estás seguro de que quieres eliminar este hechizo?')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>
            {t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Spell Dialog */}
      <EditSpellDialog
        open={editDialog}
        spell={editingSpell}
        isCreate={isCreating}
        availableManuals={availableManuals}
        onClose={handleCloseEditDialog}
        onSave={handleSaveSpell}
      />

      <Snackbar
        open={!!importSnackbar}
        autoHideDuration={6000}
        onClose={() => setImportSnackbar(null)}
        message={importSnackbar}
      />
    </Container>
  );
}
