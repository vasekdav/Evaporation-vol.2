/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig(({ mode }) => ({
  // relativní cesty: build lze nasadit do libovolné složky statického webu
  base: './',
  // mode „single“: celá aplikace v jednom HTML souboru (otevření ze sdíleného disku přes file://)
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build:
    mode === 'single'
      ? { outDir: 'dist-single', chunkSizeWarningLimit: 8000 }
      : {
          // tabulky vlastností (~300 kB) jsou záměrně v balíčku; PDF a Excel se načítají až při exportu
          chunkSizeWarningLimit: 2500,
        },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
  },
}));
