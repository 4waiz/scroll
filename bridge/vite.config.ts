import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Multi-page app: one HTML entry per machine. Each page loads only its own twin,
 * so no page pays for the whole asset family. `<body data-page>` selects the
 * definition in src/pages/pages.ts.
 */
const pages = {
  index: resolve(__dirname, 'index.html'),
  airborne: resolve(__dirname, 'airborne.html'),
};

export default defineConfig({
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: pages,
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['animejs'],
        },
      },
    },
  },
});
