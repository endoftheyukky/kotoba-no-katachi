# v4 — parametric anchors (experiment)

Branch `v4-parametric-anchors` (from `v3-composition-space`). Review only:
`compose()` without `parametric` is byte-for-byte what it was (372 pages ×
variants 0–3 verified after every change).

**Why.** v3 showed that deforming a finished page cannot dissolve the families:
what makes a page recognisable is its organisation, and the coherent
neighbourhood around an anchor is small (pages moved 18 % of the gap to another
family). So the anchors themselves are rebuilt as parametric generators, with
the continua the families used to be separate points of.

## 1. The trace — line → arc → ring (`parametric/trace.ts`)

One curve holds what v1–v2c kept in four compositions: the band's straight row,
the joint line, the path that turns at the language's breaks, and the orbit's
closed ring. The units are walked with a turtle; each step advances by its own
beats and turns by its share of the total turning.

| parameter | 0 | 1 | read from |
| --- | --- | --- | --- |
| `closure` | a straight row | a closed ring | how far the reading comes back: the repetition's coverage × how often it loops, the echo between the first and last character (same character / mora / vowel / script, or a mirror), how far toward the end the head of the dependency stands, the density of word boundaries |
| `corners` | a smooth bend | all the turning at the breaks | word boundaries per character |
| `opening` | closed | a quarter left open | a directed relation (dependency, inflection), scaled by how far the curve has closed and how much the two terms differ |
| `eccentricity` | a circle | swollen toward its heaviest character | the difference in ink × beats between the two terms |
| `tangency` | upright | each mark turned with the tangent | follows `closure` |
| `branch` | one line | one arm per coordinated term | a coordination: its terms, their number |
| per unit | — | — | step length = its beats; size = its ink, dwindling along a run |

Sweeps: `docs/contact/v4-trace-sweep.png` (closure 0 → ring, with and without
corners, and each title's own derived value).

## 2. The lattice — grid → warped lattice → field (`parametric/lattice.ts`)

One arrangement holds the grid (even cells, an empty cell readable as empty),
the band's stepping row, the lattice grammar's dwindling rows and the field.

| parameter | read from |
| --- | --- |
| `rows` | how much of the title repeats, and how often (1 row → it is a trace) |
| `regularity` | special beats (ん, っ, long and whispered vowels) and the difference in ink between the letterforms: cells are even, or as long as what stands in them |
| `shear` | how far each row steps: one cell per row, plus the density of word boundaries |
| `decay` | runs of the same character, and erased seats |
| `curl` | how far the reading returns (the trace's closure, a third of it) |

Sweep: `docs/contact/v4-lattice-sweep.png` (even grid → sheared → warped cells →
dwindling → curled → derived).

**Where they meet.** A lattice of one row is a trace that does not turn, so the
choice between the two generators is not a jump: `rows ≥ 2` → lattice, else trace.

## 3. What the pages are

93 titles (development + holdout + probe), `parametric: 'auto'`: 80 traces, 13
lattices, 0 errors; **no character lost, no reading-order break, no overlap** —
with one refinement to the invariant: where a figure closes (closure ≥ 0.35) the
reading is the curve's own, so the page-axis order check does not apply (the
same exemption repetition pages already had). Deterministic: 93/93 identical
across runs.

Parameters spread continuously instead of falling into a few values: trace
`closure` 0–0.63 over 16 distinct values (27 before the generator choice sent
the whole-repetition titles to the lattice), `corners` 0–1, `opening` 0–0.12
over 11; lattice `rows` 2–8, `regularity` 0.11–1 over 13 values, `shear`
0.14–0.8, `decay` 0–0.2.

## 4. Evaluation

Measured in the v3 form space (`poem/form/measure.ts`, now also reading the
curve the title's own marks make, so that a page of four large characters can
be seen to bend):

| | v2c | v4 |
| --- | --- | --- |
| 1-NN recovery of the title's v2c family | 85 % | **37 %** |
| pages between two v2c families (d1/d2 > 0.8) | 22 % | 26 % |
| descriptors sitting at exactly 0 or 1 (mean over 14) | 54 % | **70 %** |
| nearest-neighbour distance, p25 / median / p75 | 0.09 / 0.98 / 1.72 | 0.01 / **0.19** / 1.01 |

**The families are gone.** A page's nearest neighbour is no longer a page of
its own old family: 85 % → 37 %. The enumerable-template structure does not
survive the parametric rebuild, which is what this phase was for.

**But the series flattens.** The pages are closer to one another than v2c's were
(median nearest-neighbour distance 0.98 → 0.19), and more descriptors sit at
their extremes (54 % → 70 %). The reason is plain in the sheets
(`v4-dev34-pairs.png`, `v4-holdout-pairs.png`): the two generators write the
title's own characters and nothing else. v2c's range came as much from the
material its grammars make — a form drawn in a thousand grains, a ring of
satellites, a sea of dust, a glyph with another taken out of it — and none of
that exists here. Fifteen families became two.

## 5. Next — the third continuum: material

The parametric layer needs a generator for what a page is *made of*, as
continuous as the two above:

- **density**: from the title's own characters written large, through a form
  sampled in small marks (the silhouette), to a field of dust — one parameter,
  not three grammars;
- **derivation**: where the small marks come from (the title's repetition, a
  form read inside a character, the rest of the title) with a continuous share,
  rather than a fixed order;
- **attachment**: whether the material lies on the figure (silhouette), around
  it (orbit, emanation) or across the page (field) — an angle and a radius, not
  a name.

Then trace × lattice × material is one space in which v2c's fifteen families
are places, and a title's parameters put it between them. The evaluation to
repeat after that: the two numbers above should move together — family recovery
low **and** nearest-neighbour distance no smaller than v2c's.

## 6. Review

`study.html?compare=%231%2Bauto|%231%2Bauto%2Bp4` (v2c beside v4; `+trace` and
`+lattice` force one generator). Sheets in `docs/contact/v4-*`. The parameters
and the grounds of each page are on `Composition.parametric` (never drawn).
