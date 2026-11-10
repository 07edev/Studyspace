import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The API contracts (types only) are shared with the mobile app so both sides use one definition.
const contracts = fileURLToPath(new URL('../src/shared/contracts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@contracts': contracts } },
  server: {
    port: 5173,
    // Same origin in development: the HttpOnly refresh cookie is sent without any CORS setup.
    proxy: { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:3000' } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
