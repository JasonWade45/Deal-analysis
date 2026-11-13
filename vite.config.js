import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `VITE_BASE_PATH` lets CI build for GitHub Pages project sites
// (e.g. `/Deal-analysis/`) while dev stays on `/`.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    preview: { allowedHosts: true }
  }
});
