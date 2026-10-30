import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Deliver uploaded videos, PDFs, and images through Vite during local development.
  // This keeps the browser on one origin and avoids CORS problems in the PDF reader.
  server: {
    proxy: {
      '/uploads': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});
