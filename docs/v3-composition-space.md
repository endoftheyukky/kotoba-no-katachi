# v3 — composition space (experiment)

Branch `v3-composition-space` (from `v2`). Review only: nothing here reaches
the public page, and `compose()` without the `form: 'v3'` force is byte-for-byte
what it was (all 372 development / holdout / probe pages × variants 0–3).

**Question.** Seen together, v2c pages read as members of a small countable set
of templates (silhouette, orbit, path, grid, field, joint line …). Can page form
be treated as a continuous space in which existing grammars are anchors, so that
a title finds its own position — deterministically, and for reasons it can name?

## 1. Diagnosis — the discrete-template problem, measured

**A form space.** `src/poem/form/measure.ts` describes a drawn page by fourteen
continuous quantities read from its marks alone (it does not know which grammar
drew the page): curvature, closure, radiality, fragmentation, dispersion,
periodicity, branching, (scale) hierarchy, rotation coherence, axis strength,
symmetry, containment, porosity, linearity. Definitions: `src/poem/form/profile.ts`.

**By family** (v2c auto, dev + holdout + probe, variants 0–3, 372 pages):

| family | n | curva | closu | radia | fragm | dispe | perio | branc | hiera | rotat | axis | symme | conta | poros | linea |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| attenuation | 13 | .14 | .00 | .00 | .02 | .58 | .63 | .00 | .20 | 1 | .11 | .67 | .00 | .30 | .77 |
| axis/joint | 7 | .00 | .00 | .00 | .05 | .49 | .08 | .00 | .17 | 1 | .31 | 1 | .00 | .37 | .24 |
| axis/poles | 45 | .00 | .00 | .00 | .15 | .59 | .01 | .00 | .30 | 1 | .54 | .80 | .10 | .57 | .11 |
| band | 4 | .08 | .00 | .00 | .54 | .46 | .24 | .00 | .67 | 1 | .12 | .88 | .00 | .14 | .44 |
| branch | 4 | .19 | .10 | .03 | .25 | .67 | 1 | .31 | .56 | .99 | .31 | .22 | .00 | .67 | .58 |
| centre | 9 | .00 | .00 | .00 | .26 | .72 | .09 | .00 | .66 | 1 | .78 | .14 | .00 | .57 | .05 |
| cluster | 95 | .00 | .00 | .00 | .14 | .09 | .01 | .00 | .01 | 1 | .07 | .98 | .00 | .10 | .09 |
| field | 27 | .01 | .01 | .00 | .38 | .59 | .78 | .07 | .21 | 1 | .08 | .92 | .00 | .21 | .65 |
| grid | 4 | .26 | .17 | .00 | .05 | .55 | .57 | .13 | .00 | 1 | .20 | .96 | .00 | .39 | .36 |
| lattice | 4 | .00 | .00 | .00 | .17 | .63 | .31 | .06 | .32 | 1 | .25 | 1 | .00 | .43 | .03 |
| nest | 3 | .00 | .00 | .02 | .26 | .36 | .00 | .00 | .55 | 1 | .05 | .89 | .48 | .22 | .07 |
| orbit | 14 | .38 | .11 | .87 | .29 | .55 | 1 | .21 | .49 | 1 | .29 | .86 | .03 | .65 | .41 |
| path | 33 | .03 | .00 | .00 | .09 | .64 | .17 | .00 | .00 | .99 | .41 | .69 | .00 | .48 | .35 |
| phase | 59 | .00 | .00 | .00 | .00 | .65 | .87 | 1 | .00 | .03 | .01 | .93 | .00 | .10 | .67 |
| scattered | 4 | .00 | .00 | .00 | .08 | .59 | .00 | .00 | .00 | .99 | .53 | .61 | .00 | .55 | .08 |
| silhouette | 42 | .29 | .18 | .46 | .28 | .59 | .76 | .68 | .18 | 1 | .15 | .65 | .00 | .65 | .27 |
| void | 5 | .00 | .00 | .00 | .00 | .09 | .00 | .00 | .00 | 1 | .06 | 1 | .00 | .02 | .00 |

(Many cluster and phase pages come from variants 1–3; the public series is variant 0.)

**The discreteness, in numbers** (standardised profiles):

- **The family can be told from the form alone.** For 85 % of the 93 public
  pages (87 % of all 372), the nearest page of *another title* belongs to the
  same family.
- **Families are islands.** A page's nearest page of another family is a median
  2.42 away; its nearest page of the same family 0.98. The gaps are about 2.5×
  the spacing inside a family (`docs/contact/v3-form-space-v2c.png`).
- **Several axes are switches, not quantities.** Share of pages sitting exactly
  at 0 or 1: rotation 93 %, containment 96 %, branching 90 %, radiality 88 %,
  closure 86 %, curvature 80 %. Each is "on" in one family and "off" in all
  others. Only dispersion, porosity, linearity and axis strength vary freely.

**Where the code fixes form discretely** (from each composition's and
grammar's own rules):

| family | fixed where it could be continuous | discrete by structure (keep) |
| --- | --- | --- |
| orbit | rings are circles; closed, or open by rule | which term rings which; how many rings |
| grid / lattice | every cell the same size and interval; row decay a fixed ratio | rows and cells come from the title's groups |
| path | a fixed 12° per unit, turning only at breaks | where it turns (word boundaries) |
| phase | rotation grows in fixed steps; nothing else rotates anywhere | which marks turn (order) |
| silhouette | one square sampling lattice | what the form is made of |
| scattered / band | equal steps, equal tilt | one word / one copy per step |
| joint / axis | a straight line, every seat equal | seats and gaps from the language |
| composition choice | winner-take-all, however close the runner-up | — |

The last row matters most: for 27 of 93 titles a second composition holds the
title within 75 % of the first's fitness (東京特許許可局 band 0.94 → path;
空をさがせ！ path ≈ axis 0.99; 雨の中の雨 nest ≈ centre 0.99; ころころ grid →
field 0.85; the joint lines 0.76–0.89 → path), and the page shows none of it.

## 2. Proposal — a continuous form profile

`FormProfile` (the fourteen axes, 0–1) is used twice: **measured** on a drawn
page, and as a **target**: `src/poem/form/target.ts` reads fifteen properties
of the title and turns them into signed pressures on the axes. Every pressure
names its cause (the rule of this work: no effect without a linguistic property):

| property (0–1) | read from | pushes |
| --- | --- | --- |
| asymmetry | the two terms of the title's binary relation differ in weight (ink × beats) | symmetry −, closure −, hierarchy + |
| inkContrast | the letterforms differ in how much ink they carry | periodicity −, hierarchy + |
| irregularRepeat / perfectRepeat | a repetition that covers the title unevenly / a whole repetition or mirror | periodicity − / +, symmetry +, dispersion − |
| prosody | ん, っ, long and whispered vowels among the beats | periodicity − |
| turns | word boundaries per character | curvature +, branching +, rotation − |
| switches | script changes along the title | rotation − |
| returning | the title ends where it began (same character, same vowel, mirror) | curvature +, closure +, linearity − |
| erasure | negation, a silent beat | fragmentation +, dispersion +, porosity + |
| decomposable | a character with three or more islands of ink | fragmentation + |
| contained | a letterform read inside another | containment + |
| star | several words on one head, several coordinated terms | radiality +, branching + |
| length | a long title | linearity + |
| glyphAsymmetry | letterforms not mirror-symmetric | symmetry − |
| counters | letterforms that close white | porosity + |

The weights are stated in `RULES` (target.ts), and every page records its
pressures (`Composition.form.target.pressures`).

## 3. Implementation — anchors, deformation, equilibrium

`compose(a, { grammar: 'auto', form: 'v3' })` (review only):

1. **Anchor.** The page v2c draws (composition + grammar), unchanged.
2. **Between two compositions** (`form/morph.ts`). Where a second composition
   holds the title almost as well (fitness ratio ≥ 0.7), the page turns toward
   it — *along the reading*: from the first word boundary (else the middle)
   onward, marks move progressively toward where the second would put them, up
   to 55 % at a tie; what the grammar added moves with the nearest title marks.
   Not where the two differ mainly in scale or in how many marks they write
   (they are neighbours in fitness, not in form: between them a page only shrinks).
3. **Deformation operators** (`form/deform.ts`), each driven by named pressures,
   each with geometry from the page's own structure:

   | operator | driven by | what moves |
   | --- | --- | --- |
   | scale | hierarchy | the title's characters sized by the weight of their ink |
   | warp | periodicity −, symmetry − | spacing pulled toward heavier letterforms, pushed from special beats |
   | bend | curvature, closure | lines and rows curve toward what they depend on (a line of the title ≤ 40°) |
   | kink | branching | the written line turns at each word boundary |
   | ring | symmetry −, closure − | orbits lean toward the other pole, drift off centre, open on the lighter side |
   | radial | radiality | small marks round a head gather onto rays (one per dependent) |
   | drift | fragmentation (only where the title erases) | the form slumps on, in order, from where its reading ends |
   | turn | rotation − | the title's characters turn gradually along the reading |

4. **Equilibrium.** Each step takes the largest share of what the title asks
   (1, .75, .5, .3, .15, 0) at which the page stays **sound** — no character
   lost, reading order kept, no overlap of the title's marks, no derived mark
   on ink or on another (`form/invariants.ts`, the v2 audits as one function) —
   and **coherent**: a texture may not be stretched unevenly (95th percentile of
   neighbour-distance change ≤ 22 %). Where a constraint stops an operator the
   page rests there; the record says which constraint.

Determinism: the anchor is deterministic, the pressures are read, the operators
are pure; one plastic choice (the orientation of rays) draws from the title's
seed. 372/372 pages identical across two runs.

### Iterations

| | what | 1-NN family (public / all) | between two families (public / all) | verdict |
| --- | --- | --- | --- | --- |
| v2c | anchor | 85 % / 87 % | 26 % / 34 % | — |
| v3a | operators only | 85 % / 87 % | 25 % / 29 % | grains fade and scatter: erosion, not form |
| v3b | + morph everywhere at once | 83 % / 77 % | 23 % / 35 % | moves pages 43 % of the gap, but they become undecided — a nest half a centre is a weaker nest (`v3-uniform-morph-rejected.png`) |
| v3c | morph along the reading, gated; drift only for erasure; no grain scaling or turning | 83 % / 86 % | 27 % / 31 % | no melting, but ink warp jitters regular rows |
| v3d | + coherence invariant; bend limits | 84 % / 87 % | 27 % / 30 % | coherent; subtle |

v3d, public series: 53 of 93 pages move; median move 0.29 = 18 % of the gap to
another family (v3b: 43 %); within-family spread 1.94 → 2.08; 11 pages move at
least half the gap; 0 pages less sound than their anchor
(`docs/contact/v3-form-map.png`).

## 4. Review

- `study.html?compare=%231%2Bauto|%231%2Bauto%2Bv3` — v2c beside v3, any set.
- `docs/contact/v3-representative.png` (v2c | v3d, 12 titles with near-ties),
  `v3-dev34-pairs.png`, `v3-holdout-pairs.png` (every title, v2c | v3d, with
  anchor and the operators taken), `v3-uniform-morph-rejected.png` (v3b).
- `tools/form/`: dump drafts from a running dev server (`drafts.mjs` via
  `cdp.mjs`), measure them in node (`measure.mts`), `analyze.cjs` (family
  table, discreteness), `compare.cjs` (moves vs gaps, map), `pairs.mjs` (sheets).

## 5. Evaluation — does it improve the work, or add noise?

**What works** — coherent intermediate states, each with a named reason:
- orbits that lean toward the other pole and open on the lighter side
  (大きな犬, 眠る, 王と玉): no longer "a circle", not yet anything else;
- rain rows that arc around 中 because the title returns to where it began
  (雨の中の雨): a centre beginning to become an orbit;
- joint lines that start to walk after the word boundary (歩きながら, 今日は晴れ):
  between the joint and the path that nearly held them;
- branch rows that curve (木と林と森), a column that turns along its reading
  (一、二、三), a path that curves further (春はあけぼの);
- the title's characters sized by their own ink (美しい, 待って！).

**What does not** — and was removed or limited on the way:
- loosening, fading and per-mark displacement read as erosion or jitter, however
  well grounded the field (v3a, v3c): deformation must act at the scale of the
  figure, never of the mark — now an invariant;
- a page moved uniformly between two compositions is undecided, not balanced (v3b);
- descriptors have discontinuities (ぽつぽつ "moves" 5.2 with no visible change).

**Honest conclusion.** v3d is not noise: every change is coherent, grounded, and
never costs soundness, and it makes pages more title-specific — especially
orbits and lines. But it does **not** yet dissolve the enumerable-template
feeling: families remain islands (1-NN 84 %), pages move 18 % of the gap.
Post-hoc deformation cannot change what makes a family recognisable — its
organisation (a ring, a lattice, a line, two poles) — without breaking the page;
the coherent part of the space around each anchor is small. The experiment
locates the problem precisely rather than solving it.

## 6. Next — where continuity has to live

Not after the page is drawn, but where the anchor is generated:

1. **Parametric anchors.** Replace fixed shapes by one-parameter families the
   grammar itself realises: an orbit's ring as a closed curve with eccentricity,
   opening and centre offset from the relation (not a circle then deformed);
   the grid's cell size and interval as functions of beat weight (the grid that
   warps); the path's total turning from prosody rather than 12° per unit; the
   silhouette's sampling lattice oriented and spaced by the nucleus's strokes.
2. **A continuum across families.** Line → arc → ring as one composition with a
   closure parameter (band / path / orbit as points on it); grid → field as one
   with a regularity parameter. Then "between" is a place in a family, not a
   blend of two.
3. **Soft composition choice.** Near-ties (27 of 93) are the strongest,
   structurally justified source of in-between pages; the along-reading
   transition (v3d) is the right form of it and should be generalised.
4. **Semantic space → paper space (not implemented this round).** The pressures
   in `target.ts` are the place for it: distance between the title's words in the
   v2d tables (aozora / chiVe) → dispersion and axis strength (near meanings held
   close, far ones apart); several neighbourhoods → branching. Meaning acts as a
   force on the form, never as characters on the page — the conclusion of v2d.
