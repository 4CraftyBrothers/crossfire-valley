/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the same build works at the domain root, under
  // a GitHub Pages project path (/game/), or opened from disk.
  base: './',
  test: {
    // Browser end-to-end tests live in e2e/ and run via `npm run e2e`.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'android/**', 'ios/**'],
  },
});
