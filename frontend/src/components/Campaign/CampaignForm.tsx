import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Campaign } from './types';
import { ImageUploader } from './ImageUploader';

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

  useEffect(() => {
    // Sincroniza el estado del formulario si el objeto inicial cambia
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setImageUrl(initial?.imageUrl || '');
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const saveData: Partial<Campaign> = {
      name,
      description,
    };

    if (imageUrl) {
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px' }}>{t('cancel', 'Cancelar')}</button>
        <button type="submit" disabled={!name.trim()} style={{ padding: '8px 16px' }}>{t('save', 'Guardar')}</button>
      </div>
    </form>
  );
};

export default CampaignForm;