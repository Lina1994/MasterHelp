import React, { useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { cropToPngDataUrl, type CropAreaPixels } from '../../utils/imageCrop';

export type TokenImageCropDialogProps = {
  open: boolean;
  imageSrc: string;
  title?: string;
  onClose: () => void;
  onApply: (croppedPngDataUrl: string) => void;
};

/**
 * TokenImageCropDialog
 *
 * Lets the user crop a token image to a square frame.
 * The resulting image is exported as a PNG data URL and can be stored in `tokenImageUrl`.
 */
export const TokenImageCropDialog: React.FC<TokenImageCropDialogProps> = ({
  open,
  imageSrc,
  title = 'Recortar token',
  onClose,
  onApply,
}) => {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.2);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApply = useMemo(() => !!imageSrc && !!croppedAreaPixels && !saving, [imageSrc, croppedAreaPixels, saving]);

  const onCropComplete = (_croppedArea: any, pixels: any) => {
    // react-easy-crop supplies numbers; keep it in our typed shape
    setCroppedAreaPixels({
      x: Number(pixels?.x || 0),
      y: Number(pixels?.y || 0),
      width: Number(pixels?.width || 0),
      height: Number(pixels?.height || 0),
    });
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const cropped = await cropToPngDataUrl(imageSrc, croppedAreaPixels, 512);
      onApply(cropped);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'No se pudo recortar la imagen';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Arrastra la imagen para centrar la zona (p. ej. la cara) y usa el zoom.
          </Typography>

          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 360,
              bgcolor: 'black',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={(z) => setZoom(Number(z))}
              onCropComplete={onCropComplete}
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary">Zoom</Typography>
            <Slider
              value={zoom}
              min={1}
              max={4}
              step={0.05}
              onChange={(_e, v) => setZoom(Number(v))}
            />
          </Box>

          {error && (
            <Typography color="error" variant="body2">{error}</Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            Nota: el recorte se guarda como una imagen nueva del token (PNG). Si quieres volver a recortar desde el original,
            es mejor volver a subir la imagen original.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={handleApply} disabled={!canApply}>
          {saving ? 'Aplicando…' : 'Aplicar recorte'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
