import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias que espera shadcn/ui. Debe coincidir con jsconfig.json y con
      // moduleNameMapper de Jest.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Dentro de Docker el watcher nativo no siempre detecta los cambios del
    // volumen montado desde macOS/Windows.
    watch: { usePolling: true },
  },
});
