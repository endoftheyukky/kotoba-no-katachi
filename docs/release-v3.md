# v3 (`release/rc1`)

The generator published as `?v=3`, and the site that writes new words with it.
Published on 2026-09-24 (JST; deployment `63084aaf`, commit `4397966`,
2026-09-24 01:02 JST).
Built on the research line (v3 → v6, `docs/research/v3-composition-space.md`,
`docs/research/v4-parametric.md`) with the published site (`release/v2c`) merged in.
v1 and v2c are unchanged and still draw every address shared before v3.

## What the work does now

A title is read — its letterforms, its sound, the structure of its words and
sentences, the relations between its characters, and its meaning — and those
readings become **a small program of acts performed on the word itself**. The
page is what those acts leave.

| layer | what it settles | where |
| --- | --- | --- |
| the figure | the line the title is walked along (straight → arc → ring, corners at its breaks, branches at a coordination), and how many times it is written (`rows`, continuous) | `poem/parametric/trace.ts` |
| the page | how large the writing is, where it stands, whether the edge cuts it (v2c's micro / normal / macro as a continuum) | `poem/parametric/paper.ts` |
| the acts | what is done to the characters: a seam opens, the word spreads or draws together, one character withdraws, characters wear away by their own components, lean, divide at their own seam; the acts compete (an economy) | `poem/parametric/acts.ts` |
| the material | small marks made of the title's own characters: its form sampled, satellites, dust — yielding to the leading act | `poem/parametric/material.ts`, `frame.ts` |
| the motif | shared structures (repetition, pairing, nesting, absence, articulation, echo) draw pages toward a common chord: rhyme | `poem/parametric/motif.ts` |
| meaning | nine semantic axes, read once from a fixed table; never drawn — it sets the strength of acts, the page's scale and place, how much material a title offers | `language/semantic/` |

### Why the architecture changed (and what of v6 remains)

v6 had dissolved v2c's template families and restored rhyme, but it had no
reason to do anything with an ordinary word. Measured on 24 ordinary words
(孤独, 記憶, 風景, 静寂, 群衆 …), 54 of 276 pairs were near-identical pages
(nearest-neighbour median 0.06 in the form space): 孤独 and 群衆 were the same
page — two small characters set down in a corner. On the titles people actually
typed, a second family dominated: about half became a large dotted component.

The diagnosis was not a missing parameter. v6 could *place* a word in many ways
but did only a few things *to* it, and each thing was triggered by one feature.
Adding meaning as one more pressure on placement would only have moved every
abstract noun to the same small corner (tried: it did). What was missing was a
vocabulary of operations on the word — spacing, displacement, partial glyphs,
fragmentation, disappearance, the operations of concrete poetry — whose strength
comes from all the readings at once and whose *form* comes from the word's own
letters. That is the acts layer; its competition (the economy) keeps a page to
one leading gesture, as the brief of the work asks ("a small number of operations").

**Kept from v6**: the continuous figure / page / material / frame; the motif as
rhyme (at 0.6, and pairing no longer pulls satellites); every invariant.
**Dropped or changed**: the enclosed-white silhouette and components found by
the glyph inventory as material (they made the dotted family); weak relations
(v2c's own threshold, 0.65, now applies); Latin letters read inside each other;
macro for a whole multi-character title (only the operation's result is large,
as in v2c's mixed regime); satellites and hierarchy in the pairing chord.

### Rules the work keeps (each came from looking at what it produced)

- **No false characters.** A cut or a wear that turns a character into another
  one is not allowed: kana and one-character titles are never worn by
  components; a cut divides only a kanji whose components stand apart, and its
  halves slide like a fault so they cannot close into another character (束 was
  reading as 東).
- **A crop reads as intended only on a large character.** How much the page may
  cut a character is continuous in its size: macro characters up to half, small
  characters not at all.
- **Nothing is lost to an act.** A withdrawn character is free of the fit and
  held on the page; if it would land on another it stays home; a worn character
  keeps at least one component; the edge rule holds for what is drawn.
- **A word coming apart does not get smaller for it.** Gaps open only as far as
  the page holds the word at the size it asks for.

## Meaning

- **Representation**: nine axes — multitude, agitation, enclosure, severance,
  vanishing, distance, weight, descent, abstraction — each defined by two sets
  of noun anchors, none of them a study word.
- **Source**: chiVe v1.3 mc90 (Works Applications, Apache License 2.0; file
  sha256 `885c7db3…22b0`). Post-processing: all-but-the-top (mean and two
  components removed), axes orthogonal to abstraction, each axis z-scored
  against ordinary 2–3-kanji compounds.
- **Runtime**: no model. A table of 62,653 words (the most frequent 60,000 and
  every single kanji), nine 6-bit numbers each, in 64 shards by first character
  (`public/semantic/axes-1/`, 8–17 KB each compressed; a title fetches only its
  own). A title is matched longest word first; a word the table does not know is
  read through its kanji (群衆 through 群 and 衆). Deterministic, offline, pinned:
  rebuilding from `tools/semantic/axes.py` and `shard.py` gives bit-identical
  shards; `meta.json` records every shard's sha256.
- **Why not a larger model**: the problem was never the quality of the
  embedding but what the page does with it. A contextual model would add weight
  and a runtime dependency without changing that. The table is small enough to
  ship, cannot change, and needs no service.
- **What it does not do** (the negative result of v2d stands): no related word,
  no symbol, no character the title does not write ever appears.

## Evaluation

All numbers from the shipping configuration. Form space: the v3 descriptors,
z-scored against v2c (`tools/form/`).

| | v2c | v6 | **v3** |
| --- | --- | --- | --- |
| 1-NN recovery of the title's v2c family (template-ness) | 85 % | 34 % | **42 %** |
| nearest neighbour ÷ mean distance (neighbourhoods; lower = more rhyme) | 20 % | 29 % | **27 %** |
| nearest neighbour shares the title's structure (chance 32 %) | 65 % | 59 % | **55 %** |
| pages between two v2c families | 22 % | 57 % | **55 %** |
| ordinary words: NN median / near-identical pairs of 276 | — | 0.06 / 54 | **1.34 / 2** |

Meaning's correlation with the 14 form descriptors is near zero (0.04): those
descriptors were built to measure v2c's families and do not see the acts (a
withdrawn character and an eroded one read alike to them). The rhyme between
pages of similar meaning is visible on the sheets (孤独 / 永遠 / 断絶 hold their
characters apart; 祭り / 群衆 / 迷路 multiply; 記憶 / 静寂 / 沈黙 wear away) but is
not measured by that space — a limit of the measure, recorded here.

Register (p25 / median / p75, core set): largest character 0.11 / 0.15 / 0.19
of the page (v2c 0.06 / 0.18 / 0.23); largest ÷ smallest written 1.04 / 1.25 /
1.99 (v2c 1.00 / 1.00 / 1.88); nearest edge 0.01 / 0.02 / 0.06 (v2c 0.00 /
0.04 / 0.07). Pages carrying small marks: dev 22/34, holdout 24/47, real titles
17/39.

**Invariants**, 170 pages (dev 34, holdout 47, probe 12, ordinary words 24,
edges 14, real titles 39): 0 characters lost, 0 reading-order breaks, 0
overlaps, 0 grains on ink, 0 grains on grains, 0 non-finite, 0 errors.
Deliberate departures are modelled, not exempted: a character that withdrew is
named to the order audit (`invariants.ts`, `left`); a character the poem writes
as space is named by the composition (`absent`).

**Determinism**: 170 pages byte-identical across runs.
**Regression**: v1 and v2c byte-identical to `release/v2c`'s own code (372 pages
× 4 variants each); 8 of 8 legacy addresses draw the same SVG as the live site.

Sheets (`docs/contact/`): `v3-dev.png`, `v3-holdout.png`, `v3-difficult.png`,
`v3-edges.png`, `v3-full-series.png` beside `v2c-full-series.png`,
`semantic-on-off-difficult.png`, `semantic-on-off-dev.png`, `rhyme-by-act.png`.
The real-title sheet is not in the repository (it was shown privately).
Three of the edge titles had been taken from what visitors typed on the site;
before the repository was made public they were replaced by written ones of
the same shape (Good morning! · zzzzzzz · 私の影を踏まないでください！), which
keep every invariant, and the sheets holding them were redrawn — every other
cell is pixel-identical. The numbers above were measured with the earlier three.

## Versions and addresses

| address | generator |
| --- | --- |
| `/?title=…&v=3` | v3 — every new poem written from the root |
| `/?title=…` (no version) | v2c — every address shared before v3, unchanged |
| `/?title=…&v=1` | v1 — and new words written on the `?v=1` site stay v1 |

- `poem/generators.ts` pins each version. **A published version is never
  edited**: a change to what v3 writes is v4. v3 is its code, the fonts bundled
  with it, and the table `axes-1` (which is never changed either).
- The archive stores `generator_version` `v3` (no migration: the column has no
  constraint); a snapshot is kept with the name of the generator that drew it
  and is never redrawn. /admin opens a v3 record at its `v=3` address.

## The site

- 別のことばで試す: the paper is white at once; no poem is shown under words it
  does not belong to. The address changes only when new words are written.
- While a poem is written the paper is white; after 280 ms a single faint 〓
  stands on it — the geta, the mark a compositor sets for a character not yet
  cast — breathing slowly (still, under reduced motion).
- 保存: on a touch device the PNG is handed to the system share sheet as a file,
  where 「画像を保存」 puts it in Photos (a web page cannot write to Photos
  itself); elsewhere it downloads as before. **Manual QA on a real iPhone is
  still needed** to confirm the sheet offers 「画像を保存」 and the image lands
  in Photos (headless tests confirm the file — name, type, size — is handed over).
- About describes what v3 does; the colophon credits chiVe beside the fonts.

## Production migration plan

1. On `release/rc1`: `npm ci && npm run build` (runs `tsc` for the app and the
   Functions). Check `dist/` holds `index.html`, `admin/`, `assets/`,
   `semantic/axes-1/` (64 shards, meta, licence, notice), `_routes.json`.
2. Deploy to production (same project, same branch label; no D1 migration, no
   secret change):
   `npx wrangler@4 pages deploy dist --project-name kotoba-no-katachi --branch release --commit-hash $(git rev-parse HEAD)`
3. Check on the live site: `/?title=森` (v2c, unchanged), `/?title=森&v=3`,
   writing a new word (address gets `&v=3`), 保存 on desktop and on an iPhone,
   one record in /admin with generator `v3`.

## Rollback plan

- **Preferred — soft rollback** (keeps every shared address true): set
  `CURRENT` in `src/poem/generators.ts` back to `2`, build, deploy. New words
  are written in v2c again, while `?v=3` addresses already shared keep drawing
  their v3 poems. One line, no data change.
- **Full rollback**: Pages keeps every deployment; in the Cloudflare dashboard
  (Pages → kotoba-no-katachi → Deployments) the previous production deployment
  (`release/v2c` at `de6fa43`) can be promoted back in one step, or redeployed
  from the `release/v2c` checkout with the same command. Consequence: `?v=3`
  addresses already shared would open as v2c pages (the old site reads no v=3)
  — a different poem at the same address, which is why the soft rollback is
  preferred.
- Records already written stay in the archive with `v3` and their own
  snapshots. No data or schema changes to undo.
