import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served under /natural-minor on the unified domain (Vercel multi-zone).
  base: '/natural-minor/',
  plugins: [react()],
  server: { port: 5188 },
});
