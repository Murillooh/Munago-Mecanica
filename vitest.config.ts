import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'scripts/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 20000,
  },
});
