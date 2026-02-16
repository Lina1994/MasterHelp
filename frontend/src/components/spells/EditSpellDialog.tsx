import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, MenuItem, IconButton, Box, Typography, Tabs, Tab,
  FormControlLabel, Checkbox, Chip, Stack, FormControl, InputLabel, Select
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignSpellDetail } from '../../api/spells/spellsApi';

interface EditSpellDialogProps {
  open: boolean;
  spell: CampaignSpellDetail | null;
  isCreate?: boolean;
  availableManuals?: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation'
];

const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const CLASSES = [
  'Bard',
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard',
  'Artificer'
];

export default function EditSpellDialog({ open, spell, isCreate = false, availableManuals = [], onClose, onSave }: EditSpellDialogProps) {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Basic info
  const [name, setName] = useState('');
  const [level, setLevel] = useState(0);
  const [school, setSchool] = useState('Evocation');
  const [castingTime, setCastingTime] = useState('1 action');
  const [range, setRange] = useState('Self');
  const [duration, setDuration] = useState('Instantaneous');
  const [components, setComponents] = useState('V, S');
  const [materials, setMaterials] = useState('');
  
  // Details
  const [classes, setClasses] = useState<string[]>([]);
  const [ritual, setRitual] = useState(false);
  const [concentration, setConcentration] = useState(false);
  const [savingThrow, setSavingThrow] = useState('');
  const [areaOfEffect, setAreaOfEffect] = useState('');
  
  // Description
  const [description, setDescription] = useState('');
  
  // Origin management
  const [sourceManual, setSourceManual] = useState<string>('');
  const [customOriginName, setCustomOriginName] = useState('');

  useEffect(() => {
    if (spell && !isCreate) {
      setName(spell.name || '');
      setLevel(spell.level || 0);
      setSchool(spell.school || 'Evocation');
      setCastingTime(spell.castingTime || '1 action');
      setRange(spell.range || 'Self');
      setDuration(spell.duration || 'Instantaneous');
      setComponents(spell.components || 'V, S');
      setMaterials(spell.materials || '');
      setClasses(spell.classes || []);
      setRitual(spell.ritual || false);
      setConcentration(spell.concentration || false);
      setSavingThrow(spell.savingThrow || '');
      setAreaOfEffect(spell.areaOfEffect || '');
      setDescription(spell.description || '');
      
      // Set origin (non-editable when editing)
      setCustomOriginName(spell.customOriginName || '');
    } else if (isCreate) {
      // Reset to defaults for new spell
      setName('');
      setLevel(0);
      setSchool('Evocation');
      setCastingTime('1 action');
      setRange('Self');
      setDuration('Instantaneous');
      setComponents('V, S');
      setMaterials('');
      setClasses([]);
      setRitual(false);
      setConcentration(false);
      setSavingThrow('');
      setAreaOfEffect('');
      setDescription('');
      setSourceManual('');
      setCustomOriginName('');
    }
  }, [spell, isCreate, open]);

  const handleClassToggle = (className: string) => {
    setClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('El nombre del hechizo es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const customData = {
        name: name.trim(),
        level,
        school,
        castingTime: castingTime.trim(),
        range: range.trim(),
        duration: duration.trim(),
        components: components.trim(),
        materials: materials.trim() || undefined,
        classes: classes.length > 0 ? classes : undefined,
        ritual,
        concentration,
        savingThrow: savingThrow.trim() || undefined,
        areaOfEffect: areaOfEffect.trim() || undefined,
        description: description.trim() || undefined,
      };

      const payload: any = {
        sourceManualId: (sourceManual && sourceManual !== 'custom') ? sourceManual : undefined,
        customOriginName: customOriginName.trim() || undefined,
        customData,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving spell:', err);
      alert('Error al guardar el hechizo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isCreate ? t('create_spell', 'Crear Hechizo') : t('edit_spell', 'Editar Hechizo')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="Básico" />
          <Tab label="Detalles" />
          <Tab label="Descripción" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2} columns={12}>
            <Grid size={12}>
              <TextField 
                fullWidth 
                label="Nombre *" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                select 
                fullWidth 
                label="Nivel" 
                value={level} 
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {SPELL_LEVELS.map(lvl => (
                  <MenuItem key={lvl} value={lvl}>
                    {lvl === 0 ? 'Truco (Cantrip)' : `Nivel ${lvl}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField 
                select 
                fullWidth 
                label="Escuela" 
                value={school} 
                onChange={(e) => setSchool(e.target.value)}
              >
                {SCHOOLS.map(sch => (
                  <MenuItem key={sch} value={sch}>{sch}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Tiempo de Lanzamiento" 
                value={castingTime} 
                onChange={(e) => setCastingTime(e.target.value)}
                placeholder="1 action"
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Alcance" 
                value={range} 
                onChange={(e) => setRange(e.target.value)}
                placeholder="Self, Touch, 30 feet..."
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Duración" 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Instantaneous, 1 minute..."
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Componentes" 
                value={components} 
                onChange={(e) => setComponents(e.target.value)}
                placeholder="V, S, M"
              />
            </Grid>
            <Grid size={12}>
              <TextField 
                fullWidth 
                label="Materiales (opcional)" 
                value={materials} 
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="Descripción de materiales si aplica"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2} columns={12}>
            {isCreate && (
              <>
                <Grid size={12}>
                  <FormControl fullWidth>
                    <InputLabel id="source-manual-label">Origen</InputLabel>
                    <Select
                      labelId="source-manual-label"
                      value={sourceManual}
                      label="Origen"
                      onChange={(e) => setSourceManual(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Homebrew (sin manual)</em>
                      </MenuItem>
                      <MenuItem value="custom">
                        <em>Origen personalizado...</em>
                      </MenuItem>
                      {availableManuals.map((manual) => (
                        <MenuItem key={manual.id} value={manual.id}>
                          {manual.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {sourceManual === 'custom' && (
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Nombre del origen"
                      value={customOriginName}
                      onChange={(e) => setCustomOriginName(e.target.value)}
                      placeholder="Ej: Critical Role, Reddit u/usuario, Libro X..."
                      helperText="Este nombre aparecerá en lugar de 'Homebrew'"
                    />
                  </Grid>
                )}
                
                <Grid size={12}>
                  <Typography variant="caption" color="text.secondary">
                    {sourceManual && sourceManual !== 'custom'
                      ? 'Este hechizo se asociará al manual seleccionado' 
                      : sourceManual === 'custom'
                      ? 'Este hechizo será marcado con el origen que especifiques'
                      : 'Este hechizo será marcado como homebrew (creación propia)'}
                  </Typography>
                </Grid>
              </>
            )}
            <Grid size={12}>
              <Typography variant="subtitle2" gutterBottom>Clases que pueden lanzar este hechizo</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {CLASSES.map(cls => (
                  <Chip
                    key={cls}
                    label={cls}
                    color={classes.includes(cls) ? 'primary' : 'default'}
                    onClick={() => handleClassToggle(cls)}
                    variant={classes.includes(cls) ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Grid>
            <Grid size={6}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={ritual} 
                    onChange={(e) => setRitual(e.target.checked)} 
                  />
                }
                label="Ritual"
              />
            </Grid>
            <Grid size={6}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={concentration} 
                    onChange={(e) => setConcentration(e.target.checked)} 
                  />
                }
                label="Concentración"
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Salvación (opcional)" 
                value={savingThrow} 
                onChange={(e) => setSavingThrow(e.target.value)}
                placeholder="Dex, Con, Wis..."
              />
            </Grid>
            <Grid size={6}>
              <TextField 
                fullWidth 
                label="Área de Efecto (opcional)" 
                value={areaOfEffect} 
                onChange={(e) => setAreaOfEffect(e.target.value)}
                placeholder="15-foot cone, 20-foot radius..."
              />
            </Grid>
            {!isCreate && spell && (
              <>
                <Grid size={12}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Información de origen</Typography>
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Origen"
                    value={
                      spell.origin === 'manual' ? `Manual: ${spell.sourceManual || 'Desconocido'}` :
                      spell.origin === 'manual-edited' ? `Editado de: ${spell.sourceManual || 'Desconocido'}` :
                      spell.customOriginName || 'Homebrew'
                    }
                    InputProps={{ readOnly: true }}
                    helperText="El origen del hechizo no puede modificarse una vez creado"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2} columns={12}>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={12}
                label="Descripción (Markdown)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción completa del hechizo con sus efectos..."
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Puedes usar formato Markdown: **negrita**, *cursiva*, listas, etc.
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
