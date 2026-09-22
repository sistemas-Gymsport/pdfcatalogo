import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.js'],
    setupFiles: ['./tests/setup/env.js'],
    // Los tests comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
