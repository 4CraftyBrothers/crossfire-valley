import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Resolve @crossfire/engine to its TypeScript source rather than the
// node_modules workspace symlink, so Vite (which skips node_modules) still
// transforms and bundles it. The web build and its tests both run the exact
// same engine the server does.
const engineSrc = fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url));

export default defineConfig({
  // Relative asset paths so the same build works at the domain root, under
  // a GitHub Pages project path (/game/), or opened from disk — and the same
  // build is what Capacitor wraps for iOS/Android.
  base: './',
  resolve: {
    alias: {
      '@crossfire/engine': engineSrc,
    },
  },
});
