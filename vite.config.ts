import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/wfm-api': {
        target: 'https://api.warframe.market',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wfm-api/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      input: { dashboard: 'dashboard.html' },
      output: { entryFileNames: 'assets/[name]-[hash].js', chunkFileNames: 'assets/[name]-[hash].js' }
    }
  }
});
