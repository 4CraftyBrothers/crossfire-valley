import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the same build works at the domain root, under
  // a GitHub Pages project path (/game/), or opened from disk.
  base: './',
});
