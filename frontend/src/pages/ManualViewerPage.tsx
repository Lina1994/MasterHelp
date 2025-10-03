import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { api } from '../apiBase';
import { useTranslation } from 'react-i18next';
import { Box, Drawer, List, ListItemButton, ListItemText, Toolbar, Typography, Divider, IconButton } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SpellsBrowser from '../components/spells/SpellsBrowser';

interface TocNode { id: string; title: string; children?: TocNode[] }
interface SectionDto { id: string; title: string; format?: 'markdown'|'html'; markdown?: string; html?: string; }

const drawerWidth = 280;

export default function ManualViewerPage() {
  const { manualId, nodeId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [toc, setToc] = useState<TocNode | null>(null);
  const [section, setSection] = useState<SectionDto | null>(null);

  useEffect(() => {
    if (!manualId) return;
    api.get(`/manuals/${manualId}/toc`).then(r => setToc(r.data)).catch(() => setToc(null));
  }, [manualId]);

  useEffect(() => {
    if (!manualId) return;
    const id = nodeId || 'intro';
    const lang = i18n.language?.slice(0,2) || 'en';
    api.get(`/manuals/${manualId}/sections/${id}`, { params: { lang } })
      .then(r => setSection(r.data)).catch(() => setSection(null));
  }, [manualId, nodeId, i18n.language]);

  const flat = useMemo(() => {
    const out: TocNode[] = [];
    const walk = (n?: TocNode) => {
      if (!n) return;
      if (n.id !== 'root') out.push(n);
      (n.children || []).forEach(walk);
    };
    walk(toc || undefined);
    return out;
  }, [toc]);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
            <IconButton onClick={() => navigate('/manuals')} size="small"><ArrowBackIcon /></IconButton>
            <Typography variant="subtitle1" sx={{ ml: 1 }}>Índice</Typography>
          </Box>
          <Divider />
          <List dense>
            {flat.map(n => (
              <ListItemButton key={n.id} component={RouterLink} to={`/manuals/${manualId}/section/${n.id}`} selected={n.id === (nodeId || 'intro')}>
                <ListItemText primary={n.title} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Typography variant="h4" gutterBottom>{section?.title || 'Sección'}</Typography>
        {/* Renderizador normal de markdown */}
        {section?.format === 'markdown' && section?.markdown && (
          <Box sx={{
            '& h1, & h2, & h3': { mt: 2 },
            '& p': { mb: 1.5 },
            '& ul, & ol': { pl: 3, mb: 2 },
            '& blockquote': { borderLeft: '4px solid', borderColor: 'divider', pl: 2, color: 'text.secondary', my: 2 },
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
          </Box>
        )}
        {/* Inserta el navegador de hechizos dentro de la sección "spells" */}
        {nodeId === 'spells' && (
          <Box sx={{ mt: 3 }}>
            <SpellsBrowser embedded title={section?.title || 'Spells'} />
          </Box>
        )}
        {section?.format === 'html' && section?.html && (
          <Box dangerouslySetInnerHTML={{ __html: section.html }} />
        )}
      </Box>
    </Box>
  );
}
