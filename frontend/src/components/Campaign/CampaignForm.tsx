import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign } from './types';
import { ImageUploader } from './ImageUploader';
import { FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, Box, CircularProgress, Typography } from '@mui/material';
import { api } from '../../apiBase';

interface CampaignFormProps {
  initial?: Partial<Campaign>;
  onSave: (data: Partial<Campaign>) => void;
  onCancel: () => void;
}

const CampaignForm: FC<CampaignFormProps> = ({ initial, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([]);
  const [availableManuals, setAvailableManuals] = useState<{ id: string; title: string }[]>([]);
  const [loadingManuals, setLoadingManuals] = useState(false);

  useEffect(() => {
    // Sincroniza el estado del formulario si el objeto inicial cambia
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setImageUrl(initial?.imageUrl || '');
    setSelectedManualIds(initial?.selectedManualIds || []);
  }, [initial]);

  // Load available manuals
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingManuals(true);
        const res = await api.get('/manuals');
        const manuals = (res.data || []).map((m: any) => ({ id: String(m.id), title: m.title || String(m.id) }));
        if (!mounted) return;
        setAvailableManuals(manuals);
      } catch (e) {
        // keep empty list
      } finally {
        if (mounted) setLoadingManuals(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const saveData: Partial<Campaign> = {
      name,
      description,
      selectedManualIds: selectedManualIds.length > 0 ? selectedManualIds : undefined,
    };

    if (imageUrl && /^(https?:\/\/|data:image\/)/.test(imageUrl)) {
      saveData.imageUrl = imageUrl;
    }

    onSave(saveData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 24, minWidth: 450, maxWidth: '100%' }}>
      <h2>{initial?.id ? t('edit_campaign', 'Editar campaña') : t('new_campaign', 'Nueva campaña')}</h2>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>{t('campaign_name', 'Nombre *')}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>{t('campaign_description', 'Descripción')}</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 8, boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>{t('campaign_image', 'Imagen de la Campaña')}</label>
        <ImageUploader
          initialValue={imageUrl}
          onChange={setImageUrl}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>{t('manuals_for_campaign', 'Manuales para esta campaña')}</label>
        {loadingManuals ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">{t('loading', 'Cargando...')}</Typography>
          </Box>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="select-manuals-label">{t('manuals', 'Manuales')}</InputLabel>
            <Select
              labelId="select-manuals-label"
              multiple
              value={selectedManualIds}
              onChange={(e) => setSelectedManualIds(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
              input={<OutlinedInput id="select-manuals" label={t('manuals', 'Manuales')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const m = availableManuals.find((x) => x.id === value);
                    return <Chip key={value} label={m?.title || value} size="small" />;
                  })}
                </Box>
              )}
            >
              {availableManuals.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px' }}>{t('cancel', 'Cancelar')}</button>
        <button type="submit" disabled={!name.trim()} style={{ padding: '8px 16px' }}>{t('save', 'Guardar')}</button>
      </div>
    </form>
  );
};

export default CampaignForm;