import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadIcon from '@mui/icons-material/Upload';
import { EMOJI_CATEGORIES, readRecentEmojis, recordRecentEmoji } from './emojiData';

type EmojiPickerDialogProps = {
  open: boolean;
  value: string;
  imageUrl?: string | null;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  onUploadImage?: () => void;
  isUploadingImage?: boolean;
};

const RECENT_TAB_ID = 'recent';
const IMAGE_TAB_ID = 'custom-image';

/**
 * Emoji and custom image picker dialog with categorized grids and a recent-emojis row.
 */
const EmojiPickerDialog = ({
  open,
  value,
  imageUrl,
  onClose,
  onSelect,
  onUploadImage,
  isUploadingImage,
}: EmojiPickerDialogProps) => {
  const [activeTab, setActiveTab] = useState<string>(RECENT_TAB_ID);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis());

  useEffect(() => {
    if (!open) return;

    if (imageUrl) {
      setActiveTab(IMAGE_TAB_ID);
    } else {
      const activeCategory = EMOJI_CATEGORIES.find((category) => category.emojis.includes(value));
      setActiveTab(activeCategory?.id || (recentEmojis.length > 0 ? RECENT_TAB_ID : EMOJI_CATEGORIES[0]?.id || RECENT_TAB_ID));
    }
    setRecentEmojis(readRecentEmojis());
  }, [open, recentEmojis.length, value, imageUrl]);

  const currentCategory = useMemo(() => {
    if (activeTab === RECENT_TAB_ID || activeTab === IMAGE_TAB_ID) return null;
    return EMOJI_CATEGORIES.find((category) => category.id === activeTab) || EMOJI_CATEGORIES[0] || null;
  }, [activeTab]);

  const currentEmojis = activeTab === RECENT_TAB_ID
    ? recentEmojis
    : currentCategory?.emojis || [];

  const currentTitle = activeTab === RECENT_TAB_ID
    ? 'Recientes'
    : currentCategory?.label || '';

  const handleSelect = (emoji: string) => {
    setRecentEmojis(recordRecentEmoji(emoji));
    onSelect(emoji);
    onClose();
  };

  const handleClear = () => {
    onSelect('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        Selector de iconos
        <IconButton
          aria-label="Cerrar selector de iconos"
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Elige un emoji de las categorías o sube una imagen personalizada para el icono.
            </Typography>
          </Box>

          <Box sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'background.paper', pb: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(_, nextTab: string) => setActiveTab(nextTab)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ minHeight: 42 }}
            >
              {recentEmojis.length > 0 ? <Tab value={RECENT_TAB_ID} label="Recientes" /> : null}
              {onUploadImage ? <Tab value={IMAGE_TAB_ID} label="Imagen" /> : null}
              {EMOJI_CATEGORIES.map((category) => (
                <Tab key={category.id} value={category.id} label={category.label} />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ maxHeight: '46vh', overflowY: 'auto', pr: 0.5 }}>
            {activeTab === IMAGE_TAB_ID ? (
              <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4, minHeight: 200 }}>
                {imageUrl ? (
                  <Stack alignItems="center" spacing={2}>
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: 3,
                        overflow: 'hidden',
                        border: '2px solid',
                        borderColor: 'primary.main',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt="Icono subido"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Esta imagen está seleccionada como icono.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={onUploadImage}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? 'Subiendo...' : 'Cambiar imagen'}
                    </Button>
                  </Stack>
                ) : (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    spacing={2}
                    onClick={isUploadingImage ? undefined : onUploadImage}
                    sx={{
                      width: '100%',
                      maxWidth: 400,
                      p: 4,
                      borderRadius: 3,
                      border: '2px dashed',
                      borderColor: 'divider',
                      cursor: isUploadingImage ? 'default' : 'pointer',
                      transition: 'all 0.2s ease',
                      mx: 'auto',
                      '&:hover': {
                        borderColor: isUploadingImage ? 'divider' : 'primary.main',
                        bgcolor: isUploadingImage ? 'transparent' : 'action.hover',
                      },
                    }}
                  >
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {isUploadingImage ? 'Subiendo archivo...' : 'Sube una imagen o GIF'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Haz clic aquí para seleccionar una foto de tu ordenador.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            ) : currentEmojis.length > 0 ? (
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {currentTitle}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 0.75,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
                  }}
                >
                  {currentEmojis.map((emoji) => (
                    <Tooltip key={emoji} title={emoji} placement="top">
                      <Box
                        component="button"
                        type="button"
                        onClick={() => handleSelect(emoji)}
                        aria-label={`Seleccionar ${emoji}`}
                        sx={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          minHeight: 44,
                          borderRadius: 2,
                          fontSize: 24,
                          lineHeight: 1,
                          border: '1px solid',
                          borderColor: value === emoji ? 'primary.main' : 'divider',
                          backgroundColor: value === emoji ? 'action.selected' : 'background.paper',
                          transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: 'primary.main',
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        {emoji}
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No hay emojis recientes todavía. Usa un emoji o selecciónalo en otra categoría para que aparezca aquí.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleClear} color="inherit">
          Limpiar icono
        </Button>
        <Button onClick={onClose} variant="contained">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmojiPickerDialog;
