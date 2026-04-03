import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false, // Explicit imports from 'vitest' — clearer, no ambient type issues
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
