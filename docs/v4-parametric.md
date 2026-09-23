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
flattened (see §6). v2b–v2c keep it in separate grammars — silhouette (a form
sampled in small marks), orbit (satellites on a ring), field (dust), residue
(what a subtraction left). Here small marks stand where a density field says
they may, and the field is a mixture of three placements
(`parametric/material.ts`):

| parameter | what it does | read from |
| --- | --- | --- |
| `density` | how much material at all — at 0 the page is the figure alone | what the title offers: its repetition, a form read inside its nucleus, erased seats, the rest of the title. Below 0.18, or with nowhere grounded to stand, a page carries none |
| `onForm` | the nucleus's own ink is sampled: the form drawn in small characters | a form read inside the nucleus — one the title also writes (中 in 雨), or one its own parts read as (森's 木, 品's 口) — and the white it closes |
| `onRing` | small characters at a fixed distance from the reading: satellites | a coordination (1) or a dependency (0.6), and how much the title repeats |
| `onPage` | dust in the frame's own lattice, along the reading | erased seats, and repetition beyond what the form takes |
| `fineness` | a few satellites → many grains; also the sampling interval (11–24 grains across a form, as v2c's silhouette) | how much material the title offers, and how dense the letterform it gathers on is |
| `spread` | how far the dust strays from the reading: a narrow wake → the whole page | an erasure scatters it; a repetition keeps it near the words it came from |
| `cut` | the inner glyph is taken out of the form before it is sampled (the residue) | the containment read in the nucleus |
| `sources` | what the small marks are written with, as shares: the title's repetition, a form read inside, the rest of the title — its own character only where nothing else is offered | the strength of each |

None of the three placements has a floor: a floor put the same halo on every
page, which is a family again (tried, and removed — the dotted circle and the
smudge it made are visible in the sweep's middle columns before the fix).

## 4. The frame — the material in the figure's own geometry

At first the material was placed in the page's coordinates: dust thinned from
left to right whatever the figure did, and the satellites stood on a circle
around the largest character. That is a layer laid over a page, not what a page
is made of. The frame (`parametric/frame.ts`) is the reading's own path — the
written units in order, as one strand per row of a lattice and one per arm of a
branch — and every placement is said in its two numbers: `s` how far along the
reading, `d` how far from it.

- **dust runs with the trace**: its lattice is the frame's own, rows parallel to
  the curve, thinning along the reading (as v2c's field does) and fading away
  from it within `spread`. Where a curve turns back on itself the bands would
  cross, so a point further from the reading than the frame says it is belongs
  to another part of the curve and is dropped;
- **satellites stand at a fixed distance from the reading**: the offset loop of
  the frame. Where the page is one character that loop is a circle around it —
  v2c's orbit; where the reading is a curve they follow it; where it is a
  lattice they run alongside each row;
- **the grain of a form lies with the letterform**: its lattice turns with the
  character, so on a trace whose marks follow the tangent the grains turn too.

Three rules were needed to keep this readable, each of them measured, not tuned:

1. **a form either stands for the character or is not drawn.** Sampling a glyph
   and writing what is left of it produced another character — 月 cut is 日, 見
   cut is 目. So the form is drawn only where the grains can be read as the
   character (its ink met in 45 places, half of them kept, at least 32 grains);
   then the character is not written at all, as in v2c's silhouette. What a form
   that cannot be read would have carried goes where the title already lets
   material stand, never to a place with no evidence.
2. **a character drawn in small characters takes the page.** Measured against
   v2c: its small marks are 26–45 units of the page's thousand, v4's first were
   7–13 — dots, not characters. A form is sampled at 11–24 places across, so for
   its grains to stay characters it has to span most of the page. It now grows
   as the material takes it (to 45–75% of the page) and draws toward the middle
   as it grows. v4's grains are now 24–27.
3. **no grain stands on another.** Where the reading doubles back, two
   placements can reach the same spot; the first one there keeps the place.

Sweep: `docs/contact/v4-material-sweep.png` (no material → form .3 → .6 → 1 →
satellites → dust → each title's own).

## 5. What the pages are

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

## 6. Evaluation

Measured in the v3 form space (`poem/form/measure.ts`, which now also reads the
curve the title's own marks make, so that a page of four large characters can be
seen to bend). Two numbers were set for this phase: the families must stay
dissolved, and the pages must be as unlike one another as v2c's were.

| | v2c | v4 figure only | v4 with the material |
| --- | --- | --- | --- |
| 1-NN recovery of the title's v2c family | 85 % | 37 % | **30 %** |
| nearest-neighbour distance, p25 / median / p75 | 0.09 / **0.98** / 1.72 | 0.01 / 0.19 / 1.01 | 0.13 / **1.34** / 1.68 |
| descriptors sitting at exactly 0 or 1 (mean over 14) | 54 % | 70 % | 50 % |
| pages between two v2c families (d1/d2 > 0.8) | 22 % | 26 % | **51 %** |

**Both hold.** The families do not come back (30 % against v2c's 85 %), and the
series is not flat: a page stands 1.34 from its nearest neighbour where v2c's
stood 0.98. Half the pages now fall between two of the old families instead of
inside one.

Every page is sound: no character lost, no reading-order break, no overlap, no
grain on the title's ink, no grain on a grain (93 of 93), and deterministic
(93/93 identical across runs). `compose()` without the force is byte-for-byte
v2c, checked again after the material was added.

### Does it still read as one series?

A larger nearest-neighbour distance could mean the set has come apart. It has
not: what grew was the cloud, not the loneliness of its pages.

| | v2c | v4 |
| --- | --- | --- |
| nearest neighbour (median) | 0.98 | 1.34 |
| mean distance between any two pages | 5.02 | 4.67 |
| nearest neighbour ÷ mean distance | 20 % | 29 % |
| the loneliest page (95th) ÷ mean | 54 % | 56 % |

No page stands further outside the set than v2c's outliers did; the pages are
spread more evenly through a cloud that is slightly *smaller* than v2c's. On the
sheet (`docs/contact/v4-series.png` beside `v4-series-v2c.png`) v4 reads as one
series — more evenly so than v2c, which is also the finding against it.

**What the register says** (measured on the marks, not the descriptors — what
every page shares whatever its form):

| | v2c | v4 |
| --- | --- | --- |
| the largest character (share of the page) | 0.06 / 0.18 / 0.23 | 0.16 / 0.22 / 0.27 |
| marks on the page | 3 / 6 / 44 | 3 / 12 / 27 |
| largest ÷ smallest written character | 1.00 / 1.00 / 1.88 | 1.00 / 1.03 / 1.15 |
| the figure's nearest edge | 0.00 / 0.04 / 0.07 | 0.06 / 0.09 / 0.13 |
| small marks: their size | 26 / 35 / 45 | 24 / 24 / 27 |
| pages carrying small marks | 51 of 81 | 48 of 81 |

The material is now in v2c's register (its small marks are characters at 2–3 %
of the page, not dots at 0.7 %), and as many pages carry material as in v2c.
What v4 has *lost* is the range at the ends: v2c writes a page whose largest
character is 6 % of the page (a word in a corner), a page of 44 marks, a page
whose characters differ in size by 1.9×, and pages that run off the edge. v4
never goes there — its figure is always fitted and centred, its characters
nearly one size.

**What is still weak.**

- **the page itself is not a parameter.** The generator centres every figure and
  fits it to 86 % of the page. Where a title stands on the page, how large it is
  against the page, and whether it is cut by the edge are v2c's strongest
  gestures and v4 has none of them. This is the largest single gap.
- **scale hierarchy**: the trace's sizes come from ink and beats alone, a narrow
  range (1.0–1.15). v2c's pages set one character against another at 2×.
- **45 of 93 pages carry no material**, most because the title offers none
  (v2c's plain pages are about as many), but a few because a form could not be
  read and there was nowhere else grounded for it to go.
- **the lattice that fills the page has no room for dust** (ころころ, ロロロ):
  honest, but it means `density` is read and then nothing comes of it.

## 7. Next

- **the page as parameters**: position, scale against the page, and the crop at
  its edge — continuous, read from the title (a quiet word stands small in a
  corner; a title that overruns is cut by the edge). This is where the lost
  range is;
- **one generator**: trace vs lattice is still a threshold (`rows ≥ 2`). A
  lattice is the title written more than once, each row a trace, so the two can
  be one generator whose `rows` runs continuously from one;
- **the semantic layer** (v2d, still open): distances in the meaning space as
  further pressures on these same parameters — dispersion, closure, the
  material's sources — never as characters on the page.

## 8. Review

`study.html?compare=%231%2Bauto|%231%2Bauto%2Bp4` (v2c beside v4; `+trace` and
`+lattice` force one generator). Sheets in `docs/contact/v4-*`. The parameters
and the grounds of each page are on `Composition.parametric` (never drawn).
