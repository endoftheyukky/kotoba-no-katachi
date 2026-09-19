import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // development study sheet: generated pages with what was read and decided
        study: resolve(import.meta.dirname, 'study.html'),
        // the dynamic study (study-dynamic-v1), kept viewable
        experiments: resolve(import.meta.dirname, 'experiments.html'),
      },
    },
  },
})
