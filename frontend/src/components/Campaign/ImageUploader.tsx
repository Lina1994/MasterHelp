import React, { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, TextField, Paper } from '@mui/material';

interface ImageUploaderProps {
  initialValue?: string;
  onChange: (value: string) => void;
  /**
   * When `true`, lets the user select or drop several images at once.
   * The selected images are reported through {@link onAddMultiple}.
   */
  multiple?: boolean;
  /**
   * Called with every selected image (as data URLs) when {@link multiple} is `true`.
   * @param values - Array of data URLs, one per chosen image file.
   */
  onAddMultiple?: (values: string[]) => void;
}

/**
 * Reads an image file and resolves its content as a data URL.
 * Non-image files resolve to `null` so they can be filtered out.
 *
 * @param file - File picked from the input or drag-and-drop.
 * @returns Promise resolving to the data URL, or `null` if not an image.
 */
function readImageAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ initialValue, onChange, multiple = false, onAddMultiple }) => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState(initialValue || '');
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();
  const fileInputId = `file-upload-input-${inputId}`;

  useEffect(() => {
    setImageSrc(initialValue || '');
  }, [initialValue]);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImageSrc(result);
        onChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Reads several image files in parallel and reports the valid ones.
   * In multiple mode the internal preview is cleared so the control is
   * immediately ready to accept another batch.
   *
   * @param files - Files chosen from the picker or dropped on the area.
   */
  const handleMultipleFiles = useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(readImageAsDataUrl));
    const validUrls = results.filter((url): url is string => Boolean(url));
    if (validUrls.length === 0) return;
    onAddMultiple?.(validUrls);
    setImageSrc('');
  }, [onAddMultiple]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      if (multiple) {
        void handleMultipleFiles(Array.from(files));
      } else {
        handleFile(files[0]);
      }
      event.dataTransfer.clearData();
    }
  }, [multiple, handleMultipleFiles]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      if (multiple) {
        void handleMultipleFiles(Array.from(event.target.files));
      } else {
        handleFile(event.target.files[0]);
      }
      // Reset the native input so selecting the same file(s) again re-triggers onChange.
      event.target.value = '';
    }
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setImageSrc(url);
    onChange(url);
  };

  return (
    <Box>
      <Paper
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        variant="outlined"
        sx={{
          padding: 2,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: isDragging ? 'primary.main' : 'grey.500',
          backgroundColor: isDragging ? 'action.hover' : 'transparent',
          minHeight: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          mb: 2,
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={onFileSelect}
          style={{ display: 'none' }}
          id={fileInputId}
        />
        <label htmlFor={fileInputId} style={{ cursor: 'pointer', width: '100%', height: '100%' }}>
          <Typography>
            {multiple
              ? t('drag_and_drop_images', 'Arrastra varias imágenes aquí o haz clic para seleccionarlas')
              : t('drag_and_drop_image', 'Arrastra una imagen aquí o haz clic para seleccionarla')}
          </Typography>
        </label>
      </Paper>

      <Typography sx={{ textAlign: 'center', mb: 2 }}>{t('or', 'O')}</Typography>

      <TextField
        label={t('paste_image_url', 'Pega la URL de una imagen')}
        value={imageSrc.startsWith('data:image/') ? '' : imageSrc}
        onChange={handleUrlChange}
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      {imageSrc && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('image_preview', 'Vista Previa')}</Typography>
          <img
            src={imageSrc}
            alt={t('campaign_preview_alt', 'Vista previa de la campaña')}
            style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', border: '1px solid #ddd', padding: '4px' }}
          />
        </Box>
      )}
    </Box>
  );
};
