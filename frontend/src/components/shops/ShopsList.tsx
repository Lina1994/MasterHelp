import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { listShops, deleteShop, Shop } from '../../api/shops';
import { ShopFormDialog } from './ShopFormDialog';
import { ShopDetail } from './ShopDetail';
import ConfirmDialog from '../common/ConfirmDialog';

export const ShopsList: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);

  const load = async () => {
    if (!activeCampaign?.id) return;
    setLoading(true);
    try {
      const data = await listShops(activeCampaign.id);
      setShops(data);
      
      // Update selectedShop if it's currently selected
      if (selectedShop) {
        const updatedShop = data.find(s => s.id === selectedShop.id);
        if (updatedShop) {
          setSelectedShop(updatedShop);
        }
      }
    } catch (error) {
      console.error('Failed to load shops:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id]);

  const handleCreate = () => {
    setEditingShop(null);
    setOpenDialog(true);
  };

  const handleEdit = (shop: Shop) => {
    setEditingShop(shop);
    setOpenDialog(true);
  };

  const handleDelete = (shop: Shop) => {
    setShopToDelete(shop);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shopToDelete) return;
    try {
      await deleteShop(shopToDelete.id);
      await load();
      if (selectedShop?.id === shopToDelete.id) {
        setSelectedShop(null);
      }
    } catch (error: any) {
      console.error('Failed to delete shop:', error);
      alert(error?.response?.data?.message || 'Error al eliminar tienda');
    } finally {
      setDeleteConfirmOpen(false);
      setShopToDelete(null);
    }
  };

  const handleDialogClose = async (shouldReload?: boolean) => {
    setOpenDialog(false);
    setEditingShop(null);
    if (shouldReload) {
      await load();
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedShop) {
    return (
      <ShopDetail
        shop={selectedShop}
        onBack={() => setSelectedShop(null)}
        onUpdate={load}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Tiendas</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleCreate}>
          Nueva Tienda
        </Button>
      </Stack>

      <TextField
        placeholder="Buscar tiendas..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
      />

      {loading ? (
        <Typography>Cargando...</Typography>
      ) : filteredShops.length === 0 ? (
        <Typography color="text.secondary">
          {searchTerm ? 'No se encontraron tiendas' : 'No hay tiendas creadas'}
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {filteredShops.map((shop) => (
            <Grid key={shop.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 4 },
                  transition: 'box-shadow 0.2s',
                }}
                onClick={() => setSelectedShop(shop)}
              >
                <CardHeader
                  avatar={<StorefrontIcon />}
                  title={shop.name}
                  action={
                    <Stack direction="row">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(shop);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(shop);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                />
                {shop.description && (
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {shop.description}
                    </Typography>
                  </CardContent>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ShopFormDialog
        open={openDialog}
        shop={editingShop}
        onClose={handleDialogClose}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminar tienda"
        message={`¿Estás seguro de que quieres eliminar "${shopToDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </Box>
  );
};
