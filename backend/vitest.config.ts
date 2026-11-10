import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC keeps emitDecoratorMetadata (required by NestJS DI). Vitest is used instead of Jest
// because the MongoDB driver fails its handshake inside Jest's vm sandbox.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
