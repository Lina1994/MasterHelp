import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { ContextualMenuBase } from '../ContextualMenuBase';
import AuthImage from '../../common/AuthImage';
import { getMapImageUrlSized, listMaps } from '../../../api/maps';
import { listCharacters } from '../../../api/characters';
import { getShop, getCellStreamUrl, listShops } from '../../../api/shops';
import { listCampaignMonsters } from '../../../api/bestiary/bestiaryApi';
import { toImageDragPayload } from '../utils/sceneEditorUtils';

interface ImageContextualMenuProps {
  onSelect: (image: { url: string; label: string }) => void;
  onClose: () => void;
  campaignId?: string | null;
}

type ImageSourceTab = 'characters' | 'bestiary' | 'maps' | 'shop' | 'url' | 'upload';

type ImageListItem = {
  id: string;
  label: string;
  url: string;
  previewUrl?: string;
};

const TABS = [
  { label: 'Personajes', value: 'characters' },
  { label: 'Bestiario', value: 'bestiary' },
  { label: 'Mapas', value: 'maps' },
  { label: 'Tienda', value: 'shop' },
  { label: 'URL externa', value: 'url' },
  { label: 'Subir imagen', value: 'upload' },
] as const;

function normalizeImageItems(items: Array<ImageListItem | null | undefined>): ImageListItem[] {
  return items.filter((item): item is ImageListItem => Boolean(item && item.url));
}

export const ImageContextualMenu: React.FC<ImageContextualMenuProps> = ({ onSelect, onClose, campaignId }) => {
  const [tab, setTab] = React.useState<ImageSourceTab>('characters');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [itemsByTab, setItemsByTab] = React.useState<Record<ImageSourceTab, ImageListItem[]>>({
    characters: [],
    bestiary: [],
    maps: [],
    shop: [],
    url: [],
    upload: [],
  });
  const [externalUrl, setExternalUrl] = React.useState('');
  const [query, setQuery] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadItemsForTab = React.useCallback(async (targetTab: ImageSourceTab): Promise<ImageListItem[]> => {
    if (!campaignId) return [];

    if (targetTab === 'characters') {
      const characters = await listCharacters(campaignId);
      return normalizeImageItems(characters.map((character) => {
        const url = String(character.tokenImageUrl ?? character.characterImageUrl ?? '').trim();
        if (!url) return null;
        return {
          id: character.id ?? `character-${character.name}`,
          label: character.name || 'Personaje',
          url,
        };
      }));
    }

    if (targetTab === 'bestiary') {
      const response = await listCampaignMonsters(campaignId, { pageSize: 300 }, 'es')
        .catch(() => listCampaignMonsters(campaignId, { pageSize: 300 }, 'en'));
      const monsters = (response as { items?: Array<Record<string, unknown>> })?.items ?? [];
      return normalizeImageItems(monsters.map((monster) => {
        const imageUrls = (monster.imageUrls ?? null) as null | { low?: string; medium?: string; high?: string };
        const url = String(imageUrls?.medium ?? imageUrls?.high ?? imageUrls?.low ?? monster.tokenImageUrl ?? '').trim();
        if (!url) return null;
        return {
          id: String(monster.id ?? `monster-${monster.name ?? 'unknown'}`),
          label: String(monster.name ?? 'Monstruo'),
          url,
        };
      }));
    }

    if (targetTab === 'maps') {
      const maps = await listMaps({ campaignId });
      return normalizeImageItems(maps.map((mapItem) => ({
        id: mapItem.id,
        label: mapItem.name,
        previewUrl: getMapImageUrlSized(mapItem.id, 'thumb'),
        url: getMapImageUrlSized(mapItem.id, 'full'),
      })));
    }

    if (targetTab === 'shop') {
      const shops = await listShops(campaignId);
      const shopDetails = await Promise.allSettled(shops.slice(0, 8).map((shop) => getShop(shop.id)));
      const items: ImageListItem[] = [];

      shopDetails.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        const shop = result.value;

        for (const section of shop.sections ?? []) {
          for (const entry of section.entries ?? []) {
            for (const cell of entry.cells ?? []) {
              const mimeType = String(cell.mimeType ?? '').toLowerCase();
              const isImageMime = mimeType.startsWith('image/') || mimeType.includes('gif');
              if (!isImageMime) continue;
              items.push({
                id: cell.id,
                label: `${shop.name} · ${section.name}`,
                url: getCellStreamUrl(cell.id),
              });
            }
          }
        }
      });

      return items;
    }

    return [];
  }, [campaignId]);

  const loadCurrentTabIfNeeded = React.useCallback(async () => {
    if (tab === 'upload' || tab === 'url') {
      setError(null);
      return;
    }
    if (!campaignId) {
      setError('Selecciona una campana activa para cargar imagenes.');
      return;
    }
    if (itemsByTab[tab].length > 0) return;

    setLoading(true);
    setError(null);
    try {
      const loaded = await loadItemsForTab(tab);
      setItemsByTab((current) => ({ ...current, [tab]: loaded }));
      if (loaded.length === 0) {
        setError('No hay imagenes disponibles en esta fuente.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'No se pudieron cargar las imagenes.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, itemsByTab, loadItemsForTab, tab]);

  React.useEffect(() => {
    void loadCurrentTabIfNeeded();
  }, [loadCurrentTabIfNeeded]);

  const handleUploadLocalImage = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '').trim();
      if (!dataUrl) {
        setError('No se pudo leer el archivo de imagen.');
        return;
      }
      onSelect({ url: dataUrl, label: file.name });
    };
    reader.onerror = () => {
      setError('No se pudo leer el archivo de imagen.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [onSelect]);

  const handleUseExternalUrl = React.useCallback(() => {
    const nextUrl = externalUrl.trim();
    if (!nextUrl) {
      setError('Introduce una URL valida.');
      return;
    }
    onSelect({ url: nextUrl, label: 'URL externa' });
  }, [externalUrl, onSelect]);

  const currentItems = itemsByTab[tab] ?? [];
  const filteredItems = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return currentItems;
    return currentItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
  }, [currentItems, query]);

  return (
    <ContextualMenuBase title="Añadir imagen" onClose={onClose}>
      <Stack spacing={1} sx={{ minWidth: 0, maxWidth: '100%', height: 'clamp(360px, 52vh, 560px)' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as ImageSourceTab)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36 }}
        >
          {TABS.map((t) => (
            <Tab key={t.value} label={t.label} value={t.value} sx={{ minHeight: 36, px: 1.25 }} />
          ))}
        </Tabs>

        <Box sx={{ minHeight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden', pr: 0.4 }}>
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            {error ? <Alert severity="info">{error}</Alert> : null}
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">Cargando imagenes...</Typography>
              </Stack>
            ) : null}

            {tab === 'url' ? (
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="URL de imagen"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder="https://..."
                />
                <Button size="small" variant="contained" onClick={handleUseExternalUrl}>Usar URL</Button>
              </Stack>
            ) : null}

            {tab === 'upload' ? (
              <Stack spacing={1}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUploadLocalImage}
                />
                <Button size="small" variant="contained" onClick={() => fileInputRef.current?.click()}>
                  Seleccionar archivo
                </Button>
              </Stack>
            ) : null}

            {tab !== 'upload' && tab !== 'url' ? (
              <>
                <TextField
                  size="small"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar imagen..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box
                  sx={{
                    display: 'grid',
                    width: '100%',
                    minWidth: 0,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 1,
                  }}
                >
                  {filteredItems.map((img) => (
                  <Button
                    key={img.id}
                    onClick={() => onSelect({ url: img.url, label: img.label })}
                    variant="outlined"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', toImageDragPayload({ url: img.url, label: img.label }));
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.8,
                      alignItems: 'stretch',
                      textTransform: 'none',
                      p: 0.8,
                    }}
                  >
                    <Box sx={{ height: 92, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                      <AuthImage
                        src={img.previewUrl ?? img.url}
                        alt={img.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onErrorIcon={<Box sx={{ width: '100%', height: '100%', bgcolor: 'action.disabledBackground' }} />}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ width: '100%', minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      noWrap
                    >
                      {img.label}
                    </Typography>
                  </Button>
                  ))}
                </Box>
                {!loading && filteredItems.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No hay imagenes para la busqueda actual.
                  </Typography>
                ) : null}
              </>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </ContextualMenuBase>
  );
};
