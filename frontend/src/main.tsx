import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ThemeContext, { ThemeMode } from './ThemeContext';
import { useState, useMemo } from 'react';
import CssBaseline from '@mui/material/CssBaseline'; // CssBaseline resetea estilos CSS para consistencia

import App from './App';
import './i18n';
import { getCurrentUser } from './utils/getCurrentUser';
import { fetchUserFromApi } from './utils/fetchUserFromApi';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function Main() {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>('light');
  const [primary, setPrimary] = useState('#1976d2');
  const [secondary, setSecondary] = useState('#9c27b0');
  const [background, setBackground] = useState('#fff');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initUserPrefs() {
      const token = localStorage.getItem('access_token');
      let user = getCurrentUser();
      // Si hay token, pedir usuario actualizado al backend
      if (token) {
        const apiUser = await fetchUserFromApi(token);
        if (apiUser) {
          user = apiUser;
          localStorage.setItem('current_user', JSON.stringify(apiUser));
        }
      }
      // Aplicar preferencias
      if (user?.language && i18n.language !== user.language) {
        i18n.changeLanguage(user.language);
        localStorage.setItem('lang', user.language);
      }
      if (user?.theme) {
        setMode(user.theme as ThemeMode);
        localStorage.setItem('theme', user.theme);
      } else {
        setMode((localStorage.getItem('theme') as ThemeMode) || 'light');
      }
      setPrimary(localStorage.getItem('theme_primary') || '#1976d2');
      setSecondary(localStorage.getItem('theme_secondary') || '#9c27b0');
      setBackground(localStorage.getItem('theme_background') || '#fff');
      setLoading(false);
    }
    initUserPrefs();
    // eslint-disable-next-line
  }, []);

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

  if (loading) {
    return <div style={{padding: 32, textAlign: 'center'}}>Cargando preferencias...</div>;
  }

  return (
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
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)