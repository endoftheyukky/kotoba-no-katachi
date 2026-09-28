# serif-ink-1: the writing face's fixed observations (for B3a)

After Stage 11. Not a stage. v2 still writes with B (the Safe Hybrid, c311b7c); `CURRENT = 1`, `VERSIONS = [1]`.
This file describes the table B3a (the serif-aware typography) needs, the command that makes it, and how the
runtime reads it. **The canonical table is not in the repository**: it is made only on the canonical environment
(below), never in a Cloud container.

## What B3a reads of the serif (the audit)

B3a draws in the serif every structure that does not stand on the sans's anatomy, laid out from the serif's own
ink. Read from the code (`src/v2/field`, `src/v2/layout`, `src/glyph/relation.ts`), per plan:

| plan (B3a face) | what its geometry reads of a face | kept in serif-ink-1 |
|---|---|---|
| FieldInterleave, addition (serif) | the derived character's whole (mapper); the base's whole (pitch); the derived character's direct row of the base: box, transform (sx, sy), residual (box, centroid, pieces' centroids) | `whole`, direct leaf rows |
| FieldInterleave, inter_containment / inter_similarity (serif) | the relation's dx, dy, scale and residue (v1 `relate` on the two glyphs); the inner's whole (the base box); the outer's whole (mapper) | `whole`, `measure.density` and the ink raster of the title's characters (v1 `readRelations` is run on them, pure) |
| CrossRoads (serif) | the whole's whole (mapper); the core's direct row box when there is a wrapper | `whole`, direct leaf rows |
| Separation (serif) | the parts' direct row boxes (their order along the seam) | direct leaf rows |
| NestedRegions, Frame, GlyphItself (serif) | nothing of the ink | — |
| FieldSingleton (sans: base part on a unit), WholeEmerges (sans: lattice, islands, cuts; B3b not adopted), RegionSplit (sans) | align-1 only | — |
| the words (serif where written) | v1 writable: declared by the face, and not drawn empty where the sans draws ink | `writing.json` |

Not kept, because nothing reads them in the serif: nested and subtree rows, islands, alike groups, crossings,
unexplained ink, regions, `glyph` records, the residual's distribution and pieces' keep / share / side. Discovery,
Selection, Constraints and the Plan read structure-1 and align-1 only; the serif never finds or removes a relation.

The rows' `ink` (explained, precision, lift, shared) and `confidence` are kept although no rule reads them yet: they
tell a serif placement from a fit that took a sibling's ink (the 辻 / 十 audit) without measuring again.

## Responsibility

- structure-1: what exists. align-1: where it stands in the reading face (Noto Sans JP 500). Both unchanged.
- serif-ink-1: only what the writing face (Noto Serif JP 300) draws. It is keyed by structure-1's tree (path,
  index, char) and never says a component exists. It is not a structure source.
- Its fit is align-1's own builder (`src/v2/align/build`, unchanged, with align-1's constants) run on the serif's
  rasters. The constants were calibrated on the sans; they are not re-fitted for the serif.
- Its domain is structure-1's entries. Outside it, or where the serif has no glyph or the fit placed nothing, the
  serif is not observed: B3a keeps that structure in the sans. Nothing is filled in.

## Files

```
public/v2/serif-ink-1/
  manifest.json      id, schema, canonical, generator (tool, fit, projection), font (Noto Serif JP 300: package,
                     integrity, CSS and files sha256, the files fetched), readingFont, render (browser, launcher,
                     page, measure, platform, dpr, rasters sha256), environment (required / found), inputs
                     (structure-1 sha256; align-1 and resonance-1 checked unchanged), constants, rules,
                     serialization, domain, shards (entries and rasters: name, entries, bytes, sha256), writing,
                     status counts, sha256
  entries/NN.json    per character: status, measure (half, density), whole (as the fit records it), raster
                     (the sha256 of its raster record: the glyph's fingerprint), direct leaf rows
  rasters/NN.json    per character: the v1 ink raster (alpha > 127), w, h, left, top, px, bits (base64)
  writing.json       the declared ranges, how many code points, unwritable, emptyInBoth
  NOTICE.txt
```

Shards: code point mod 64. Serialisation: `src/v2/structure/build/serialize.ts` (keys sorted, one entry per line,
entries by code point). The table's sha256 is over every entry shard's sha256, then every raster shard's, then
writing's.

## The command (canonical environment only)

On Windows, with Chrome 153 installed where `tools/verify/cdp.mjs` looks for it (or `CHROME=`), after
`npm install`:

```
npm run v2:serif-ink
```

It does, in order, and stops with the reason at the first failure (nothing is written):

1. the environment: Windows; then, once the browser is up, Chrome / HeadlessChrome 153, device pixel ratio 1, the
   writing face declared and loaded
2. the faces: @fontsource/noto-serif-jp 5.3.0 at weight 300 (package version, CSS and files sha256 pinned), the
   site's writing face is Noto Serif JP 300; the reading face as align-1 pins it
3. the fixed tables: structure-1, align-1 and resonance-1 are the published ones (their shards make their pinned
   sha256)
4. the table: v1 measure of every structure-1 entry and component in the serif, the writing scan of every declared
   code point, align-1's fit on the serif rasters, the projection
5. canonical serialisation, per-file sha256, raster fingerprints, the manifest
6. the self-check: every file is the one the manifest names and is canonical; the runtime loader reads it; every row
   is a direct leaf of structure-1's tree and every direct leaf has its row; every raster's fingerprint; the writing
   ranges are the CSS's; a sample fitted again gives the same entries; the fixed tables are unchanged

Only then is the table moved into `public/v2/serif-ink-1`. `npm run v2:serif-ink -- --check` does the same and
compares with the published files byte for byte. In a Cloud container the command refuses (`the OS is linux, not
Windows`); `--noncanonical --out <dir>` runs the same steps outside `public/` for checking the tool, and writes
`"canonical": false`, which the runtime refuses.

The Cloud check of the tool (Chromium 141, Linux, 4 cores): the render took about 1.5 minutes, the fit of 3055
entries on 2 workers about 42 minutes; the table is about 20 MB (rasters 17 MB, 2.6 MB gzipped; a title reads a
few raster shards of about 0.3 MB each).

## The runtime

- `observation/tables.ts serifInkFor`: the manifest (refused unless canonical), the entry shards of every character
  the title reaches, the raster shards of the title's own characters, `writing.json`. Nothing else.
- `serif/lookup.ts`: pure; no browser API, no builder import.
- `typography/b3a.ts`: the face of the structure, from the plan, the two geometries and the fixed observations
  only. `composeV2(o, { typography: 'B3a' })` refuses without serif-ink-1; the default is B (`TYPOGRAPHY`).
- The sans relations between a title's own characters are still measured in the browser (`observeTitle`,
  unchanged): a determinism gap of B and B3a alike, outside this table.
