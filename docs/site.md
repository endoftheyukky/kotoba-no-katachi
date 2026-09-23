# The published site

Everything around the generators: how the site is built and deployed, what a
shared link shows, and the anonymous generation log with its admin view. None
of it changes what a poem is.

## Build and deployment

```bash
npm ci
npm run build          # tsc (app and Functions) + vite build → dist/
npx wrangler@4 pages deploy dist --project-name <project> --branch <production branch> --commit-hash $(git rev-parse HEAD)
```

- Cloudflare Pages, direct upload of `dist/`. `dist/` holds `index.html`, the
  admin page, `assets/` (one script, one stylesheet, and the fonts'
  unicode-range subsets: several hundred small woff2 files, each fetched only
  when a page needs its characters), `semantic/axes-1/`, `examples/`, `og/`,
  the icons and `_routes.json`.
- `wrangler.toml` holds the project name, the output directory and the D1
  binding. The published project's own file is not in the repository (it
  carries the database id); `wrangler.example.toml` is the template.
- `public/_routes.json` sends only `/api/*`, `/admin` and `/admin/*` to
  Functions; every other request is a static file, so the page keeps working
  if the Functions quota runs out.
- The page's metadata (title, description, card image, address) comes from
  `site.config.json` through a Vite plugin in `vite.config.ts`.

## Link previews and icons

- Every address carries the same card: `og:image` / `twitter:image` =
  `/ogp.png?v=3` (1200 × 630), the v3 page of the title 「ことばのかたち」 on the
  ground, drawn by the site's renderer (`tools/examples/make.mjs`). The query
  string changes when the card does, so link previews fetch it again.
- A per-poem card would need a Pages Function in front of `/` (the poem cannot
  be drawn on a server: its glyph measurements come from a browser canvas).
  That is not deployed. `public/og/v3/` holds 1200 × 630 cards of the nine
  作例, ready for it.
- The 作例 thumbnails in `public/examples/v3/` are drawn by
  `tools/examples/make.mjs` with the published v3 generator; `CHECK=1` draws
  them again and compares them with `tools/examples/manifest.json`.
- Icons: `public/favicon.svg` (こ, as a path taken from Noto Sans JP 500, so
  it needs no font), and `favicon.ico` (16 / 32 / 48 px) and
  `apple-touch-icon.png` (180 px) drawn from it by `tools/icons/make.mjs`.

## The archive (anonymous generation log and /admin)

> `generator_version` is `v2c`, `v1` or — since the v3 release — `v3`
> (`src/archive/protocol.ts`). The column has no constraint, so no migration
> was needed (the comment in `migrations/0001_archive.sql` predates v3); a
> snapshot always keeps the name of the generator that drew it.

When someone writes a poem, the page records what was written, and an admin
sheet at `/admin/` shows the pages people wrote — newest first, per browser,
per visit. The generators are untouched; the page does not wait for the record.

### Architecture

```
browser (index.html, src/main.ts)
  └─ poem drawn ─→ src/archive/record.ts ── later, fire-and-forget ──→ POST /api/generations
                                                                          │ functions/api/generations.ts
                                                                          │ server/generations.ts (validate, rate-limit)
                                                                          ▼
                                                              D1: kotoba-no-katachi-archive
                                                                          ▲
admin (admin/index.html, src/admin/*) ── GET /admin/api/* ── functions/admin/_middleware.ts (session)
```

- Pages Functions (`functions/`) and one D1 database bound as `DB`
  (see [Build and deployment](#build-and-deployment) for `wrangler.toml` and
  `_routes.json`).
- Shared code: `src/archive/svg.ts` (snapshot canonical form, allowlist, hash),
  `src/archive/protocol.ts` (the record's fields), used by page, server and admin.

### When a record is made

Exactly when someone newly writes a poem:

| action | recorded |
| --- | --- |
| typing words and pressing Enter (also after 別のことばで試す) | yes, `source = manual` |
| opening a shared address or one of the 作例, reloading, Back / Forward | no |
| entering the same words that are already on the paper | no (no new poem) |
| 保存, 共有 (X · その他 · コピー), About | no |
| `npm run dev` (Vite) | no (nothing is sent) |

Records with `source = example` come from before the 作例: the root then
offered three words (「たとえば…」) that wrote a poem when chosen. The 作例 are
existing poems opened at their own address, and are not recorded.

`show(input, 'push', version, source)` in `src/main.ts` is the only call site; it calls
`record()` after the page is on the paper. `record()` returns at once; the
snapshot is read, hashed and sent in a later task, with a 10 s timeout, and
nothing is sent while the browser says it is offline. Every failure is silent.

### What is stored (migrations/0001_archive.sql)

`generations`: `id` (server UUID), `created_at` (server clock, ms — the
archive's time), `client_created_at` (browser clock, kept only within 7 days
of the server's), `visitor_id`, `session_id`, `title`, `reading`, `source`,
`generator_version` (`v1`, `v2c` or `v3`), `output_hash` (SHA-256 of the canonical
snapshot, computed on the server).

`snapshots`: the canonical SVG, gzip (median ≈ 0.6 KB, largest seen ≈ 3 KB).
`visitors`, `sessions`: first / last time and count per id. `counters`: the
three totals and a per-day count (daily cap). `admin_throttle`: wrong
passwords, one row for everyone.

**Not stored**: IP address, user agent, headers, referrer, location, screen,
language, cookies, fingerprints of any kind, names, e-mail, accounts. The
server reads only the JSON body. (Cloudflare, as the host, processes request
metadata in its own logs; this database holds none of it.)

### Identity

- **visitor_id** — `crypto.randomUUID()`, kept in `localStorage`
  (`kotoba:visitor`), made at the first generation (nothing is stored in a
  browser that only looks). It identifies a browser profile's storage, not a
  person: another browser, a private window, or cleared site data is another
  visitor. Shown as `Visitor 8C21` (first four hex digits).
- **session_id** — `crypto.randomUUID()`, kept in `sessionStorage`
  (`kotoba:session`) with the time of the last generation: one per tab, kept
  across reloads, renewed after 30 minutes without a generation.
- Where storage is refused, ids live only as long as the page.

### The snapshot

The page's SVG is stored as it was drawn, so the archive keeps showing what
people saw whatever is published later. Canonical form: clip/mask ids (a
page-wide counter) renumbered in order of appearance, which equals a fresh page load, so `output_hash` is the
hash of the SVG a fresh load of the poem's address draws.

It is accepted only if it is exactly the renderer's vocabulary: `svg defs
clipPath mask rect g text` with their attributes and value shapes, nested as
the renderer nests them, text only inside `<text>`. Scripts, event handlers,
links, `style`, comments, `foreignObject`, anything else: the record is
refused whole (nothing is "cleaned"). The admin sheet parses snapshots inert,
checks them again, and prefixes their ids before showing them. The glyphs are
`<text>` in the bundled Noto faces, which the admin sheet loads; if the fonts
changed in a later build, old snapshots would be drawn with the new files.

If the renderer ever writes a new element or attribute, extend
`ALLOWED` / `PARENTS` in `src/archive/svg.ts` in the same change, or its
records will be refused.

### Abuse

- Only this site's origin (`Origin` must match), `application/json`, ≤ ~1 MB.
- Every field validated: UUIDs, the title exactly as `normalizeTitle` makes
  it (≤ 16 characters, no control characters), reading in kana, known source
  and generator, hash recomputed on the server.
- Limits (silently dropped, 204): 20 per session per minute, 120 per visitor
  per hour, 6 000 per UTC day for everyone (≈ 78 000 rows written).
- There is no public read: `/api/generations` accepts POST only.
- Every answer a browser can cause is 204 (`X-Archive: stored | refused:… |
  dropped:… | error`), so nothing appears in a visitor's console.

### /admin

- Password (server-side only): `ADMIN_PASSWORD_HASH` = PBKDF2-SHA256, 10 000
  rounds, random salt (the Workers free plan allows ~10 ms of CPU per request;
  the secret is write-only on Cloudflare). `SESSION_SECRET` signs a cookie
  `__Secure-kotoba-admin` (HttpOnly, Secure, SameSite=Strict, Path=/admin, 12 h).
  Without both secrets `/admin` answers 503.
- After 10 wrong passwords in 15 minutes all logins wait out the 15 minutes.
- Responses: `no-store`, `noindex`, CSP `default-src 'none'`, no framing.
- Cloudflare Access was not used: on a `pages.dev` address it needs Zero Trust
  onboarding with payment details, and an application covering every
  deployment subdomain.

Views: `/admin/` (grid; newest/oldest, all/manual/example, title search, 40 at
a time with “more”), `?visitor=` (its visits in order, each with its pages),
`?session=` (one visit, numbered, with the time between pages), `&id=` (one
page large, all fields, a link to the public page).

### Operations

```
npm run admin:local          # .dev.vars with a random local password (shown once)
npm run db:migrate:local     # local D1 (.wrangler/)
npm run dev:archive          # build + wrangler pages dev on http://localhost:8788 (/admin/)

npm run db:migrate:remote    # apply new migrations to production
npm run admin:password       # set / change the admin password (hidden input), then redeploy
```

Deploy as above; Functions and bindings go with it.

Deleting records: always by an explicit condition (ids), never the whole
table; delete the snapshots with them, and adjust `visitors`, `sessions` and
`counters` by the same amounts.

### Cost (Workers Free plan)

- Functions: 100 000 requests / day (one per recorded poem, plus admin use).
  Static pages are not counted.
- D1: 100 000 rows written / day (one record writes ~13 rows including
  indexes and counters), 5 000 000 rows read / day, 500 MB per database.
  At ~1–2 KB per record, 500 MB holds a few hundred thousand records.
- Nothing here needs a paid plan. If a free limit is reached, recording stops
  until the next UTC day; the work itself keeps working.
