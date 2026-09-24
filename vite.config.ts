/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    cors: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/assets/**',
        'src/**/*.test-helpers.ts',
      ],
    },
    include: ['src/**/*.test.ts'],
  },
});
