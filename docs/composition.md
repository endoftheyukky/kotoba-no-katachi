# Composition: the generator

How the generator turns an `Analysis` (see [reading.md](reading.md)) and a `Meaning` (see
[semantics.md](semantics.md)) into a `Draft`. Every constant below is the one
in the code; file references are to `src/poem/`. `clip(x, lo, hi)` clamps
(default 0…1); `lean(key, x)` is the motif pull of [§3](#3-motifs-and-rhyme).

```
compose(a, meaning)
  ├─ §1  operation layer → Material (units, primary, modifiers)
  └─ parametricPage(a, material, rng.fork('parametric'), meaning)       parametric/index.ts
       ├─ §3  motifs = readMotifs(a, material)
       ├─ §4–6 traceParams(): figure, rows, paper, acts                   parametric/params.ts, acts.ts
       ├─ §7  traceMarks(): the figure laid on the page                   parametric/trace.ts, paper.ts
       ├─ §8  materialParams() → economy → materialMarks()                 parametric/params.ts, material.ts, frame.ts
       └─ marks = [...figure marks, ...material marks]
  └─ §9  withFaces(a, material, marks)                                    face.ts
```

## 1. The operation layer

The first half of `compose()` is the operation layer (`compose.ts`,
`operations/*`, `salience.ts`, `potential.ts`). Its output, the `Material`,
is what the rest of the generator draws.

**Proposals.** Four operations each propose readings of the title
(`propose(a)`); each proposal has a `focus`, a `level` (1 = between words and
characters, 2 = inside a character, 3 = sound, 4 = the white inside a
letterform), an `origin` (`endogenous` — the title's own structure,
`intrinsic` — one character's own form, `exogenous` — a component the title
does not write) and `roles` (whether it may be primary, whether it may be a
modifier):

| operation | focus kinds | reads |
| --- | --- | --- |
| proliferation | `repetition`, `plain` | reduplication, recurrence of graphemes / morae / sounds, a form repeated inside one character (`echoForm`) |
| decomposition | `parts`, `joint` | `structuralParts` (islands or open seams), cuts by beats when a reading is given, a kanji stem + kana ending |
| transformation | `pair` | glyph containment / similarity between the title's characters (or with an inventory component), voicing (ぜ = せ + ゛) |
| absence | `absence`, `counter` | negations, っ (silence), relation words; counters (white enclosed by strokes) |

The values each proposal assigns are written out, rule by rule, in the
`rules` array at the top of each operation file.

**Scores.**

```
linguisticSalience = relationStrength^0.4 · distinctiveness^0.4 · coverage^0.2     (0 if any is 0)
visualPotential    = legibility · structure                                        (per focus kind, potential.ts)
poeticPotential    = √(linguisticSalience · visualPotential)
```

**Feature descent** (`compose.ts`). Candidates allowed to be primary are
ranked by `poeticPotential` in five layers: (1) levels ≤ 2 of the title's own
proposals; (2) + exogenous proposals of level ≤ 2; (3) + level 3; (4) +
level 4; (5) everything. Starting at layer 1, with `upper` the best of the
current layer and `deepest` the best of the last:

```
upper ≥ SETTLED (0.6)                                   → settle here
upper < DESCENT_FLOOR (0.32)                            → go down a layer
deepest ≥ DECISIVE (1.5) · upper and deepest ≥ 0.6      → go down, unless the deeper candidate reads
                                                          the same observation (shared basis) → settle
otherwise                                               → settle
```

The primary operation is the first of the settled layer (variant 0; the site
never uses another variant).

**Modifiers.** Every other proposal may act on the material as a modifier if
it is not the primary's operation, has `roles.modifier`, has salience ≥ 0.4
(`MODIFIER_SALIENCE`), and its slot is free: one *material* modifier
(decomposition or transformation; taken already if the primary is one of
them) and one *subtractive* modifier (absence). Its `apply()` rewrites units:

| operation | as primary | as modifier |
| --- | --- | --- |
| absence | marks its graphemes `absent` (unless that would leave nothing written) | the same |
| decomposition | no change to units | `parts`: the character written as its parts, slightly apart |
| transformation | no change to units | `minus`: every occurrence of the outer glyph written with the inner glyph removed |

**What the page takes from it:**

- `units` = the material's units in reading order, with `absent`, `parts` and
  `minus` as the operation layer set them;
- `primary.poeticPotential` (the page's `potential`, §5);
- `primary.focus` — `pair` + containment gives `operation = relation.score`;
  `parts` gives `operation = 0.55 + 0.45 · echo.similarity`; the focus also
  names the page's subject (§5), feeds the `nesting` motif (§3), and decides
  which marks are written in the reading face (§9).

## 2. What is read per unit

With `n` the number of non-space graphemes:

```
weight_i  = clip(mean mora weight of the morae containing unit i, 0.6, 2.2)   (1 if none)   "beats"
ink_i     = glyph density of unit i (reading face)
contrast  = clip(std(ink) / mean(ink) / 0.45)
size_i    = clip((ink_i / mean(ink))^(0.5 · contrast), 0.8, 1.25) · 0.92^run_i
            run_i = how many of the previous 3 units are the same character
breaks    = unit indices where the token changes
```

## 3. Motifs and rhyme

`readMotifs(a, material)` (`parametric/motif.ts`), each in [0, 1]:

```
repetition   = clip(covered / n · (0.45 + 0.55 · clip((occurrences − 1) / 2)))
               covered: graphemes in a reduplication or a grapheme recurrence; occurrences: the most of either
pairing      = clip(terms · (0.6 + 0.4 · clip((tokens − 1) / 3)))       terms = 1 coordination, 0.65 dependency, else 0
nesting      = clip(max(read, 0.75 if focus is parts, 0.5 if focus is counter) + 0.1 · clip(counters / 3))
               read = clip((score − 0.5) / 0.45) of the strongest containment ≥ 0.65 between the title's own
               CJK characters (not inventory); counters: over all the title's characters
absence      = clip(absent units / units + 0.45 if a negation)
articulation = clip((tokens − 1) / max(1, n − 1) / 0.5)
echo         = clip(0.7 · ends + 0.5 · special / morae)
               ends: 1 mirror, 0.9 same first/last character, 0.7 same mora, 0.45 same vowel, 0.15 same script, else 0
               special: N / Q / R / devoiced morae
```

Many parameters are then pulled toward a **chord** for every motif the title
has, as far as it has it (`drawn`, `RHYME = 0.6`):

```
for motif in [repetition, pairing, nesting, absence, articulation, echo]:
  if CHORDS[motif][key] exists:  v ← v + 0.6 · motifs[motif] · (CHORDS[motif][key] − v)
```

| motif | chord targets |
| --- | --- |
| repetition | rows 3.2, closure 0.45, corners 0.25, scale 0.12, offset 0.25, density 0.8, onPage 0.5, fineness 0.75 |
| pairing | eccentricity 0.35, opening 0.18, corners 0.45, offset 0.55, scale 0.2 |
| nesting | scale 0.5, hierarchy 3.2, closure 0.25, tangency 0.25, onForm 0.7, cut 0.4, density 0.75, fineness 0.6 |
| absence | offset 0.75, scale 0.09, decay 0.15, corners 0.35, onPage 0.6, spread 0.7, density 0.6 |
| articulation | corners 0.8, shear 0.6, closure 0.3, offset 0.45, spread 0.4 |
| echo | closure 0.7, corners 0.15, tangency 0.6, fineness 0.8, density 0.5, onForm 0.35 |

Titles that share a structure are drawn toward the same values in the
parameters that structure touches, and stay apart in the rest.

## 4. The figure (`parametric/params.ts`)

The title is walked as one curve and written `rows` times.

```
repeatShare  = covered / n                       (as in the repetition motif)
loops        = clip((occurrences − 1) / 2)
endEcho      = as `ends` above, with 0.75 for the same mora and 0.2 for the same script
headFinality = dependency ? clip((head − dependent) / max(1, tokens − 1)) : 0
turnDensity  = clip((tokens − 1) / max(1, n − 1))

closure      = lean(clip(0.55 · repeatShare · (0.45 + 0.55 · loops) + 0.4 · endEcho
                         + 0.3 · headFinality + 0.25 · turnDensity))          total turning, in turns
corners      = lean(clip(turnDensity / 0.5))                                  share of turning spent at word breaks
asymmetry    = clip(|ln(w(A) / w(B))| / ln 4)     A, B: the dependency's or coordination's two terms,
                                                   w(token) = Σ ink · (1 + length / 4)
eccentricity = lean(clip(0.4 · asymmetry))
opening      = directed ? lean(clip(directed · clip((closure − 0.35) / 0.5) · (0.12 + 0.3 · asymmetry), 0, 0.4)) : 0
               directed = 1 dependency, 0.6 inflection, else 0
tangency     = lean(clip(1.4 · closure − 0.2))                                how far marks turn with the curve
branch       = at a coordination: one group of units per term (the marker joins the term before it),
               forking at the first term's first unit, fan = clip(0.08 + 0.03 · groups, 0, 0.25) turns
side         = rng.next() < 0.5 ? +1 : −1                                     the only random draw of the page

strength     = repeatShare · (0.4 + 0.6 · loops)
rows         = clip(lean(1 + 7 · strength + 4.2 · kept.crowd), 1, 8)          not rounded: 2.4 = twice and 40 %
spacing      = 1 + 0.35 · (1 − repeatShare)
shear        = clip(lean(clip(1 / units + 0.6 · turnDensity, 0, 1.2)), 0, 1.2)
decay        = clip(lean(clip(0.3 · runs / units + 0.2 · absent / units, 0, 0.4)), 0, 0.4)
               runs: units equal to the unit before them
```

`kept.crowd` is the crowd act after competition (§6).

## 5. The page (`parametric/params.ts`, `paper.ts`)

```
leaning   = coverage · max_axis |axis|                    (0 without meaning)
potential = max(clip(primary.poeticPotential), clip(0.3 + 0.45 · leaning))
operation = primary focus: pair+containment → relation.score; parts → 0.55 + 0.45 · echo.similarity; else 0
press     = clip(1 − 0.15·still − 0.12·alone − 0.1·fading − 0.12·open + 0.4·heavy + 0.45·closed + 0.25·stirred, 0.72, 1.5)
result    = (written units ≤ 1 ? 0.9 : 0.25) · operation
scale     = clip(lean(clip((0.04 + 0.22 · potential) · press + result, 0.035, 1.15)), 0.035, 1.15)
            the em size of one character as a share of the page
occupancy = clip(scale · max(1, units) / 0.86, 0.05, 1.3)
offset    = clip(lean(max(clip(1.05 − occupancy), clip(3 · (occupancy − 1))))
                 + 0.3·alone + 0.2·far + 0.15·open − 0.3·closed)             0 centred … 1 against the edge
toward    = atan2(−along.y + 0.8 · side · across.y + 1.4 · (falling − rising),
                  −along.x + 0.8 · side · across.x)
            along / across: the writing direction and the next-line direction
hierarchy = clip(lean(clip(1 + 3.2 · operation + 1.4 · clip((potential − 0.5) / 0.5), 1, 5)), 1, 5)
```

If `hierarchy > 1.02`, the **subject** — the units of the primary's
repetition, the character whose parts or counter it reads, or every
occurrence of the outer character of its pair — is written `√hierarchy`
larger, every other unit `√hierarchy` smaller.

## 6. Acts: what is done to the characters (`parametric/acts.ts`)

**Economy.** Raw strengths from the meaning's poles (see
[semantics.md](semantics.md#4-from-axes-to-poles)) and the motifs:

```
split    = clip(severed + 0.55 · pairing)
spread   = clip((0.8·far + 0.6·open + 0.35·still) / 1.2 + 0.25 · articulation)
gather   = clip(0.5 · (many + joined))
withdraw = clip(0.8·alone + 0.35·fading + 0.3·far − 0.5·many)
erode    = clip(0.85·fading + 0.25·falling + 0.3 · absence)
lean     = clip(stirred)
crowd    = clip(0.9·many + 0.3·stirred)

lead     = max(raw)
kept_k   = raw_k · (raw_k / lead)²                  the leader keeps all; half as strong → an eighth
leader   = argmax raw, if lead > 0.05
```

The acts compete, so a page has one leading gesture and the others recede
smoothly. The **form** of each act always comes from the letterforms, the
sound or the word's divisions; meaning sets only the strengths.

| act | rule (with `e` = kept strengths) |
| --- | --- |
| **gaps** | per gap between units, in steps of the mean weight: `1.6 · e.spread · (0.6 + 0.4 · boundary) − 0.35 · e.gather`, plus `2.6 · e.split` at the seam — the first word boundary, else the middle |
| **withdraw** | if `e.withdraw > 0.03` and n > 1: the written unit with the least `ink · weight` leaves, `1.2 + 5 · e.withdraw` steps in the direction `toward + π` (the empty side of the page), `0.3 · e.withdraw` smaller; in the last row only |
| **erode** | if `e.erode > 0.03` and more than one character is written: unit i loses `amount = clip(0.75 · e.erode · (i / (n−1))^1.3, 0, 0.6)` — the first whole, the last most worn. A kanji with ≥ 2 structural parts loses whole components, farthest along the reading first, while `gone + next ≤ amount + 0.12` and ≥ 35 % remains, never the last one; any other character (kana, a kanji that does not come apart) only when `amount ≥ 0.3`, clipped by `min(0.34, amount / 2)` of its size from its thinnest side. A title of one written character is not worn at all |
| **lean** | every written unit tilts `(26 · e.lean + held) · inkLean` degrees; `held` = 7 for an N / Q / R / devoiced mora; `inkLean = clip(6 · (column centroid − ½), −1, 1)` — a glyph whose ink is centred does not lean |
| **cut** | if `e.split > 0.12`: among kanji that did not withdraw or wear, whose structural parts are islands or open seams (closure ≤ 0.35), the one whose seam splits the ink most evenly (`1 − |share₀ − share₁| > 0.35`) is divided at its seam; the halves part by `0.12 + 0.45 · e.split` of its size across the seam and slide 0.7 × that along it (a divided 束 must not close into 東) |
| **crowd** | read in §4: adds to `rows` |

Rules that came from looking at the output: a kana or a one-character title is
never worn by components (it would become another character: 愛 → 受); a cut
never goes through solid strokes (土, 大, 本 would only look broken); one act
per character.

## 7. Laying the figure on the page (`parametric/trace.ts`, `paper.ts`)

**The curve.** A turtle walks the units: each step advances by its weight and
turns by

```
closing = closure · (1 − opening);  total = 2π · closing · side
at each break: + total · corners / (breaks + closing)
at every step: + (total − total·corners [if there are breaks]) / (n − 1 + closing)
```

(sharing over one more place than there are gaps keeps a closing curve from
writing its last character on its first). With `eccentricity ≥ 0.02`,
`closure ≥ 0.45` and ≥ 4 units, the curve is swollen radially about its
centroid by `1 + eccentricity · cos(θ − θ_heaviest)`. A branch walks the stem,
then each term as its own arm from the fork, fanned about the heading there.
The start heading is 0 (horizontal) or π/2 (vertical).

**Rows.** The walk is repeated `⌈rows⌉` times; the last row holds
`round(frac · n)` units. Row r is moved by `(across · gap + along · shear · step) · r`
and scaled by `max(0.4, (1 − decay)^r)`, with
`gap = max(spacing · step, sweep + 0.95 · smallest weight)` (rows never cross).
Gaps from the acts are added along the writing, but capped so that the word
opens only as far as the page can hold it at the size `scale` asks for.

**Fit** (`fit`, `measure`, `stand`):

```
want      = scale · PAGE / (0.86 · smallest weight)                       figure units → page units
most      = (1 − 2 · 0.04) · PAGE / max(box width, box height)             every place on the page
k         = min(want, most)
centre    = PAGE/2 + (cos toward, sin toward) · offset · |PAGE − span| / 2
em        = min(1.15 · PAGE / largest size, 0.86 · smallest weight · k) · min(1, room)
room      = min over pairs of written units of  distance · k / (want_pair · em₀)
            want_pair = ½ (size_u + size_v) · (tangency > 0.2 ? 1.45 : 0.92 + 0.53 · min(1, (|lean_u| + |lean_v|) / 24))
```

The withdrawn character does not take part in the fit. Then the centre is
moved, axis by axis, so that every written character's middle stays at least
`edgeKeep(size) · size` from the page edge:

```
edgeKeep(size) = 0.62 + (0.26 − 0.62) · clip((size / PAGE − 0.12) / 0.28)
```

— a character up to 12 % of the page stays wholly on it with a margin; from
40 % up, up to about half of it may be cut by the edge. If no
centre satisfies every character, the figure is drawn 0.85× smaller, and so
on (down to 6 %); if the characters would fall below `0.035 · PAGE`, rows
are given up half a row at a time instead. Mark size is
`max(0.035 · PAGE, em · size_i)`.

**Each mark.** Rotation `= (heading − start heading) · tangency` (degrees) `+ lean`.
The withdrawn character is placed where the act sent it, else where it stood,
else at the nearest page corner — the first of these where it overlaps no
other written character. Erosion and cut clip the glyph (`keep`, intersected
with any parts the operation layer set); if a clip would remove every part,
the glyph is drawn whole. Finally a character drawn in parts is nudged as a
group so that the edge rule holds for what is drawn.

## 8. Material (`parametric/params.ts`, `material.ts`, `frame.ts`)

Small marks made of the title's own characters, placed in the figure's own
geometry.

**Parameters** (`materialParams`), with the **nucleus** = the largest written
mark:

```
repeat    = the most repeated character: clip((count − 1) / 3 + 0.3), else 0
inner     = max(score of the strongest containment ≥ 0.65 inside the nucleus between the title's own CJK
                characters, a form the nucleus repeats in its own parts ≥ 2 times (森's three 木) read by readPart)
rest      = clip(other characters / n)
erasure   = clip(absent / units + 0.3 if a negation)
onForm    = lean(clip(inner))                                          on the nucleus's ink
onRing    = lean(clip(max(coordination 1, dependency 0.6) · (0.35 + 0.5 · repeat)))    around the reading
onPage    = lean(clip(0.7·erasure + 0.25·clip(repeat − inner) + 0.6·many + 0.45·fading + 0.3·stirred))   dust
offered   = 0.55·repeat + 0.4·inner + 0.3·erasure + 0.15·rest + 0.45·many + 0.35·fading + 0.2·stirred
density   = (offered < 0.18 or onForm + onRing + onPage < 0.15) ? 0 : lean(clip(offered))
fineness  = lean(clip(0.3 + 0.4·repeat + 0.25·erasure + 0.3·clip((ink(nucleus) − 0.12) / 0.16)))
regularity= clip(1 − 0.5 · special / morae)
cut       = containment in the nucleus ? lean(containment) : 0             the residue is sampled instead
radius    = clip(0.12 + 0.14·repeat + 0.06·rest, 0.1, 0.32)
spread    = lean(clip(0.8·erasure + 0.35·rest − 0.2·repeat))
sources   = { repeat, inner, rest: 0.5·rest, self: 0.3 if repeat + inner + 0.5·rest < 0.2 }
```

**Economy with the acts:** if `lead > density`, `density ← density · (density / lead)²`.

**Placement** (`materialMarks`; nothing is random — a fixed 4 × 4 Bayer
dither decides which lattice points are dropped, and `hash2` a fixed jitter):

- the three weights are normalised; nothing is placed if `density ≤ 0.02`;
- **frame**: the written units' positions in reading order, broken into
  strands where a gap exceeds max(2.2 × the median gap, 1.2 × the size); `s`
  = along the reading (0–1), `d` = distance from it;
- **form**: the nucleus is enlarged to span
  `max(1.12 · size, PAGE · (0.32 + 0.38 · clip((takes − 0.45) / 0.55)))`
  (`takes = onForm · (0.4 + 0.9 · density)`, growth ≤ 4×) and moved toward the
  page centre; its ink is sampled on a lattice turned with it, step
  `size / (11 + 13 · fineness)`, grain size
  `max(step · (0.62 + 0.25 · (1 − fineness)), 0.014 · PAGE)`; a point is kept
  when `ink · onForm · (0.4 + 0.9 · density) > dither`. The form **stands** only
  with ≥ 45 ink cells, ≥ 32 grains and ≥ half the cells; then the grains
  replace the nucleus (they `represent` its grapheme). Otherwise its weight
  goes to ring and dust;
- **ring**: satellites on a loop at `max(radius · PAGE, 0.7 · nucleus)` around
  each strand (a circle around a single character), size
  `clip(nucleus · (0.2 + 0.16 · (1 − fineness)), 0.02, 0.09) · PAGE`, count
  `max(5, round(min(48, loop / (1.35 · size)) · (0.35 + 0.65 · density) · w_ring))`,
  `w_ring` = the ring's normalised weight (including what an unreadable form
  passed on);
- **dust**: a lattice along and across each strand, step
  `max((0.075 − 0.05 · fineness) · PAGE, 1.3 · size)`, reaching
  `PAGE · (0.09 + 0.62 · spread)`; a point whose own distance from the reading
  does not match its lattice row (it belongs to another part of the curve) is
  dropped; a point is considered only if `dither(i+2, j+1) < 0.15 + 0.5 · density`,
  and kept if `thinning · fade · clear · w_dust · (0.35 + 0.9 · density) > dither(i, j)`, where
  `thinning = clip(1.15 − s)`, `fade = clip(1 − (d / reach)^1.6)`,
  `clear` keeps it off written marks;
- characters of grains follow the source shares in a fixed order
  (`(7i + 13j) mod 100`); no grain stands on another; no grain stands on
  written ink (checked at its centre and four points at ±0.3 of its size);
  every grain stays within 2–98 % of the page.

## 9. Faces (`face.ts`)

A mark is written in the reading face (Noto Sans JP 500) when it is a reading
of ink — clipped, shifted or subtracted, the two terms of the primary's glyph
pair, the character whose counter the primary reads — and in the writing face
(Noto Serif JP 300) otherwise. A derived mark (a grain) smaller than
`0.035 · PAGE` is written in the reading face, whose strokes survive at that
size. The serif is used only for characters it covers and has ink for.

## 10. Cropping, in one place

- The **page edge** clips everything (the SVG's page clip). How much of a
  character it may cut is `edgeKeep(size)` (§7): none for small characters, up
  to about half for macro characters.
- **Acts** clip glyphs in em space: erosion keeps whole components (or all but
  a strip of the thinnest side); a cut keeps each half.
- **Operation-layer modifiers**: decomposition draws a character as its parts
  (each a clip), transformation removes another glyph's ink (a mask).

## 11. What holds by construction

The rules below are enforced while the page is made, not checked afterwards:
no character is lost to an act (a withdrawn character is held on the page; a
worn one keeps a component; a clip that would remove everything is undone);
no two written characters overlap (the size follows the closest pair); every
character keeps `edgeKeep` of itself on the page; no grain stands on written
ink or on another grain; the only random choice is `side`. The invariant audit
that checks these on the output is offline — see
[reproducibility.md](reproducibility.md#verification).
