import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import { Shop, ShopSection, createSection } from '../../api/shops';
import { SectionManager } from './SectionManager';

interface ShopDetailProps {
  shop: Shop;
  onBack: () => void;
  onUpdate: () => void;
}

export const ShopDetail: React.FC<ShopDetailProps> = ({ shop, onBack, onUpdate }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [sections, setSections] = useState<ShopSection[]>(shop.sections || []);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Sync sections when shop changes
  useEffect(() => {
    setSections(shop.sections || []);
  }, [shop]);

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;

    try {
      const newSection = await createSection(shop.id, { name: newSectionName, order: sections.length });
      setSections([...sections, newSection]);
      setCreateDialogOpen(false);
      setNewSectionName('');
      onUpdate();
    } catch (error: any) {
      console.error('Failed to create section:', error);
      alert(error?.response?.data?.message || 'Error al crear sección');
    }
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">{shop.name}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateDialogOpen(true)}>
          Nueva Sección
        </Button>
      </Stack>

      {shop.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {shop.description}
        </Typography>
      )}

      {sortedSections.length === 0 ? (
        <Typography color="text.secondary">
          No hay secciones. Crea una para empezar.
        </Typography>
      ) : (
        <>
          <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 2 }}>
            {sortedSections.map((section, idx) => (
              <Tab key={section.id} label={section.name} />
            ))}
          </Tabs>

          {sortedSections[selectedTab] && (
            <SectionManager
              section={sortedSections[selectedTab]}
              onUpdate={() => {
                onUpdate();
                // Reload sections
                setSections(shop.sections || []);
              }}
            />
          )}
        </>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Sección</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre de la sección"
            fullWidth
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateSection();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewSectionName('');
          }}>
            Cancelar
          </Button>
          <Button onClick={handleCreateSection} variant="contained" disabled={!newSectionName.trim()}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
