import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, MenuItem, IconButton, Box, Typography, Divider, Tabs, Tab, FormControl,
  InputLabel, Select
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface CreateMonsterDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  availableManuals: { id: string; name: string }[];
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

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const TYPES = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];

export default function CreateMonsterDialog({ open, onClose, onSave, availableManuals }: CreateMonsterDialogProps) {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Origin selection
  const [sourceManual, setSourceManual] = useState<string>('');
  const [customOriginName, setCustomOriginName] = useState<string>('');
  
  // Basic info
  const [name, setName] = useState('');
  const [size, setSize] = useState('Medium');
  const [type, setType] = useState('humanoid');
  const [subtype, setSubtype] = useState('');
  const [alignment, setAlignment] = useState('');
  const [challengeRating, setChallengeRating] = useState('0');
  const [experiencePoints, setExperiencePoints] = useState('0');
  
  // Combat stats
  const [acValue, setAcValue] = useState('10');
  const [acType, setAcType] = useState('');
  const [hpAverage, setHpAverage] = useState('10');
  const [hpRoll, setHpRoll] = useState('');
  const [speedWalk, setSpeedWalk] = useState('30');
  const [speedFly, setSpeedFly] = useState('');
  const [speedSwim, setSpeedSwim] = useState('');
  const [speedClimb, setSpeedClimb] = useState('');
  const [speedBurrow, setSpeedBurrow] = useState('');
  
  // Abilities
  const [str, setStr] = useState('10');
  const [dex, setDex] = useState('10');
  const [con, setCon] = useState('10');
  const [int, setInt] = useState('10');
  const [wis, setWis] = useState('10');
  const [cha, setCha] = useState('10');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [damageResistances, setDamageResistances] = useState('');
  const [damageImmunities, setDamageImmunities] = useState('');
  const [damageVulnerabilities, setDamageVulnerabilities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');
  
  // Traits
  const [traits, setTraits] = useState('');
  const [actions, setActions] = useState('');
  const [reactions, setReactions] = useState('');
  const [legendaryActions, setLegendaryActions] = useState('');
  const [description, setDescription] = useState('');
  
  // Images
  const [illustrationUrl, setIllustrationUrl] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [tokenKind, setTokenKind] = useState<'color' | 'image'>('color');
  const [tokenColor, setTokenColor] = useState('#808080');

  const parseTraitsBlock = (text: string): Array<{ name?: string; text: string }> => {
    if (!text.trim()) return [];
    const blocks = text.split(/\n\n+/);
    return blocks.map(block => {
      const lines = block.split('\n');
      const firstLine = lines[0];
      const nameMatch = firstLine.match(/^\*\*(.+?)\*\*/);
      if (nameMatch) {
        const name = nameMatch[1];
        const rest = firstLine.substring(nameMatch[0].length).trim();
        const remainingLines = lines.slice(1);
        const text = [rest, ...remainingLines].filter(l => l).join('\n');
        return { name, text };
      }
      return { text: block };
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleIllustrationFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setIllustrationUrl(base64);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  const handleTokenFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setTokenUrl(base64);
        setTokenKind('image');
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const speed: Record<string, number> = {};
      if (speedWalk) speed.walk = parseInt(speedWalk);
      if (speedFly) speed.fly = parseInt(speedFly);
      if (speedSwim) speed.swim = parseInt(speedSwim);
      if (speedClimb) speed.climb = parseInt(speedClimb);
      if (speedBurrow) speed.burrow = parseInt(speedBurrow);

      const customData: any = {
        name: name.trim(),
        size,
        type,
        subtype: subtype || undefined,
        alignment: alignment || undefined,
        challengeRating: challengeRating || undefined,
        experiencePoints: experiencePoints ? parseInt(experiencePoints) : undefined,
        armorClass: {
          value: parseInt(acValue),
          type: acType || undefined,
        },
        hitPoints: {
          average: parseInt(hpAverage),
          roll: hpRoll || undefined,
        },
        speed,
        abilities: {
          str: parseInt(str),
          dex: parseInt(dex),
          con: parseInt(con),
          int: parseInt(int),
          wis: parseInt(wis),
          cha: parseInt(cha),
        },
        senses: senses || undefined,
        languages: languages || undefined,
        damageResistances: damageResistances ? damageResistances.split(',').map(s => s.trim()) : undefined,
        damageImmunities: damageImmunities ? damageImmunities.split(',').map(s => s.trim()) : undefined,
        damageVulnerabilities: damageVulnerabilities ? damageVulnerabilities.split(',').map(s => s.trim()) : undefined,
        conditionImmunities: conditionImmunities ? conditionImmunities.split(',').map(s => s.trim()) : undefined,
        traits: parseTraitsBlock(traits),
        actions: parseTraitsBlock(actions),
        reactions: parseTraitsBlock(reactions),
        legendaryActions: parseTraitsBlock(legendaryActions),
        description: description || undefined,
      };

      const payload: any = {
        sourceManualId: (sourceManual && sourceManual !== 'custom') ? sourceManual : undefined,
        customOriginName: customOriginName.trim() || undefined,
        customData,
      };

      // Add image data if provided
      if (illustrationUrl) {
        payload.imageUrls = { medium: illustrationUrl };
      }
      if (tokenKind === 'image' && tokenUrl) {
        payload.tokenKind = 'image';
        payload.tokenImageUrl = tokenUrl;
      } else if (tokenKind === 'color' && tokenColor) {
        payload.tokenKind = 'color';
        payload.tokenColor = tokenColor;
      }

      await onSave(payload);

      // Reset form
      setSourceManual('');
      setCustomOriginName('');
      setName('');
      setSize('Medium');
      setType('humanoid');
      setSubtype('');
      setAlignment('');
      setChallengeRating('0');
      setExperiencePoints('0');
      setAcValue('10');
      setAcType('');
      setHpAverage('10');
      setHpRoll('');
      setSpeedWalk('30');
      setSpeedFly('');
      setSpeedSwim('');
      setSpeedClimb('');
      setSpeedBurrow('');
      setStr('10');
      setDex('10');
      setCon('10');
      setInt('10');
      setWis('10');
      setCha('10');
      setSenses('');
      setLanguages('');
      setDamageResistances('');
      setDamageImmunities('');
      setDamageVulnerabilities('');
      setConditionImmunities('');
      setTraits('');
      setActions('');
      setReactions('');
      setLegendaryActions('');
      setDescription('');
      setIllustrationUrl('');
      setTokenUrl('');
      setTokenKind('color');
      setTokenColor('#808080');
      setTabValue(0);

      onClose();
    } catch (error) {
      console.error('Error creating monster:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('create_monster', 'Crear Monstruo')}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
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
          
          {sourceManual === 'custom' && (
            <TextField
              fullWidth
              label="Nombre del origen"
              value={customOriginName}
              onChange={(e) => setCustomOriginName(e.target.value)}
              placeholder="Ej: Critical Role, Reddit u/usuario, Libro X..."
              sx={{ mt: 2 }}
              helperText="Este nombre aparecerá en lugar de 'Homebrew'"
            />
          )}
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {sourceManual && sourceManual !== 'custom'
              ? 'Este monstruo se asociará al manual seleccionado' 
              : sourceManual === 'custom'
              ? 'Este monstruo será marcado con el origen que especifiques'
              : 'Este monstruo será marcado como homebrew (creación propia)'}
          </Typography>
        </Box>

        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Básico" />
          <Tab label="Combate" />
          <Tab label="Habilidades" />
          <Tab label="Rasgos" />
          <Tab label="Imágenes" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2} columns={12}>
            <Grid size={12}>
              <TextField fullWidth label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
            </Grid>
            <Grid size={4}>
              <TextField select fullWidth label="Tamaño" value={size} onChange={(e) => setSize(e.target.value)}>
                {SIZES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={4}>
              <TextField select fullWidth label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={4}>
              <TextField fullWidth label="Subtipo" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Alineamiento" value={alignment} onChange={(e) => setAlignment(e.target.value)} />
            </Grid>
            <Grid size={3}>
              <TextField fullWidth label="CR" value={challengeRating} onChange={(e) => setChallengeRating(e.target.value)} />
            </Grid>
            <Grid size={3}>
              <TextField fullWidth label="XP" value={experiencePoints} onChange={(e) => setExperiencePoints(e.target.value)} />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2} columns={12}>
            <Grid size={6}>
              <TextField fullWidth label="Armadura (valor)" value={acValue} onChange={(e) => setAcValue(e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Armadura (tipo)" value={acType} onChange={(e) => setAcType(e.target.value)} placeholder="natural armor" />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="HP (promedio)" value={hpAverage} onChange={(e) => setHpAverage(e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="HP (tirada)" value={hpRoll} onChange={(e) => setHpRoll(e.target.value)} placeholder="5d8 + 10" />
            </Grid>
            <Grid size={12}>
              <Divider sx={{ my: 1 }}><Typography variant="caption">Velocidad</Typography></Divider>
            </Grid>
            <Grid size={2.4}>
              <TextField fullWidth label="Caminar" value={speedWalk} onChange={(e) => setSpeedWalk(e.target.value)} />
            </Grid>
            <Grid size={2.4}>
              <TextField fullWidth label="Volar" value={speedFly} onChange={(e) => setSpeedFly(e.target.value)} />
            </Grid>
            <Grid size={2.4}>
              <TextField fullWidth label="Nadar" value={speedSwim} onChange={(e) => setSpeedSwim(e.target.value)} />
            </Grid>
            <Grid size={2.4}>
              <TextField fullWidth label="Trepar" value={speedClimb} onChange={(e) => setSpeedClimb(e.target.value)} />
            </Grid>
            <Grid size={2.4}>
              <TextField fullWidth label="Excavar" value={speedBurrow} onChange={(e) => setSpeedBurrow(e.target.value)} />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2} columns={12}>
            <Grid size={2}>
              <TextField fullWidth label="FUE" value={str} onChange={(e) => setStr(e.target.value)} />
            </Grid>
            <Grid size={2}>
              <TextField fullWidth label="DES" value={dex} onChange={(e) => setDex(e.target.value)} />
            </Grid>
            <Grid size={2}>
              <TextField fullWidth label="CON" value={con} onChange={(e) => setCon(e.target.value)} />
            </Grid>
            <Grid size={2}>
              <TextField fullWidth label="INT" value={int} onChange={(e) => setInt(e.target.value)} />
            </Grid>
            <Grid size={2}>
              <TextField fullWidth label="SAB" value={wis} onChange={(e) => setWis(e.target.value)} />
            </Grid>
            <Grid size={2}>
              <TextField fullWidth label="CAR" value={cha} onChange={(e) => setCha(e.target.value)} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Sentidos" value={senses} onChange={(e) => setSenses(e.target.value)} placeholder="darkvision 60 ft, passive Perception 12" />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Idiomas" value={languages} onChange={(e) => setLanguages(e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Resistencias" value={damageResistances} onChange={(e) => setDamageResistances(e.target.value)} placeholder="fire, cold" />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Inmunidades" value={damageImmunities} onChange={(e) => setDamageImmunities(e.target.value)} placeholder="poison" />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Vulnerabilidades" value={damageVulnerabilities} onChange={(e) => setDamageVulnerabilities(e.target.value)} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Inmunidades (cond.)" value={conditionImmunities} onChange={(e) => setConditionImmunities(e.target.value)} placeholder="charmed, frightened" />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2} columns={12}>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Rasgos"
                value={traits}
                onChange={(e) => setTraits(e.target.value)}
                placeholder="**Rasgo 1**&#10;Descripción del rasgo&#10;&#10;**Rasgo 2**&#10;Otra descripción"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Acciones"
                value={actions}
                onChange={(e) => setActions(e.target.value)}
                placeholder="**Acción 1**&#10;Descripción&#10;&#10;**Acción 2**&#10;Otra acción"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reacciones"
                value={reactions}
                onChange={(e) => setReactions(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Acciones Legendarias"
                value={legendaryActions}
                onChange={(e) => setLegendaryActions(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={2} columns={12}>
            <Grid size={12}>
              <Typography variant="h6" gutterBottom>Ilustración del Monstruo</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Imagen principal que se mostrará en la ficha del monstruo
              </Typography>
            </Grid>
            <Grid size={6}>
              <Button variant="outlined" component="label" fullWidth>
                Cargar archivo
                <input type="file" hidden accept="image/*" onChange={handleIllustrationFileUpload} />
              </Button>
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="O pegar URL"
                value={illustrationUrl}
                onChange={(e) => setIllustrationUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </Grid>
            {illustrationUrl && (
              <Grid size={12}>
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <img src={illustrationUrl} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
                </Box>
              </Grid>
            )}
            
            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>Token para el Mapa</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Imagen o color que representará al monstruo en el mapa de batalla
              </Typography>
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Token</InputLabel>
                <Select
                  value={tokenKind}
                  label="Tipo de Token"
                  onChange={(e) => setTokenKind(e.target.value as 'color' | 'image')}
                >
                  <MenuItem value="color">Color sólido</MenuItem>
                  <MenuItem value="image">Imagen</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {tokenKind === 'color' ? (
              <Grid size={12}>
                <TextField
                  fullWidth
                  type="color"
                  label="Color del Token"
                  value={tokenColor}
                  onChange={(e) => setTokenColor(e.target.value)}
                />
              </Grid>
            ) : (
              <>
                <Grid size={6}>
                  <Button variant="outlined" component="label" fullWidth>
                    Cargar archivo
                    <input type="file" hidden accept="image/*" onChange={handleTokenFileUpload} />
                  </Button>
                </Grid>
                <Grid size={6}>
                  <TextField
                    fullWidth
                    label="O pegar URL"
                    value={tokenUrl}
                    onChange={(e) => setTokenUrl(e.target.value)}
                    placeholder="https://ejemplo.com/token.png"
                  />
                </Grid>
                {tokenUrl && (
                  <Grid size={12}>
                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                      <img src={tokenUrl} alt="Vista previa token" style={{ maxWidth: 100, maxHeight: 100, borderRadius: '50%' }} />
                    </Box>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? t('saving', 'Guardando...') : t('create', 'Crear')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
