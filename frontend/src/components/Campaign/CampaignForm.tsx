import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign } from './types';

interface CampaignFormProps {
  initial?: Partial<Campaign>;
  onSave: (data: Partial<Campaign>) => void;
  onCancel: () => void;
}


const CampaignForm: FC<CampaignFormProps> = ({ initial = {}, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [imageUrl, setImageUrl] = useState(initial.imageUrl || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, description, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 24, minWidth: 320 }}>
      <h2>{initial.name ? t('edit_campaign', 'Editar campaña') : t('new_campaign', 'Nueva campaña')}</h2>
      <div style={{ marginBottom: 16 }}>
        <label>{t('campaign_name', 'Nombre *')}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>{t('campaign_description', 'Descripción')}</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>{t('campaign_image_url', 'URL de imagen (opcional)')}</label>
        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel}>{t('cancel', 'Cancelar')}</button>
        <button type="submit" disabled={!name.trim()}>{t('save', 'Guardar')}</button>
      </div>
    </form>
  );
};

export default CampaignForm;
