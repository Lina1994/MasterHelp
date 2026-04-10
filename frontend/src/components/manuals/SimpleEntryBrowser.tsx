import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { api } from '../../apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Supported entry types for the browser. */
export type SimpleEntryType = 'feats' | 'traits' | 'skills';

/** Shape returned by the backend for each entry type. */
interface EntryItem {
  id: string;
  name: string;
  description: string;
  prerequisite?: string | null;
  ability?: string;
  source?: string;
}

interface SimpleEntryBrowserProps {
  /** Manual identifier (file-based or DB). */
  manualId: string;
  /** Which entry type to browse. */
  entryType: SimpleEntryType;
}

const PAGE_SIZE = 20;

/**
 * Generic browser for simple manual entry types (feats, traits, skills).
 * Fetches from /manuals/:manualId/:entryType and renders expandable cards
 * with search filtering and pagination.
 */
export default function SimpleEntryBrowser({ manualId, entryType }: SimpleEntryBrowserProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';

  const [allItems, setAllItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedDetail, setSelectedDetail] = useState<EntryItem | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/manuals/${manualId}/${entryType}`, { params: { lang } })
      .then((r) => setAllItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllItems([]))
      .finally(() => setLoading(false));
  }, [manualId, entryType, lang]);

  /* Client-side search filter */
  const filtered = q
    ? allItems.filter(
        (item) =>
          item.name.toLowerCase().includes(q.toLowerCase()) ||
          item.description?.toLowerCase().includes(q.toLowerCase()) ||
          item.prerequisite?.toLowerCase().includes(q.toLowerCase()),
      )
    : allItems;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  /** Returns the i18n key for "no entries found" per type. */
  const noResultsKey = (): string => {
    switch (entryType) {
      case 'feats':
        return 'manuals_no_feats_found';
      case 'traits':
        return 'manuals_no_traits_found';
      case 'skills':
        return 'manuals_no_skills_found';
    }
  };

  return (
    <Box>
      {/* Search bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          label={t('search', 'Search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography>{t('loading', 'Loading…')}</Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={1}>
            {paged.map((item) => {
              const isOpen = !!expanded[item.id];
              return (
                <Card key={item.id} variant="outlined">
                  <CardContent sx={{ pb: isOpen ? undefined : '16px !important' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {item.name}
                        </Typography>
                        {/* Feat: prerequisite chip */}
                        {entryType === 'feats' && item.prerequisite && (
                          <Chip
                            label={item.prerequisite}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        {/* Skill: ability chip */}
                        {entryType === 'skills' && item.ability && (
                          <Chip
                            label={item.ability.toUpperCase()}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        {/* Source tag */}
                        {item.source && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {item.source}
                          </Typography>
                        )}
                      </Box>
                      <IconButton size="small" onClick={() => toggleExpand(item.id)}>
                        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Stack>
                    <Collapse in={isOpen}>
                      <Box
                        sx={{
                          mt: 1.5,
                          '& p': { mb: 1 },
                          '& ul, & ol': { pl: 3, mb: 1 },
                        }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {item.description || ''}
                        </ReactMarkdown>
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          {!loading && filtered.length === 0 && (
            <Typography align="center" sx={{ py: 4 }}>
              {t(noResultsKey(), 'No entries found')}
            </Typography>
          )}

          {totalPages > 1 && (
            <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
              <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
            </Stack>
          )}
        </>
      )}

      {/* Detail dialog (opened programmatically or could be used later) */}
      <Dialog open={!!selectedDetail} onClose={() => setSelectedDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selectedDetail?.name}
          <IconButton
            onClick={() => setSelectedDetail(null)}
            size="small"
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDetail?.prerequisite && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>{t('manuals_entry_prerequisite', 'Prerequisite')}:</strong>{' '}
              {selectedDetail.prerequisite}
            </Typography>
          )}
          {selectedDetail?.ability && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>{t('manuals_entry_ability', 'Ability')}:</strong>{' '}
              {selectedDetail.ability}
            </Typography>
          )}
          <Box sx={{ '& p': { mb: 1 }, '& ul, & ol': { pl: 3, mb: 1 } }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedDetail?.description || ''}
            </ReactMarkdown>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
