/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained HTML file (used for the hosted demo).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 2000 },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 20000, coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/worker/**'], reporter: ['text-summary', 'text', 'html'], reportsDirectory: 'test-reports/coverage' } },
}));
