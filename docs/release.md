# Public release (v2c)

The published page is `index.html` + `src/main.ts` + `src/style.css`: a sheet
of paper, one line under it, and About. The study sheets (`study.html`,
`review.html`, `experiments.html`) are built alongside and are not linked
from it.

## Addresses

| address | page |
| --- | --- |
| `/` | blank paper, the line, three example words (until a poem is written) |
| `/?title=見えない` | the poem first, its title under it, then 保存 · 共有 · 自分のことばで試す |
| `/?title=子供の城&reading=こどものしろ` | the same, with its reading |
| `…&v=1` | the generator as frozen at v1 (not offered anywhere; kept for the archive) |
| `…&debug=1` | the reasons, in the console only |

The same title and reading always give the same page; nothing on the page
redraws or varies it. Every poem written is pushed to the browser history.
A reading can be given on the line as 「子供の城（こどものしろ）」.

## Build and preview

```
npm run build          # tsc --noEmit && vite build → dist/
npx vite preview       # serves dist/ on :4173 (.claude/launch.json: concrete-poetry-preview)
```

`dist/` is static: any static host serves it. No server code, no functions,
no environment variables are needed to run it. It is about 17 MB, almost all
of it the fonts' unicode-range subsets (≈500 small files, each fetched only
when a page needs its characters).

## Configuration

`site.config.json` holds everything the page says about itself: title,
description, the link image (`public/ogp.png`, static, 1200 × 630), theme
colour, and `url` — the site's absolute address. While `url` is empty the
canonical and `og:url` tags are left out and `og:image` stays relative. Set
it there, or pass `SITE_URL=https://… npm run build`.

## Before going live

- choose the host and domain, then set `url` (absolute og:image is needed by
  some link previews)
- the fonts are served from `@fontsource` subsets in `dist/assets` (SIL OFL
  1.1, credited in About)
- nothing else blocks: no dynamic OGP (one static image for every title), no
  analytics, no cookies
