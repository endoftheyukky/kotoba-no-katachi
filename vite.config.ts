import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // development study sheet: generated pages with what was read and decided
        study: resolve(import.meta.dirname, 'study.html'),
        // review sheet: the same pages as works, with their titles only
        review: resolve(import.meta.dirname, 'review.html'),
        // the dynamic study (study-dynamic-v1), kept viewable
        experiments: resolve(import.meta.dirname, 'experiments.html'),
      },
    },
  },
})
