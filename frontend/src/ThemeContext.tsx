import { createContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'custom';

export interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  primary: string;
  setPrimary: (color: string) => void;
  secondary: string;
  setSecondary: (color: string) => void;
  background: string;
  setBackground: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  setMode: () => {},
  primary: '#1976d2',
  setPrimary: () => {},
  secondary: '#9c27b0',
  setSecondary: () => {},
  background: '#fff',
  setBackground: () => {},
});

export default ThemeContext;
