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

## 3. The material — silhouette / satellite / dust as one field

What a page is *made of* was the third continuum, and without it the series
flattened (see §5). v2b–v2c keep it in separate grammars — silhouette (a form
sampled in small marks), orbit (satellites on a ring), field (dust), residue
(what a subtraction left). Here small marks stand where a density field says
they may, and the field is a mixture of three placements
(`parametric/material.ts`):

| parameter | what it does | read from |
| --- | --- | --- |
| `density` | how much material at all — at 0 the page is the figure alone | what the title offers: its repetition, a form read inside its nucleus, erased seats, the rest of the title. Below 0.18, or with nowhere grounded to stand, a page carries none |
| `onForm` | the nucleus's own ink is sampled: the form drawn in small marks | how strongly a form is read inside the nucleus, and the white it closes |
| `onRing` | small characters walked round the nucleus: satellites | a coordination (1) or a dependency (0.6), and how much the title repeats |
| `onPage` | dust over the page, thinning along the reading and keeping off what is written | erased seats, and repetition beyond what the form takes |
| `fineness` | a few satellites → many grains; also the sampling interval (a form is sampled at 11–24 grains across it, as v2c's silhouette) | how much material the title offers |
| `cut` | the inner glyph is taken out of the form before it is sampled (the residue) | the containment read in the nucleus |
| `sources` | what the small marks are written with, as shares: the title's repetition, a form read inside, the rest of the title — its own character only where nothing else is offered | the strength of each |

None of the three placements has a floor: a floor put the same halo on every
page, which is a family again (tried, and removed — the dotted circle and the
smudge it made are visible in the sweep's middle columns before the fix).

As the material takes over the nucleus, the glyph is written only as far as the
grains have not taken it: at full density it is not written at all and the
grains stand for it (`represents`), which is v2c's silhouette. Between the two
the page is half written, half sampled.

Sweep: `docs/contact/v4-material-sweep.png` (no material → form .3 → .6 → 1 →
satellites → dust → each title's own).

## 4. What the pages are

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

## 5. Evaluation

Measured in the v3 form space (`poem/form/measure.ts`, which now also reads the
curve the title's own marks make, so that a page of four large characters can be
seen to bend). The two numbers that matter are the ones this phase was set: the
families must stay dissolved, and the pages must be as unlike one another as
v2c's were.

| | v2c | v4 figure only | v4 with material |
| --- | --- | --- | --- |
| 1-NN recovery of the title's v2c family | 85 % | 37 % | **28 %** |
| nearest-neighbour distance, p25 / median / p75 | 0.09 / **0.98** / 1.72 | 0.01 / 0.19 / 1.01 | 0.26 / **1.49** / 2.10 |
| descriptors sitting at exactly 0 or 1 (mean over 14) | 54 % | 70 % | 48 % |
| pages between two v2c families (d1/d2 > 0.8) | 22 % | 26 % | **68 %** |

**Both hold.** The families do not come back (28 % against v2c's 85 %), and the
series is no longer flat: the median distance from a page to its nearest
neighbour is 1.49, half again v2c's 0.98 — the pages are more unlike one
another than v2c's were, not less. Two thirds of them now stand between two of
the old families instead of inside one.

Every page is sound: no character lost, no reading-order break, no overlap, no
grain on the title's ink, no grain on a grain (93 of 93), and deterministic
(93/93 identical across runs). `compose()` without the force is byte-for-byte
v2c, checked again after the material was added.

**What had to be removed on the way**, each because it made a new family rather
than a place in a space:

- a floor under the three placements: every page grew the same soft halo;
- the ring sampled from the dust lattice: it drew a dotted circle on every page
  with two terms. A ring is a curve — it is now walked, as v2c's orbit is, and
  carries readable small characters;
- the nucleus's own character as material everywhere: material now needs a
  source the title offers (its repetition, a form read inside it, the rest of
  it), and a page with none is the figure alone — which is what a v2c page with
  no grammar was.

**What is still weak.** Where a title offers little material the page can be
bare (24 of 93 carry none), and those pages are plainer than v2c's quiet
corner pages. The three placements are mixed by weights but not yet *shaped*:
a form can be sampled, a ring walked, dust spread, but the material cannot yet
follow the figure's own curve (dust along a trace, satellites on an arc).

## 6. Next

- **material along the figure**: the density field should take the trace's curve
  as its axis, so that dust and satellites follow the page's own geometry
  instead of only the nucleus;
- **the bare pages**: what a title with no repetition and no readable inner form
  offers as material (v2c wrote those quiet, small, in a corner — the parametric
  answer is probably a low density with a small figure, not nothing);
- **one selection**: trace vs lattice is still a threshold (`rows ≥ 2`); with the
  material field in place the two could be one generator whose second dimension
  simply falls to a single row;
- **the semantic layer** (v2d, still open): distances in the meaning space as
  further pressures on these same parameters — dispersion, closure, the
  material's sources — never as characters on the page.

## 7. Review

`study.html?compare=%231%2Bauto|%231%2Bauto%2Bp4` (v2c beside v4; `+trace` and
`+lattice` force one generator). Sheets in `docs/contact/v4-*`. The parameters
and the grounds of each page are on `Composition.parametric` (never drawn).
