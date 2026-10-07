import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Não injetar segredos no bundle: só variáveis VITE_* chegam ao navegador (ex.: IDs do Cognito).
// A chave do Gemini fica só no servidor.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Vendors em chunks estáveis: o navegador mantém em cache entre deploys
          // e só baixa de novo o código do app que mudou.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            amplify: ['aws-amplify'],
            motion: ['motion'],
            charts: ['recharts'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      // VITE_HMR_PORT: permite dois servidores locais ao mesmo tempo (o padrão 24678 só cabe em um).
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : process.env.VITE_HMR_PORT ? { port: Number(process.env.VITE_HMR_PORT) } : true,
    },
  };
});
