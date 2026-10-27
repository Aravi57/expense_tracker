import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PNG app icons in public/ from favicon.svg (run: npm run icons)
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
});
