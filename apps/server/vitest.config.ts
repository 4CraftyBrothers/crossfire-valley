import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Point @crossfire/engine at its TypeScript source so Vitest transforms it
// instead of skipping it as a node_modules dependency.
const engineSrc = fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@crossfire/engine': engineSrc,
    },
  },
});
