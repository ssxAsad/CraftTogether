import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: true,
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'main.js',
              },
              external: [
                'electron',
                'pidusage',
                'ws',
                'child_process',
                'fs',
                'path',
                'os',
                'http',
                'https',
                'net',
                'dgram',
                'events',
                'stream',
                'util',
                'url'
              ]
            }
          }
        }
      },
      {
        // Preload script MUST be CommonJS
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
