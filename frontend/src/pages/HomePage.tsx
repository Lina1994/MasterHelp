// dm-app/frontend/src/pages/HomePage.tsx
import {
  Typography, Box, IconButton, Menu, Paper, Grid, Chip, alpha, useTheme,
} from '@mui/material';
import SettingsSection from './SettingsSection';
import SettingsIcon from '@mui/icons-material/Settings';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PetsIcon from '@mui/icons-material/Pets';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CampaignIcon from '@mui/icons-material/FolderSpecial';
import BoltIcon from '@mui/icons-material/Bolt';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import StyleIcon from '@mui/icons-material/Style';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import { useShortcuts } from '../contexts/ShortcutsContext';
import ShortcutButton from '../components/shortcuts/ShortcutButton';

/** Descriptor for a single tool card. */
interface ToolItem {
  /** i18n key (with fallback) for the label. */
  labelKey: string;
  fallback: string;
  icon: ReactNode;
  route: string;
  /** If true, the card is disabled when there is no active campaign. */
  requiresCampaign?: boolean;
  /** If true, only visible when the current user is master. */
  masterOnly?: boolean;
  /** If true, keep visible (disabled) when no campaign is selected. */
  showLockedWhenNoCampaign?: boolean;
}

/** Checks whether the current user is master of the given campaign. */
function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

/** All app tools in a single flat list. */
const ALL_TOOLS: ToolItem[] = [
  { labelKey: 'campaigns',   fallback: 'Campañas',    icon: <CampaignIcon />,      route: '/campaigns' },
  { labelKey: 'soundtrack',  fallback: 'Soundtrack',   icon: <MusicNoteIcon />,     route: '/soundtrack' },
  { labelKey: 'manuals',     fallback: 'Manuales',     icon: <MenuBookIcon />,      route: '/manuals' },
  { labelKey: 'maps',        fallback: 'Mapas',        icon: <MapIcon />,           route: '/maps' },
  { labelKey: 'shortcuts',   fallback: 'Atajos',       icon: <BoltIcon />,          route: '/shortcuts',         masterOnly: true },
  { labelKey: 'scenes',      fallback: 'Escenas',      icon: <TheaterComedyIcon />, route: '/scenes',            requiresCampaign: true, masterOnly: true, showLockedWhenNoCampaign: true },
  { labelKey: 'combat',      fallback: 'Combate',      icon: <SportsKabaddiIcon />, route: '/combat',            requiresCampaign: true },
  { labelKey: 'characters',  fallback: 'Personajes',   icon: <PeopleIcon />,        route: '/characters',        requiresCampaign: true },
  { labelKey: 'quests',      fallback: 'Misiones',     icon: <AssignmentIcon />,    route: '/quests',            requiresCampaign: true },
  { labelKey: 'shops',       fallback: 'Tiendas',      icon: <StorefrontIcon />,    route: '/shops',             requiresCampaign: true },
  { labelKey: 'worldpedia',  fallback: 'Worldpedia',   icon: <AutoStoriesIcon />,   route: '/worldpedia',        requiresCampaign: true, masterOnly: true },
  { labelKey: 'diary',       fallback: 'Diario',       icon: <EventNoteIcon />,     route: '/diary',             requiresCampaign: true },
  { labelKey: 'bestiary',    fallback: 'Bestiario',    icon: <PetsIcon />,          route: '/campaign-bestiary', requiresCampaign: true },
  { labelKey: 'spells',      fallback: 'Conjuros',     icon: <AutoFixHighIcon />,   route: '/campaign-spells',   requiresCampaign: true },
  { labelKey: 'cards',       fallback: 'Cartas',       icon: <StyleIcon />,         route: '/cards' },
];

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { activeCampaign } = useActiveCampaign();
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const { config: shortcutsConfig, homeShortcuts, executeShortcut } = useShortcuts();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  /**
   * Renders a single tool card.
   *
   * @param item - Tool descriptor.
   * @param disabled - Whether the card should be disabled.
   */
  const renderToolCard = (item: ToolItem, disabled: boolean) => (
    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={item.route}>
      <Paper
        elevation={disabled ? 0 : 2}
        onClick={() => !disabled && navigate(item.route)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          p: 2,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          transition: 'all 0.2s ease-in-out',
          bgcolor: disabled
            ? alpha(theme.palette.action.disabledBackground, 0.08)
            : 'background.paper',
          ...(!disabled && {
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: theme.shadows[6],
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
          }),
        }}
      >
        <Box
          sx={{
            color: disabled ? 'action.disabled' : 'primary.main',
            '& .MuiSvgIcon-root': { fontSize: 36 },
          }}
        >
          {item.icon}
        </Box>
        <Typography
          variant="subtitle2"
          align="center"
          sx={{ color: disabled ? 'text.disabled' : 'text.primary' }}
        >
          {t(item.labelKey, item.fallback)}
        </Typography>
      </Paper>
    </Grid>
  );

  /** Filters out master-only items when the user is not master. */
  const visibleTools = ALL_TOOLS.filter((item) => {
    if (!item.masterOnly) return true;
    if (isMaster) return true;
    return !activeCampaign?.id && !!item.showLockedWhenNoCampaign;
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, position: 'relative', maxWidth: 900, mx: 'auto' }}>
      {/* Settings gear */}
      <IconButton
        aria-label="settings"
        onClick={handleOpen}
        sx={{ position: 'absolute', top: 8, right: 8 }}
      >
        <SettingsIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { p: 0, minWidth: 320 } }}
      >
        <Box sx={{ p: 2 }}>
          <SettingsSection />
        </Box>
      </Menu>

      {/* Welcome header */}
      <Typography variant="h4" component="h1" gutterBottom>
        {t('welcome')}
      </Typography>

      {/* ── Tools grid ────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6">
          {t('home_tools', 'Herramientas')}
        </Typography>
        {!activeCampaign?.id && (
          <Chip
            label={t('home_campaign_required', 'Algunas herramientas requieren una campaña activa')}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>
      <Grid container spacing={2}>
        {visibleTools.map((item) =>
          renderToolCard(item, !!item.requiresCampaign && !activeCampaign?.id),
        )}
      </Grid>

      {isMaster && shortcutsConfig.showHomeSection && homeShortcuts.length > 0 ? (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Atajos rápidos
          </Typography>
          <Grid container spacing={1.5}>
            {homeShortcuts.map((shortcut) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={shortcut.id}>
                <ShortcutButton shortcut={shortcut} onClick={executeShortcut} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : null}
    </Box>
  );
};

export default HomePage;