import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  css: {
    preprocessorOptions: {
      sass: {
        // Opciones para silenciar deprecaciones específicas
        silenceDeprecations: [
          'legacy-js-api', // Silencia la advertencia de la API JS
          'import',        // Silencia la advertencia de @import
          // Puedes añadir otras si aparecen
        ],
        // Opcional: Habilitar modo verbose si quieres ver TODAS las advertencias una vez
        // verbose: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})