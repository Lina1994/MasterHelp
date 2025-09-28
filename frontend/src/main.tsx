import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'; // Importar ThemeProvider y createTheme
import CssBaseline from '@mui/material/CssBaseline'; // CssBaseline resetea estilos CSS para consistencia
import App from './App'

// Crear un tema MUI (puedes personalizarlo)
const theme = createTheme({
  // Puedes personalizar colores, tipografía, etc. aquí
  // Por defecto, MUI 5+ usa M3
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Envolver App con ThemeProvider y CssBaseline */}
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)