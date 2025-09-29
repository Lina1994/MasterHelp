import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ThemeContext, { ThemeMode } from './ThemeContext';
import { useState, useMemo } from 'react';
import CssBaseline from '@mui/material/CssBaseline'; // CssBaseline resetea estilos CSS para consistencia
import App from './App'
import { ActiveCampaignProvider } from './components/Campaign/ActiveCampaignProvider';
import './i18n';

function Main() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light';
  });
  const [primary, setPrimary] = useState(() => localStorage.getItem('theme_primary') || '#1976d2');
  const [secondary, setSecondary] = useState(() => localStorage.getItem('theme_secondary') || '#9c27b0');
  const [background, setBackground] = useState(() => localStorage.getItem('theme_background') || '#fff');

  const theme = useMemo(() => {
    if (mode === 'custom') {
      return createTheme({
        palette: {
          mode: 'light',
          primary: { main: primary },
          secondary: { main: secondary },
          background: { default: background },
        },
      });
    }
    return createTheme({ palette: { mode } });
  }, [mode, primary, secondary, background]);

  const handleSetMode = (m: ThemeMode) => {
    setMode(m);
    localStorage.setItem('theme', m);
  };
  const handleSetPrimary = (color: string) => {
    setPrimary(color);
    localStorage.setItem('theme_primary', color);
  };
  const handleSetSecondary = (color: string) => {
    setSecondary(color);
    localStorage.setItem('theme_secondary', color);
  };
  const handleSetBackground = (color: string) => {
    setBackground(color);
    localStorage.setItem('theme_background', color);
  };

  return (
    <ActiveCampaignProvider>
      <ThemeContext.Provider value={{
        mode,
        setMode: handleSetMode,
        primary,
        setPrimary: handleSetPrimary,
        secondary,
        setSecondary: handleSetSecondary,
        background,
        setBackground: handleSetBackground,
      }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </ThemeContext.Provider>
    </ActiveCampaignProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)