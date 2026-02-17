import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
} from '@mui/material';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { createShop, updateShop, Shop } from '../../api/shops';

interface ShopFormDialogProps {
  open: boolean;
  shop: Shop | null;
  onClose: (shouldReload?: boolean) => void;
}

export const ShopFormDialog: React.FC<ShopFormDialogProps> = ({ open, shop, onClose }) => {
  const { activeCampaign } = useActiveCampaign();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setDescription(shop.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [shop, open]);

  const handleSave = async () => {
    if (!name.trim() || !activeCampaign?.id) return;

    setSaving(true);
    try {
      if (shop) {
        await updateShop(shop.id, { name, description });
      } else {
        await createShop({ name, description, campaignId: activeCampaign.id });
      }
      onClose(true);
    } catch (error: any) {
      console.error('Failed to save shop:', error);
      alert(error?.response?.data?.message || 'Error al guardar tienda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{shop ? 'Editar Tienda' : 'Nueva Tienda'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !name.trim()}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
