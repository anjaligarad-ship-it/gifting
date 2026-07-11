import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Component/integration tests — DOM via happy-dom
    include: ['src/tests/component/**/*.test.js'],
    environment: 'happy-dom',
  },
});
