
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, TextField, Paper } from '@mui/material';

interface ImageUploaderProps {
  initialValue?: string;
  onChange: (value: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ initialValue, onChange }) => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState(initialValue || '');
  const [isDragging, setIsDragging] = useState(false);

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

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  }, []);

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
      handleFile(event.target.files[0]);
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
          onChange={onFileSelect}
          style={{ display: 'none' }}
          id="file-upload-input"
        />
        <label htmlFor="file-upload-input" style={{ cursor: 'pointer', width: '100%', height: '100%' }}>
          <Typography>
            {t('drag_and_drop_image', 'Arrastra una imagen aquí o haz clic para seleccionarla')}
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
