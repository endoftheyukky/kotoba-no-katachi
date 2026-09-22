import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * What the published page says about itself (title, description, the image a
 * link shows, its address) comes from site.config.json and nowhere else. The
 * absolute address may be given later, there or as SITE_URL at build time;
 * until it is, the tags that need it are left out rather than guessed.
 */
function site(): Plugin {
  const config = JSON.parse(readFileSync(resolve(import.meta.dirname, 'site.config.json'), 'utf-8')) as {
    url: string
    title: string
    description: string
    ogImage: string
    themeColor: string
  }
  const url = (process.env.SITE_URL ?? config.url).replace(/\/+$/, '')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const image = url ? `${url}${config.ogImage}` : config.ogImage
  const tags = [
    `<title>${esc(config.title)}</title>`,
    `<meta name="description" content="${esc(config.description)}" />`,
    `<meta name="theme-color" content="${esc(config.themeColor)}" />`,
    ...(url ? [`<link rel="canonical" href="${esc(url)}/" />`, `<meta property="og:url" content="${esc(url)}/" />`] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(config.title)}" />`,
    `<meta property="og:title" content="${esc(config.title)}" />`,
    `<meta property="og:description" content="${esc(config.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="ja_JP" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(config.title)}" />`,
    `<meta name="twitter:description" content="${esc(config.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ]
  return {
    name: 'site-meta',
    // the page's own script knows the same name and address (browser title, what is shared)
    config: () => ({ define: { __SITE__: JSON.stringify({ title: config.title, url }) } }),
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // only the public page: the study sheets keep their own heads
        if (!ctx.filename.endsWith('index.html')) return html
        return html.replace('<!--site-meta-->', tags.join('\n    '))
      },
    },
  }
}

export default defineConfig({
  plugins: [site()],
  build: {
    rollupOptions: {
      // The published build is the work alone. The development sheets —
      // study.html (what was read and decided), review.html (the pages with
      // their titles), experiments.html (study-dynamic-v1) — are served by
      // `npm run dev` and are not published.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
})
