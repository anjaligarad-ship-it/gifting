import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests — no DOM needed
    include: ['src/tests/unit/**/*.test.js', 'src/tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/data/**', 'src/pages/api/**'],
      exclude: ['src/pages/api/otp/**'], // Twilio-dependent, not unit-testable
    },
  },
});
