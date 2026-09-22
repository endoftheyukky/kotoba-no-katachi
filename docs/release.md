# Public release (v2c)

Branch `release/v2c`, from `v2c-rc1` (`fc2af5a`). The generator is frozen at
v2c: no grammar, semantic layer or tuning is added here. The semantic
experiment (`v2d-semantic-experiment`, `fa48586`) and the notes for v3
(`docs/v3-notes.md` on branch `v2`) are not part of this branch.

The published page is `index.html` + `src/main.ts` + `src/style.css`: a sheet
of paper, one line under it, and About. The development sheets
(`study.html`, `review.html`, `experiments.html`) stay in the repository and
are served by `npm run dev`; they are not built for publication.

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

## Build

```
npm ci
npm run build          # tsc --noEmit && vite build → dist/
npx vite preview       # serves dist/ on :4173 to check it (.claude/launch.json: concrete-poetry-preview)
```

- Node `^20.19.0 || >=22.12.0` (Vite 8).
- Output: `dist/` — `index.html`, `favicon.svg`, `ogp.png`, `assets/` (one
  script, one stylesheet, and the fonts' unicode-range subsets: ≈500 small
  woff2 files, each fetched only when a page needs its characters). About
  16 MB in all, almost all of it fonts.

## Where it is published

- Cloudflare Pages, project `one-reading` (direct upload), production branch
  label `release`: https://one-reading.pages.dev/ . The name is only the
  address; the page shows no title.
- `wrangler.toml` holds the project name and the output directory.
- Deploy (after `npm ci && npm run build`, logged in with `npx wrangler@4 login`):

```
npx wrangler@4 pages deploy dist --project-name one-reading --branch release --commit-hash $(git rev-parse HEAD)
```

## Hosting

- Any static host. No server code, no functions, no environment at run time.
- One page: every address is `/` with a query string (`?title=…&reading=…`).
  No SPA rewrite and no 404 fallback are needed; the host only has to serve
  `index.html` at `/` and keep the query string.
- `.woff2` must be served as `font/woff2` (every mainstream static host does).
  Long-lived caching of `assets/` is safe: the file names carry hashes.

## Configuration

`site.config.json` holds everything the page says about itself: title,
description, the link image (`public/ogp.png`, static, 1200 × 630), theme
colour, and `url` — the site's absolute address (`https://…`, no trailing
slash). While `url` is empty the canonical and `og:url` tags are left out
and `og:image` / `twitter:image` stay relative, which some link previews
(X among them) do not resolve. Set it there, or build with
`SITE_URL=https://… npm run build`.

State now: `url` is `https://one-reading.pages.dev`, so canonical, `og:url`,
`og:image` and `twitter:image` are absolute. A custom domain later: add it to
the Pages project, set `url` to it, rebuild and deploy.

## Manual check on a phone (before publishing)

On iPhone Safari (and, if possible, Android Chrome), against the deployed
address or `vite preview` on the local network:

- [ ] `/`: the paper and the line are both visible without scrolling
- [ ] Japanese IME: while converting, Enter only confirms the conversion; a
      second Enter writes the poem
- [ ] after the poem is written the keyboard closes and the poem is not
      hidden behind it; the page does not jump
- [ ] the line does not zoom the page when focused
- [ ] 保存: the PNG is saved (or offered to Photos / Files); it is the paper
      alone, 2048 × 2048, with no title or address on it
- [ ] 共有: the native share sheet opens with the address; the shared
      address opens the same poem on another device
- [ ] a shared address (`/?title=…`, with and without `&reading=…`) shows
      the poem first; 自分のことばで試す opens the line
- [ ] Back / Forward (the browser's own gestures) move between poems
- [ ] About opens at its first line and closes
- [ ] an unsupported character (an emoji) is refused with a quiet line
