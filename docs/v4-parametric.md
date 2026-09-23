# v4 — parametric anchors (experiment)

Branch `v4-parametric-anchors` (from `v3-composition-space`). Review only:
`compose()` without `parametric` is byte-for-byte what it was (372 pages ×
variants 0–3 verified after every change).

**Why.** v3 showed that deforming a finished page cannot dissolve the families:
what makes a page recognisable is its organisation, and the coherent
neighbourhood around an anchor is small (pages moved 18 % of the gap to another
family). So the anchors themselves are rebuilt as parametric generators, with
the continua the families used to be separate points of.

A page is now four things, none of them a kind of page:

| | what it settles | where |
| --- | --- | --- |
| **the figure** | the curve the title is walked along, and how many times it is written | `parametric/trace.ts` |
| **the page** | how large the writing is, where it stands, whether the edge cuts it | `parametric/paper.ts` |
| **the material** | what the page is made of besides its own characters | `parametric/material.ts` |
| **the frame** | the reading's own path, in which the material is placed | `parametric/frame.ts` |

## 1. The figure — line → arc → ring → rows

One generator holds what v1–v2c kept in seven compositions: the band's straight
row, the joint line, the path that turns at the language's breaks, the orbit's
closed ring, the grid, the stepping band, the lattice's dwindling rows. The
units are walked with a turtle; each step advances by its own beats and turns by
its share of the total turning; and the whole walk is written `rows` times.

| parameter | 0 | 1 | read from |
| --- | --- | --- | --- |
| `closure` | a straight row | a closed ring | how far the reading comes back: the repetition's coverage × how often it loops, the echo between the first and last character (same character / mora / vowel / script, or a mirror), how far toward the end the head of the dependency stands, the density of word boundaries |
| `corners` | a smooth bend | all the turning at the breaks | word boundaries per character |
| `opening` | closed | a quarter left open | a directed relation (dependency, inflection), scaled by how far the curve has closed and how much the two terms differ |
| `eccentricity` | a circle | swollen toward its heaviest character | the difference in ink × beats between the two terms |
| `tangency` | upright | each mark turned with the tangent | follows `closure` |
| `branch` | one line | one arm per coordinated term | a coordination: its terms, their number |
| `rows` | written once | written eight times | how much of the title repeats × how often it loops. **Not rounded**: 2.4 writes the title twice and its first 40 % again |
| `spacing` | — | — | how far apart the rows stand, never less than what a row's own turning sweeps |
| `shear` | rows aligned | each row a cell further along | the density of word boundaries |
| `decay` | rows equal | each row a fifth smaller | runs of the same character, erased seats |

**The threshold is gone.** Until now `rows >= 2` chose a different generator (a
lattice); a title either curved or ruled itself. Now a row *is* a trace, so a
grid is many straight traces, a warped lattice is many curved ones, and a title
that repeats a little writes a partial second row. Two invariants keep it
readable, and both are geometry rather than taste: rows stand at least their own
sweep apart, and where the rows would drive the characters below the smallest
size the page allows, the last writing of the title is given up.

Sweeps: `docs/contact/v4-trace-sweep.png`, `docs/contact/v4-lattice-sweep.png`.

## 2. The page — micro → normal → macro, middle → corner → cut

The generator used to centre every figure and fit it to 86 % of the page. That
one fixed relation cost the series its widest gestures: v2c writes a word small
in a corner, a character larger than the page and cut by its edge, a page that
is mostly empty. Those are not separate compositions in v2c either — they are
its **scale regimes** (`poem/scale.ts`), decided once per poem from two
readings. The same two readings are taken here as numbers:

| parameter | read from | what it gives |
| --- | --- | --- |
| `scale` | what the reading yields (`poeticPotential`) and what an operation produced (a residue read inside a character, the parts a character falls into) | the size of one character, 0.035 → 1.15 of the page: v2c's micro (a weak title, written small and aside), normal, and macro (only an operation's result, and it may be larger than the page) |
| `offset` | how much of the page the figure takes: the less it takes, the further from the middle it may stand; a figure larger than the page cannot be centred at all | 0 in the middle, 1 with its edge against the page's |
| `toward` | against the writing, and to the side the curve turns | which corner it stands in — so the page it leaves empty is the page the reading walks into |
| `hierarchy` | the same two readings | how much larger the poem's own subject is written than the rest of the title (1 → 5) |

Occupancy, centre bias, edge affinity, crop, origin and the direction of the
whitespace are not six settings here: they are what these four produce. A small
`scale` with a large `offset` is a word in a corner; a `scale` above one is a
character the edge cuts; `offset` near 1 is a figure against an edge; `toward`
says which edge, and so where the empty page lies.

**What keeps it honest is the invariant, not a margin.** A character may be cut
by the page, but more than half of it stays on it: each mark's own middle keeps
a quarter of its size clear of the edge. Where no place on the page satisfies
every character, the figure is drawn smaller until one does — the page never
loses a character in order to crop one.

Sweep: `docs/contact/v5-paper-sweep.png` (micro → normal → macro → macro cut →
aside → hierarchy → each title's own).

## 3. The material — silhouette / satellite / dust as one field

v2b–v2c keep what a page is *made of* in separate grammars — silhouette (a form
sampled in small marks), orbit (satellites on a ring), field (dust), residue
(what a subtraction left). Here small marks stand where a density field says
they may, and the field is a mixture of three placements:

| parameter | what it does | read from |
| --- | --- | --- |
| `density` | how much material at all — at 0 the page is the figure alone | what the title offers: its repetition, a form read inside its nucleus, erased seats, the rest of the title. Below 0.18, or with nowhere grounded to stand, a page carries none |
| `onForm` | the nucleus's own ink sampled in small characters | a form read inside it — one the title also writes (中 in 雨), or one its own parts read as (森's 木, 品's 口) — and the white it closes |
| `onRing` | small characters at a fixed distance from the reading | a coordination (1) or a dependency (0.6), and how much the title repeats |
| `onPage` | dust in the frame's own lattice, along the reading | erased seats, and repetition beyond what the form takes |
| `fineness` | a few satellites → many grains; also the sampling interval | how much material the title offers, and how dense the letterform it gathers on is |
| `spread` | how far the dust strays from the reading | an erasure scatters it; a repetition keeps it near the words it came from |
| `cut` | the inner glyph is taken out of the form before it is sampled (the residue) | the containment read in the nucleus |
| `sources` | what the small marks are written with, as shares | the strength of each |

None of the three placements has a floor: a floor put the same halo on every
page, which is a family again.

## 4. The frame — the material in the figure's own geometry

At first the material was placed in the page's coordinates: dust thinned from
left to right whatever the figure did, and the satellites stood on a circle
around the largest character. That is a layer laid over a page, not what a page
is made of. The frame is the reading's own path — the written units in order, as
one strand per row and one per arm of a branch — and every placement is said in
its two numbers: `s` how far along the reading, `d` how far from it.

- **dust runs with the figure**: its lattice is the frame's own, rows parallel
  to the curve, thinning along the reading (as v2c's field does) and fading away
  from it within `spread`. Where a curve turns back on itself the bands would
  cross, so a point further from the reading than the frame says it is belongs
  to another part of the curve and is dropped;
- **satellites stand at a fixed distance from the reading**: the offset loop of
  the frame. Where the page is one character that loop is a circle around it —
  v2c's orbit; where the reading is a curve they follow it; where it is a
  lattice they run alongside each row;
- **the grain of a form lies with the letterform**: its lattice turns with the
  character.

Three rules came out of looking at what that produced, each measured:

1. **a form either stands for the character or is not drawn.** Sampling a glyph
   and writing what was left of it made another character — 月 cut is 日, 見 cut
   is 目. A form is drawn only where its grains can be read as the character (its
   ink met in 45 places, half of them kept, at least 32 grains); then the
   character is not written at all, as in v2c's silhouette. What a form that
   cannot be read would have carried goes where the title already lets material
   stand, never to a place with no evidence.
2. **a character drawn in small characters takes the page.** v2c's small marks
   are 26–45 units of the page's thousand; v4's first were 7–13 — dots, not
   characters. The form now grows into the page as the material takes it.
3. **no grain stands on another** where the reading doubles back.

Sweep: `docs/contact/v4-material-sweep.png`.

## 5. What the pages are

93 titles (development + holdout + probe), `parametric: 'auto'`: 0 errors, **no
character lost, no reading-order break, no overlap, no grain on the title's ink,
no grain on a grain**, deterministic (93/93 byte-identical across runs).

The parameters spread instead of falling into a few values: `paper.scale`
0.07–1.13 over 41 distinct values, `paper.offset` 39, `paper.hierarchy` 38,
`closure` 0–1 over 27, `rows` 1–8 (13 pages write the title more than once, 10
of them a fractional number of times), `material.density` 0–0.9 over 69.

## 6. Evaluation

Measured in the v3 form space (`poem/form/measure.ts`). Two numbers were set for
this phase: the families must stay dissolved, and the pages must be as unlike
one another as v2c's were.

| | v2c | v4 figure only | v4 + material | v5 + the page |
| --- | --- | --- | --- | --- |
| 1-NN recovery of the title's v2c family | 85 % | 37 % | 30 % | **28 %** |
| nearest-neighbour distance, p25 / median / p75 | 0.09 / **0.98** / 1.72 | 0.01 / 0.19 / 1.01 | 0.13 / 1.34 / 1.68 | 0.57 / **1.63** / 2.10 |
| descriptors sitting at exactly 0 or 1 (mean over 14) | 54 % | 70 % | 50 % | **45 %** |
| pages between two v2c families (d1/d2 > 0.8) | 22 % | 26 % | 51 % | **55 %** |

### Does it still read as one series?

| | v2c | v5 |
| --- | --- | --- |
| nearest neighbour (median) | 0.98 | 1.63 |
| mean distance between any two pages | 5.02 | 4.92 |
| nearest neighbour ÷ mean distance | 20 % | 33 % |
| the loneliest page (95th) ÷ mean | 54 % | 63 % |

The cloud is the same size as v2c's (4.92 against 5.02) — the set has not spread
out. What changed is *inside* it: in v2c a page has a near-twin at a fifth of
the mean distance, in v5 at a third of it. v2c's series rhymes by repeating a
composition; v5's pages stand at a similar remove from one another. The
loneliest pages are slightly lonelier (63 % against 54 %), so a few titles now
stand further out than any v2c page did.

**The register** — what every page shares whatever its form, measured on the
marks rather than the descriptors:

| | v2c | v5 |
| --- | --- | --- |
| the largest character (share of the page) | 0.06 / 0.18 / 0.23 | 0.08 / 0.15 / 0.19 |
| marks on the page | 3 / 6 / 44 | 3 / 14 / 30 |
| ink laid down | 0.03 / 0.10 / 0.18 | 0.05 / 0.07 / 0.12 |
| the page the figure uses | 0.13 / 0.28 / 0.60 | 0.12 / 0.33 / 0.67 |
| largest ÷ smallest written character | 1.00 / 1.00 / 1.88 | 1.00 / 1.12 / 1.56 |
| the figure's nearest edge | 0.00 / 0.04 / 0.07 | **−0.01** / 0.04 / 0.12 |
| small marks: their size | 26 / 35 / 45 | 24 / 24 / 27 |

The page the figure uses now matches v2c's own spread (0.12–0.67 against
0.13–0.60), the negative nearest edge means figures are cut by the page again,
and the scale hierarchy is back (v2c still reaches further, 1.88 against 1.56).
What v5 does not reach is v2c's densest pages (44 marks) and its heaviest ink.

## 7. What is still weak

- **the material's register is narrow**: its small marks are 24–27 where v2c's
  are 26–45. A grain is always about the same size;
- **the densest pages are missing**: v2c writes 44 marks on a page, v5 30. The
  title written over and over until it covers the page is a place `rows` reaches
  only where the repetition is strong;
- **`corners` takes four values**, the last parameter that still behaves like a
  switch;
- **40 of 93 pages carry no material**, most because the title offers none (v2c
  leaves about as many plain), a few because a form could not be read and there
  was nowhere else grounded for it to go;
- **a page can be too even**: with the pages spread at a third of the mean
  distance from one another, nothing rhymes. Whether a series wants some pages
  to echo each other is a question for the work, not for the measure.

## 8. Next

- **the semantic layer** (v2d, still open): distances in the meaning space as
  further pressures on these same parameters — dispersion, closure, the
  material's sources, the page's own scale — never as characters on the page.

## 9. Review

`study.html?compare=%231%2Bauto|%231%2Bauto%2Bp4` (v2c beside v4; `+trace` holds
the figure to one row, `+lattice` asks for at least two). Sheets in
`docs/contact/v4-*` and `v5-*`; the parameters and the grounds of each page are
on `Composition.parametric` (never drawn).
