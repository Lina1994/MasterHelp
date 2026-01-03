import React, { useState } from 'react';
import { CharacterPayload, updateCharacter, createCharacter, deleteCharacter } from '../../api/characters';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../../utils/getCurrentUser';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormHelperText, IconButton, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { ImageUploader } from '../Campaign/ImageUploader';

export interface CharacterEditorModalProps {
  open: boolean;
  initialDraft: CharacterPayload | null;
  onClose: () => void;
  onSaved?: (updated: CharacterPayload) => void;
  campaignPlayers: { id: number; label: string }[];
  isMaster: boolean;
}

export const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({
  open,
  initialDraft,
  onClose,
  onSaved,
  campaignPlayers,
  isMaster,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CharacterPayload | null>(initialDraft);
  const [tab, setTab] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  React.useEffect(() => {
    setDraft(initialDraft);
    setTab(0);
    setErrorText(null);
  }, [initialDraft, open]);

  const onSave = async () => {
    if (!draft) return;
    const { ownerPlayer, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, campaign: _campaign, ...rest } = draft as any;
    const payload: Partial<CharacterPayload> = { ...rest };
    delete (payload as any).ownerPlayer;
    if (payload.ownerPlayerId === undefined && (draft as any).ownerPlayer?.id !== undefined) {
      payload.ownerPlayerId = (draft as any).ownerPlayer?.id ?? null;
    }
    if (payload.ownerPlayerId === ('' as any)) {
      payload.ownerPlayerId = null;
    }
    if ((payload as any).spellcastingAbility === '' || (payload as any).spellcastingAbility === null) {
      delete (payload as any).spellcastingAbility;
    }
    if ((payload as any).spellSaveDC === '' || (payload as any).spellSaveDC === null) {
      delete (payload as any).spellSaveDC;
    }
    if ((payload as any).spellAttackBonus === '' || (payload as any).spellAttackBonus === null) {
      delete (payload as any).spellAttackBonus;
    }
    if (!(payload as any).tokenKind) {
      delete (payload as any).tokenKind;
    }
    try {
      let updated: CharacterPayload;
      if (draft.id) {
        updated = await updateCharacter(draft.id, payload);
      } else {
        updated = await createCharacter(payload as CharacterPayload);
      }
      setErrorText(null);
      onClose();
      if (onSaved) onSaved(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar';
      setErrorText(Array.isArray(msg) ? msg.join(', ') : String(msg));
      console.error('[CharacterEditorModal] Save failed:', err?.response?.data || err);
    }
  };

  if (!draft) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{draft?.id ? t('edit_character','Editar personaje') : t('new_character','Nuevo personaje')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mt: 1 }}>
          {errorText && (
            <Typography color="error" sx={{ mb: 1 }}>{errorText}</Typography>
          )}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label={t('sheet','Ficha')} />
            <Tab label={t('description_token','Descripción y Token')} />
            <Tab label={t('magic','Magia')} />
            <Tab label={t('privacy','Privacidad')} />
          </Tabs>
          {tab === 0 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField label={t('name','Nombre del Personaje')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} fullWidth />
              <ToggleButtonGroup exclusive value={draft.kind} onChange={(e, val) => val && setDraft({ ...draft, kind: val })}>
                <ToggleButton value="pc">{t('pc','Jugador')}</ToggleButton>
                <ToggleButton value="npc">{t('npc','NPC')}</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={2}>
                <TextField label={t('class','Clase')} value={draft.className || ''} onChange={(e) => setDraft({ ...draft, className: e.target.value })} />
                <TextField type="number" label={t('level','Nivel')} value={draft.level ?? 1} onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })} />
                <TextField label={t('race','Raza')} value={draft.race || ''} onChange={(e) => setDraft({ ...draft, race: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label={t('background','Trasfondo')} value={draft.background || ''} onChange={(e) => setDraft({ ...draft, background: e.target.value })} />
                <TextField label={t('alignment','Alineamiento')} value={draft.alignment || ''} onChange={(e) => setDraft({ ...draft, alignment: e.target.value })} />
                {draft.kind === 'pc' && (
                  <TextField label={t('player_name','Nombre del Jugador')} value={draft.playerName || ''} onChange={(e) => setDraft({ ...draft, playerName: e.target.value })} />
                )}
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField type="number" label={t('proficiency_bonus','Bonificación por Competencia')} value={draft.proficiencyBonus ?? 2} onChange={(e) => setDraft({ ...draft, proficiencyBonus: Number(e.target.value) })} />
                <TextField type="number" label="AC" value={draft.armorClass ?? 10} onChange={(e) => setDraft({ ...draft, armorClass: Number(e.target.value) })} />
                <TextField type="number" label={t('initiative','Iniciativa')} value={draft.initiative ?? 0} onChange={(e) => setDraft({ ...draft, initiative: Number(e.target.value) })} />
                <TextField label={t('speed','Velocidad')} value={draft.speed || ''} onChange={(e) => setDraft({ ...draft, speed: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField type="number" label={t('max_hp','PG Máx.')} value={draft.maxHp ?? 8} onChange={(e) => setDraft({ ...draft, maxHp: Number(e.target.value) })} />
                <TextField type="number" label={t('hp','PG')} value={draft.currentHp ?? 8} onChange={(e) => setDraft({ ...draft, currentHp: Number(e.target.value) })} />
                <TextField type="number" label={t('temp_hp','PG Temp.')} value={draft.tempHp ?? 0} onChange={(e) => setDraft({ ...draft, tempHp: Number(e.target.value) })} />
                <TextField label={t('hit_dice','Dados de Golpe')} value={draft.hitDice || ''} onChange={(e) => setDraft({ ...draft, hitDice: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                {(['str','dex','con','int','wis','cha'] as const).map((k) => (
                  <TextField key={k} type="number" label={k.toUpperCase()} value={(draft as any)[k] ?? 10} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) } as any)} />
                ))}
              </Stack>
              <TextField label={t('other_proficiencies','Otras Competencias e Idiomas')} value={draft.otherProficienciesAndLanguages || ''} onChange={(e) => setDraft({ ...draft, otherProficienciesAndLanguages: e.target.value })} fullWidth multiline minRows={2} />
              <TextField label={t('equipment','Equipo')} value={draft.equipment || ''} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} fullWidth multiline minRows={2} />
              <TextField label={t('traits_and_features','Rasgos y Atributos')} value={draft.traitsAndFeatures || ''} onChange={(e) => setDraft({ ...draft, traitsAndFeatures: e.target.value })} fullWidth multiline minRows={2} />
            </Stack>
          )}
          {tab === 1 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={2}>
                <TextField label={t('age','Edad')} value={draft.age || ''} onChange={(e) => setDraft({ ...draft, age: e.target.value })} />
                <TextField label={t('height','Altura')} value={draft.height || ''} onChange={(e) => setDraft({ ...draft, height: e.target.value })} />
                <TextField label={t('weight','Peso')} value={draft.weight || ''} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label={t('eyes','Ojos')} value={draft.eyes || ''} onChange={(e) => setDraft({ ...draft, eyes: e.target.value })} />
                <TextField label={t('skin','Piel')} value={draft.skin || ''} onChange={(e) => setDraft({ ...draft, skin: e.target.value })} />
                <TextField label={t('hair','Pelo')} value={draft.hair || ''} onChange={(e) => setDraft({ ...draft, hair: e.target.value })} />
              </Stack>
              <Typography variant="subtitle2">{t('character_image','Imagen del Personaje')}</Typography>
              <ImageUploader initialValue={draft.characterImageUrl} onChange={(v) => setDraft({ ...draft, characterImageUrl: v })} />
              <Typography variant="subtitle2" sx={{ mt: 2 }}>{t('token','Token/Imagen')}</Typography>
              <ToggleButtonGroup exclusive value={draft.tokenKind || null} onChange={(e, val) => val && setDraft({ ...draft, tokenKind: val })}>
                <ToggleButton value="color">{t('color','Color')}</ToggleButton>
                <ToggleButton value="image">{t('image','Imagen')}</ToggleButton>
              </ToggleButtonGroup>
              {draft.tokenKind === 'color' && (
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField label={t('token_color','Color del token')} value={draft.tokenColor || '#ff0000'} onChange={(e) => setDraft({ ...draft, tokenColor: e.target.value })} />
                  <input type="color" value={draft.tokenColor || '#ff0000'} onChange={(e) => setDraft({ ...draft, tokenColor: e.target.value })} />
                </Stack>
              )}
              {draft.tokenKind === 'image' && (
                <>
                  <Typography variant="subtitle2">{t('token_image','Imagen del token')}</Typography>
                  <ImageUploader initialValue={draft.tokenImageUrl || ''} onChange={(v) => setDraft({ ...draft, tokenImageUrl: v })} />
                </>
              )}
              <TextField label={t('allies_orgs','Aliados y organizaciones')} value={draft.alliesAndOrganizations || ''} onChange={(e) => setDraft({ ...draft, alliesAndOrganizations: e.target.value })} fullWidth multiline minRows={2} />
              <TextField label={t('backstory','Historia del personaje')} value={draft.backstory || ''} onChange={(e) => setDraft({ ...draft, backstory: e.target.value })} fullWidth multiline minRows={3} />
              <TextField label={t('treasure','Tesoro')} value={draft.treasure || ''} onChange={(e) => setDraft({ ...draft, treasure: e.target.value })} fullWidth multiline minRows={2} />
            </Stack>
          )}
          {tab === 2 && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="spell-ability-label">{t('spellcasting_ability','Aptitud Mágica')}</InputLabel>
                <Select labelId="spell-ability-label" label={t('spellcasting_ability','Aptitud Mágica')} value={draft.spellcastingAbility || ''} onChange={(e) => setDraft({ ...draft, spellcastingAbility: (e.target.value || null) as any })}>
                  <MenuItem value="">{t('none','Ninguna')}</MenuItem>
                  <MenuItem value="int">INT</MenuItem>
                  <MenuItem value="wis">WIS</MenuItem>
                  <MenuItem value="cha">CHA</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <TextField type="number" label={t('spell_save_dc','CD Salvación Conjuros')} value={draft.spellSaveDC ?? ''} onChange={(e) => setDraft({ ...draft, spellSaveDC: e.target.value === '' ? null : Number(e.target.value) })} />
                <TextField type="number" label={t('spell_attack_bonus','Bonificador Ataque Conjuro')} value={draft.spellAttackBonus ?? ''} onChange={(e) => setDraft({ ...draft, spellAttackBonus: e.target.value === '' ? null : Number(e.target.value) })} />
              </Stack>
              <TextField
                label={t('cantrips','Trucos (coma separada)')}
                value={(draft.cantrips || []).join(', ')}
                onChange={(e) => setDraft({ ...draft, cantrips: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                fullWidth
              />
              {(['1','2','3','4','5','6','7','8'] as const).map((lvl) => (
                <TextField
                  key={lvl}
                  label={`${t('spells_level','Conjuros nivel')} ${lvl} (coma separada)`}
                  value={((draft.spellsByLevel || {})[lvl] || []).join(', ')}
                  onChange={(e) => setDraft({ ...draft, spellsByLevel: { ...(draft.spellsByLevel || {}), [lvl]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                  fullWidth
                />
              ))}
            </Stack>
          )}
          {tab === 3 && (
            <Stack sx={{ mt: 2 }} spacing={2}>
              {isMaster && (
                <FormControl fullWidth>
                  <InputLabel id="owner-select-label">Asignar a jugador</InputLabel>
                  <Select
                    labelId="owner-select-label"
                    label="Asignar a jugador"
                    value={draft.ownerPlayerId != null ? String(draft.ownerPlayerId) : ''}
                    onChange={(e) => {
                      const raw = String(e.target.value);
                      const val = raw === '' ? null : Number(raw);
                      setDraft({ ...draft, ownerPlayerId: val });
                    }}
                  >
                    <MenuItem value="">Sin asignar (NPC)</MenuItem>
                    {campaignPlayers.map((p) => (
                      <MenuItem key={p.id} value={String(p.id)}>{p.label}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>El master puede asignar o quitar propietario del personaje.</FormHelperText>
                </FormControl>
              )}
              <FormControlLabel
                control={<Checkbox checked={!!draft.visibleToPlayers} onChange={(e) => setDraft({ ...draft, visibleToPlayers: e.target.checked })} disabled={!isMaster} />}
                label={t('visible_to_players','Visible a jugadores')}
              />
              {!isMaster && (
                <FormHelperText>{t('only_master_can_change_visibility','Solo el master puede cambiar este valor')}</FormHelperText>
              )}
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel','Cancelar')}</Button>
        <Button onClick={onSave} variant="contained">{t('save','Guardar')}</Button>
      </DialogActions>
    </Dialog>
  );
};
