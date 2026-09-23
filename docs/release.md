# Public release (v2c)

> Since `release/rc1` the root writes new words with **v3**
> (`docs/release-v3.md`). This page describes v2c, which still draws every
> address without a version.

Branch `release/v2c`, from `v2c-rc1` (`fc2af5a`). The generator is frozen at
v2c: no grammar, semantic layer or tuning is added here. The semantic
experiment (`v2d-semantic-experiment`, `fa48586`) and the notes for v3
(`docs/v3-notes.md` on branch `v2`, now `docs/research/v3-notes.md`) were not part of this branch.

The published page is `index.html` + `src/main.ts` + `src/style.css`: the
name ことばのかたち said small above a sheet of paper, one line under it, and
About. The development sheets
(`study.html`, `review.html`, `experiments.html`) stay in the repository and
are served by `npm run dev`; they are not built for publication.

## Addresses

| address | page |
| --- | --- |
| `/` | blank paper, the line, and under it 作例: nine v3 poems as small sheets, each a link to its own `?title=…&v=3` (shown while the paper is blank) |
| `/?title=見えない` | the poem first, its title under it, then 保存 · 共有 · 別のことばで試す |
| `/?title=子供の城&reading=こどものしろ` | the same, with its reading |
| `…&v=3` | v3 (`docs/release-v3.md`): every poem written from the root since rc1 |
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

- Cloudflare Pages, project `kotoba-no-katachi` (direct upload), production
  branch label `release`: https://kotoba-no-katachi.pages.dev/ . The public
  name ことばのかたち is used in the metadata, in what is shared, and small at
  the top of the page (ことば / の / かたち on three lines, fixed). (An earlier
  project, `one-reading`, served the same build at
  https://one-reading.pages.dev/ before the name was chosen.)
- `wrangler.toml` holds the project name and the output directory.
- Deploy (after `npm ci && npm run build`, logged in with `npx wrangler@4 login`):

```
npx wrangler@4 pages deploy dist --project-name kotoba-no-katachi --branch release --commit-hash $(git rev-parse HEAD)
```

## Hosting

- The work itself is static: it needs no server code and keeps working if
  the archive is down. Around it, the anonymous archive runs on Cloudflare
  Pages Functions (`/api/*`, `/admin*` only, see `public/_routes.json`) with
  one D1 database — see docs/archive.md.
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

State now: `url` is `https://kotoba-no-katachi.pages.dev` and `title` is
ことばのかたち, so canonical, `og:url`, `og:image` and `twitter:image` are
absolute, and the browser title, `og:title`, `twitter:title` and what is
shared use the name. A custom domain later: add it to the Pages project, set
`url` to it, rebuild and deploy.

## Sharing

共有 opens a small row under the actions: X · その他 · コピー. Each shares
the same three lines — the name, the title of the poem on the paper in
「」 (its words only: a reading is not shown here), and the poem's canonical
address (built from `url`, keeping `reading` when there is one):

```
ことばのかたち
「森」
https://kotoba-no-katachi.pages.dev/?title=%E6%A3%AE
```

```
ことばのかたち
「子供の城」
https://kotoba-no-katachi.pages.dev/?title=%E5%AD%90%E4%BE%9B%E3%81%AE%E5%9F%8E&reading=%E3%81%93%E3%81%A9%E3%82%82%E3%81%AE%E3%81%97%E3%82%8D
```

- X: `https://x.com/intent/post?text=<the three lines, encoded>` in a new tab
  (the X app on a phone). The address goes inside `text`, not as `url`, so
  the name, the title and the line breaks are kept.
- その他: `navigator.share({ title: 'ことばのかたち', text: <the three lines> })`,
  with no separate `url`, so the address cannot appear twice. Hidden where
  the browser has no Web Share.
- コピー: the three lines to the clipboard, then コピーしました for a moment.

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
- [ ] the name ことばのかたち is small at the top and does not crowd the paper
- [ ] 共有 → X: the X app (or x.com) opens its post screen with the three
      lines written in (the name, 「title」, the address)
- [ ] 共有 → その他: the share sheet opens; in Messages / LINE / Mail the
      name, the title and the address arrive once each
- [ ] 共有 → コピー: pasting gives the three lines; the shared address opens
      the same poem on another device
- [ ] a shared address (`/?title=…`, with and without `&reading=…`) shows
      the poem first; 別のことばで試す opens the line (and after any poem,
      however it was made)
- [ ] Back / Forward (the browser's own gestures) move between poems
- [ ] About opens at its first line; it closes with × (still in reach after
      scrolling), a tap outside it, and Escape on a keyboard; its last lines
      say what is recorded
- [ ] a poem written on the phone appears in /admin/ (newest first), with
      its visit; opening a shared address adds nothing
- [ ] an unsupported character (an emoji) is refused with a quiet line
