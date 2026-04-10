import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { api } from '../apiBase';
import { useTranslation } from 'react-i18next';
import { Box, Drawer, List, ListItemButton, ListItemText, Toolbar, Typography, Divider, IconButton, Paper, Button } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SpellsBrowser from '../components/spells/SpellsBrowser';
import RacesBrowser from '../components/races/RacesBrowser';
import ClassesBrowser from '../components/classes/ClassesBrowser';
import BestiaryListPage from './BestiaryListPage';
import SimpleEntryBrowser from '../components/manuals/SimpleEntryBrowser';

interface TocNode { id: string; title: string; children?: TocNode[] }
interface SectionDto { id: string; title: string; format?: 'markdown'|'html'; markdown?: string; html?: string; }

const drawerWidth = 280;

/** Maps TOC nodeId to an i18n key for section titles. */
const nodeI18nMap: Record<string, string> = {
  about: 'manuals_section_about',
  bestiary: 'manuals_type_monster',
  spells: 'manuals_type_spell',
  classes: 'manuals_type_class',
  races: 'manuals_type_race',
  backgrounds: 'manuals_type_background',
  feats: 'manuals_type_feat',
  traits: 'manuals_type_trait',
  skills: 'manuals_type_skill',
  sections: 'manuals_type_section',
};

export default function ManualViewerPage() {
  const { manualId, nodeId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [toc, setToc] = useState<TocNode | null>(null);
  const [section, setSection] = useState<SectionDto | null>(null);
  const [editable, setEditable] = useState(false);

  useEffect(() => {
    if (!manualId) return;
    api.get(`/manuals/${manualId}/toc`).then(r => setToc(r.data)).catch(() => setToc(null));
  }, [manualId]);

  /* Check if this manual is a DB manual (editable) */
  useEffect(() => {
    if (!manualId) return;
    api.get('/manuals').then(r => {
      const manual = (r.data as any[])?.find((m: any) => m.id === manualId);
      setEditable(manual?.source === 'db');
    }).catch(() => setEditable(false));
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

  /** Translate a TOC node title: use i18n mapping when available, fall back to backend title. */
  const tocLabel = (n: TocNode) => {
    const key = nodeI18nMap[n.id];
    return key ? t(key) : n.title;
  };

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
            <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>{t('manuals_toc', 'Índice')}</Typography>
            {editable && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/manuals/${manualId}/edit`)}
              >
                {t('manuals_edit', 'Edit')}
              </Button>
            )}
          </Box>
          <Divider />
          <List dense>
            {flat.map(n => (
              <ListItemButton key={n.id} component={RouterLink} to={`/manuals/${manualId}/section/${n.id}`} selected={n.id === (nodeId || 'intro')}>
                <ListItemText primary={tocLabel(n)} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
  <Typography variant="h4" gutterBottom>{nodeId && nodeI18nMap[nodeId] ? t(nodeI18nMap[nodeId]) : (section?.title || t('manuals_section_default', 'Section'))}</Typography>
        {/* About section with distinctive styling */}
        {nodeId === 'about' && section?.markdown && (
          <Paper variant="outlined" sx={{ p: 3, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <InfoOutlinedIcon color="info" />
              <Typography variant="h5" color="info.main">{t('manuals_section_about', 'About')}</Typography>
            </Box>
            <Box sx={{
              '& h1, & h2, & h3': { mt: 2 },
              '& p': { mb: 1.5 },
              '& ul, & ol': { pl: 3, mb: 2 },
              '& blockquote': { borderLeft: '4px solid', borderColor: 'divider', pl: 2, color: 'text.secondary', my: 2 },
              '& a': { color: 'primary.main' },
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
            </Box>
          </Paper>
        )}
        {/* Renderizador normal de markdown */}
        {section?.format === 'markdown' && section?.markdown && nodeId !== 'about' && (
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
            <SpellsBrowser embedded title={section?.title || t('manuals_type_spell', 'Spells')} manualId={manualId} />
          </Box>
        )}
        {/* Inserta el navegador de razas dentro de la sección "races" */}
        {nodeId === 'races' && (
          <Box sx={{ mt: 3 }}>
            <RacesBrowser manualId={manualId} />
          </Box>
        )}
        {/* Inserta el navegador de clases dentro de la sección "classes" */}
        {nodeId === 'classes' && (
          <Box sx={{ mt: 3 }}>
            <ClassesBrowser manualId={manualId} />
          </Box>
        )}
        {/* Inserta el bestiario dentro del manual */}
        {nodeId === 'bestiary' && (
          <Box sx={{ mt: 3 }}>
            <BestiaryListPage manualId={manualId} />
          </Box>
        )}
        {/* Inserta el navegador de dotes dentro de la sección "feats" */}
        {nodeId === 'feats' && manualId && (
          <Box sx={{ mt: 3 }}>
            <SimpleEntryBrowser manualId={manualId} entryType="feats" />
          </Box>
        )}
        {/* Inserta el navegador de rasgos dentro de la sección "traits" */}
        {nodeId === 'traits' && manualId && (
          <Box sx={{ mt: 3 }}>
            <SimpleEntryBrowser manualId={manualId} entryType="traits" />
          </Box>
        )}
        {/* Inserta el navegador de habilidades dentro de la sección "skills" */}
        {nodeId === 'skills' && manualId && (
          <Box sx={{ mt: 3 }}>
            <SimpleEntryBrowser manualId={manualId} entryType="skills" />
          </Box>
        )}
        {section?.format === 'html' && section?.html && (
          <Box dangerouslySetInnerHTML={{ __html: section.html }} />
        )}
      </Box>
    </Box>
  );
}
