# Visual grammar — design record

Feature descent is frozen at v1. This phase widens what the page can do with
what the analysis already reads; it adds no linguistic analysis.

A feature and a composition are not in one-to-one correspondence. Each
composition offers every way it could hold the material (`offer()` returning
`Realization[]`), and the ways are compared by what they actually read:

1. `realisable` is a hard gate — a way the page cannot hold at a readable size
   is not a way. The composition decides it, because it is the only thing that
   knows its own geometry.
2. `fitness` is the order — how far the feature's measured properties meet
   what that way needs.
3. `specificity` separates near-equals only (within 0.05), and is capped at
   three non-generic properties so that naming more of them cannot by itself
   win.

The worth of the feature itself (`poeticPotential`) is settled in the descent
and is never re-judged here.

## NEST / CONTAINMENT — implemented

**Input (v1).** Only containment read between letterforms, as a
`GlyphRelation`: 川⊂州, 日⊂白, 門⊂間. Counters are not in v1 — 中心・周縁
already puts the title inside them, so moving them here adds no new vocabulary.
The two can be brought together later.

**Rules.** The outer is written at the size of the page with the inner taken
out of it, leaving a hole exactly where the reading found the inner form; the
inner is written inside that hole, at the position and scale the reading
already carries (`p = q·scale + (dx, dy)`), smaller than the hole so that it is
*in* it. No rotation, nothing random beyond a small plastic offset of the whole
figure.

**The residue is not a third term.** What is left of the outer is the outer,
in its place, being what surrounds. This is different from "the rest is not
shown": the rest of the *title* is kept, on the line of the reading, unless the
poem writes it as space.

**Fitness** = reading strength × how much of the outer remains × how much of
that remainder is a body rather than crumbs. An outer that is almost entirely
the inner (川⊂州, residue 22%) leaves a thin shell and scores low; one with a
third left (ナ⊂カ 37%, 中⊂雨 32%) scores high. This is why nest takes some
containments and not others, and it is not a preference for the composition.

## GRID / TILING — design, not implemented

**Correction (v1 policy).** An earlier note said ころころ stays a FIELD because
all its cells are identical. That was wrong and is withdrawn. The rule is:

> Where **an explicit grouping × the number of units in a group** can be
> measured, a GRID candidate is offered — even when the contents are identical.

So ころころ = 2 groups (the reduplication) × 2 graphemes = **2×2 is a valid
candidate**. FIELD remains a candidate too; they compete on fitness.

N×M needs a *linguistic* grouping: a reduplication's halves, the morae of each
token, or a grouping the glyph itself shows (田's four counters measured as a
grid). With no grouping, only 1×N is offered. That is the whole guard against
arbitrary tiling.

Module orientation that alternates by group is deferred: only reduplication
would ground it, and it falls into decoration too easily.

## PATH / FLOW — design, not implemented

**Correction.** The eligibility condition and the prediction table contradicted
each other: 川 (3 parts) and 言葉 (5 parts) were predicted to gain PATH
candidates while the condition asked for six units or more. The condition
stands, the predictions were wrong:

> PATH is offered when the sequence is a trajectory and not merely a line:
> **six or more units**, **or a point where the reading turns** (a token
> boundary, a written space, the joint of a word), **or a repetition of four or
> more occurrences.**

Under it: 東京特許許可局 (9 seats) and ささやき / コーヒー (8 marks) qualify;
**川 (3) and 言葉 (5 parts, one word) do not**; two-term features (a joint, a
similarity) never do.

Orientation is not an added decoration: each unit's rotation is the tangent of
the path at its place, and PATH is the only composition permitted to set
rotation. A break in the language is a corner in the path; where the language
has no break the path may bend smoothly, and that curvature is recorded as
plastic.

## AXIS / 継ぎ目 (joint) — implemented, frozen at v1

Not a new composition. One relation — a stem and its ending — held two ways
inside AXIS, with one fitness between them. `POLE_SCORE` and the axis fitness
are unchanged; nothing new competes in `fits`.

**Why.** An audit of the thirteen titles AXIS held showed the six inflections
all taking the same road: `DISTANCE[inflection] = 0.30` → reach 0.69 → band
`large` → two big characters at the ends of the page. The quantity that
differs between 触｜る and 見｜えない — how much stands on either side of the
seam — reached the page nowhere.

**Rules (v1).** The unit is the **grapheme seat**, never the mora: an unread
kanji's two beats are a guess, and a guess must not become the size of a
character. One seat, one glyph, **every glyph the same size**. Only the
intervals vary:

| what the language gives | what opens |
| --- | --- |
| a seam inside one word | half a seat |
| a space the title writes | a whole seat |
| a seat the poem writes as space | the seat itself, left empty |

`pitch` and the glyph size are solved from the number of seats, not taken from
a band. The rest of the title keeps its own seat and is written smaller — no
annotation row beside the figure. No rotation. `whitePull` still places the
line; `distance` and `scaleRatio` take no part.

**Eligibility.** The seam becomes a line only where the line keeps something
the two poles cannot: **two or more seats on one side of the cut**, **a seat
the poem erases**, **a space the title writes**, or **the rest of the title in
the same reading**. Where a word is one character and one ending and nothing
else, the line says no more than the poles and says it smaller, so the poles
keep it. This is a general rule about structure, not a list of titles: it takes
美しい (1:2), 見えない (1:3, two erased), 花が咲く (erased + context), 白い 犬
(written space + context), and leaves 触る and 走れ to the poles.

**Effect on the series.** Pages with a mark over 0.36 of the page: 12 → 8.
AXIS pages with a mark leaving the page: 10 → 6.

見えない's large emptiness is the erased seats of ない holding their places. It
is explained, and is not to be rescued.

**Review.** `?compare=` accepts a place in the selection's own order (`#1`,
`#2`), and AXIS answers two review-only forces: `axis/joint` draws the line
even where the rule would not, `axis/poles` brings the two poles back. Neither
touches fitness or selection.

## AXIS — the rest of the title beside the poles, never on them

(Ported to `v2` from `242c642`, which was made on the older `510431c`.)
The row that keeps the rest of the title was set beside the first pole and
clamped only to the page's margin, so where the side away from the far pole
had no room the margin took it back onto the pole. On the current code this
still happened, in a different place than on `510431c`: with the two-pole
branch forced, 大きな犬 v5 (き・な on 犬・大) and 王と玉 v5 (the small 王 on
玉); 白い 犬 no longer did. Now, in the two-pole branch: the row is never
drawn on what the figure draws; away from the far pole first, the other side
of the same pole only while the reading runs along the axis; where neither
side holds it, the axis is drawn in the other outer third (the seed's
choice gives way; the poles' sizes and places along the axis do not move,
no random number is drawn anew). One change to the original: the figure is
tested on what each mark draws — the kept regions of a mark that keeps some,
nothing for one that keeps nothing — not on its whole glyph. The whole-glyph
box flagged pages whose row is clear (しずかに, ぽつぽつ, なぜ？, 春はあけぼの:
a voicing mark kept alone at macro size, or kept not at all) and would have
moved them. Over dev, holdout and probe, variants 0–7, selected / axis /
two-pole (2325 pages): exactly four change, 大きな犬 v5 and 王と玉 v5 under the
two forced ways; every selected page and v1 at variant 0 are identical.

## AXIS / containment — measured sizes

Where the title writes both characters of a containment (川または州, 日と白),
the axis used to give the residue the macro band and the part a fixed 0.3 of
it, whatever the reading said. Score 1.00 and 0.665, a remainder of 22% in
three crumbs and one of 28% in one bar, all came out as 0.21 : 0.71.

Now the ratio is solved from the reading: the part and the remainder carry the
same weight of ink, `s / S = √(share · density(outer) / density(inner))`. The
axis runs across the remainder's long side (a wide remainder stacks, a tall
one stands beside), and the pair is fitted inside the page. The measure is the
reading's; balancing the ink is a decision of form. `scale` from the reading
is not used: its search window bottoms out at 0.91 and three containments sit
exactly there, so it says only "about the same size".

## Visual language pass (v1)

The analysis was frozen; what changed is how the page writes what was read.
Measured on the development set, before → after this pass:

| | before | after |
| --- | --- | --- |
| pages whose largest mark is over 0.36 of the page | 13 | 7 |
| pages with ink leaving the page | 11 | 5 (a path running on, a field that begins off the page, a band of parts crossing it, the counter page) |
| reading-order breaks | 3 | 0 |
| overlapping marks | 3 | 0 |
| marks on the whole sheet | 171 | 469 |
| pages by their largest mark: micro / small / normal / large / macro | 3 / 9 / 9 / 8 / 5 | 7 / 9 / 11 / 5 / 2 |

**Two faces, by what a mark is.** A reading of ink — a residue, a part, a
term of a relation between letterforms, a character whose white holds the
rest — stays in the face it was read in (Noto Sans JP 500). The title written
as writing is Noto Serif JP 300. Not by meaning, not per title (poem/face.ts).

**The many are small.** A unit the poem multiplies is texture: fields and
bands are written between micro and small, and the count is what is seen. A
field thins out at its end in a fixed dither order.

**Relations between words are written small**: coordination, dependency, an
imperative, a stem and ending with nothing else — the distance does the work.
Two glyphs compared (a similarity) are written at an ordinary size, not
enlarged. Large and macro are left to a single character whose own ink is the
subject: its parts, its counters, what is left of it.

**Geometry from structure.** A band's copies step away from the edge as they
multiply (the page shows where in the title the repetition is). Scattered
words step through the page in reading order and each step turns a little
further (the turn per step is plastic). A radial part turns toward its ray by
how far it opened, and stays on the page. A periphery sits where the reading
begins. The rest of a title written inside a counter is placed where the white
actually has room, never on a stroke.

**Edges.** Poles are fitted inside the page; a smaller band is accepted
rather than a cropped pole.

## Generator v1 — frozen

From here the generator logic does not change for the look of a page. What
may still change is a failure that recurs across unseen titles: a crash, an
overlap, a lost character, a broken order, a pathological scale, a
convergence, a rendering fault.

Development set at the freeze (34 titles):

| composition / way | titles |
| --- | --- |
| 二極 default | 9 |
| 二極 joint | 4 |
| 帯 | 5 |
| 中心・周縁 | 4 |
| 片隅 | 3 |
| 格子 1×N / 2×2 | 2 / 1 |
| 入れ子 | 2 |
| 放射 · 経路 · 散在 · 場 | 1 each |

No unexplained loss, no overlap, no reading-order break, no dead page, no
nondeterminism. Pages by their largest mark: micro 7, small 9, normal 11,
large 5, macro 2. Contact sheets: `docs/research/contact/dev34-before.png` (before the
visual language pass) and `docs/research/contact/dev34-v1.png`.

## Holdout (v1)

47 titles written down before the freeze and never used for design
(`study/holdout.ts`), generated once after it. Contact sheet:
`docs/research/contact/holdout-v1.png`.

No unexplained loss, no reading-order break, no overlap, no error, no
nondeterminism. Two pages fall under the dead-page measure — ない and 見ない —
and both are what a negation leaves when it erases its own seats: the same
emptiness 見えない has in the development set, kept on purpose.

What the holdout shows about the generator as a whole, not changed in v1:

- Quiet pages are common (片隅 11 of 47): single characters that do not split
  into a band or a burst, and kana words with nothing repeated in them. The
  work allows a title with no strong feature to stay small.
- The joint line is frequent (9 of 47): any phrase whose inflected word has
  the rest of the title in the same reading line qualifies, so short verb
  phrases (風が吹く, 水を飲む, 今日は晴れ …) come out as similar vertical lines.
  Each shows its own seats and gaps, but the family resemblance is strong.
  The joint was frozen as it stands; this is left as a question for v2.
- A character whose closed white can hold the rest of the title (日, 国, 月)
  gives a page-sized glyph with the title written in its white (朝日, 国際空港,
  3月): large by necessity, since the white has to hold writing.

Distribution: 片隅 11, 二極 default 11, 二極 joint 9, 中心・周縁 6, 格子 3,
入れ子 2, 散在 2, 場 1, 経路 1, 空洞 1. Pages by their largest mark: micro 12,
small 17, normal 10, large 4, macro 4.

## v2 — mark grammars (branch `v2`)

v1 is kept as it was frozen (tag `v1`, branch `main`); on this branch it is
still what `compose()` returns when no grammar is named, identical to the mark.

**The layer.** A spatial composition decides where the title is held. A mark
grammar decides how its marks behave there. They are chosen apart, so one
composition can be written several ways. Marks now know which character of the
title they write, their role on the page (nucleus, body, context, satellite,
grain, trace) and, when the title does not write them itself, where they came
from (provenance: the grammar, and whether they repeat the title, echo a mark,
use a form read inside a character, or use the rest of the title).

**Material.** Small marks are never chosen for meaning and never borrowed. In
order: the title's content repetition; a form read inside the character (its
own parts read as a character — 森's 木 — or a character the title writes found
inside it above the reading threshold — 中 in 雨); the rest of the title in
reading order, only if it holds some content; what the poem erased; the
character itself.

**Five grammars.**

| grammar | where | what the page does |
| --- | --- | --- |
| attenuation | a silent beat (sokuon); an erased ending; a long run of copies | the next beat grows toward itself through the silent seat (a sokuon is the next consonant held early); an erased ending trails off as its last character's echo; a run dwindles |
| field | seats the poem erases; a page that is already a field | the erased characters stay as dust where their seats were; a field thins along its reading |
| silhouette | a nucleus that is a reading of ink, or the head a dependency hangs on | the nucleus's form drawn in small marks of the material (国 in 王の, 言 in 葉, あと in 海, 日 in 朝) |
| phase | a long run of copies | the run turns through one cycle along its order |
| orbit | two terms held apart as poles | symmetric (A と B, A ≈ B): each is ringed by the other; directed (stem ← ending, dependency): the dependent circles its head in a ring left open toward it |

**Where v1 and v2 live.** `compose()` with no grammar is v1, to the mark. The
public page and the review sheet write v2 (`grammar: 'auto'`); `?v=1` on either
gives the frozen v1 page for the same title.

**Selection (`auto`).** One grammar per page, decided by structure, with no
fitness and no contest: an erasure (silent beat → attenuation, anything else
→ field); a run of eight or more (field page → phase, otherwise attenuation);
a nucleus that is ink or a head (silhouette, if at least twelve grains and six
per nucleus mark fall on it; otherwise orbit where it applies); poles
(orbit); otherwise the page stays as v1. A corner page (片隅) stays quiet.

**Results.** Development set: 24 of 34 pages change; no loss, no
reading-order break, no overlap, no grain on the title's ink, no grain on a
grain; all 81 development and holdout titles generate identically twice. Pages by their largest mark: v1 micro 7 / small 9 /
normal 11 / large 5 / macro 2 → v2 micro 13 / small 9 / normal 11 / large 1 /
macro 0. Holdout (47, once): the same invariants hold; 22 titles take a
grammar. Contact sheets: `docs/research/contact/dev34-v2.png`, `docs/research/contact/holdout-v2.png`.

**Still weak.** Silhouettes share one texture (a square lattice of one grain
size), so several of them read as a family; orbits are circles; a quiet page
stays quiet; the joint line and the corner page are untouched.

Checkpoint: tag `v2a` (= `ccdc3df`), sheets `docs/research/contact/dev34-v2a.png`,
`docs/research/contact/holdout-v2a.png`.

## v2b — second generation (branch `v2`)

**Roles, as sizes.** A grammar says what each mark it adds is; the role, not
the grammar, says how large and how many (`grammar/roles.ts`): satellite —
the top of the micro band, few; grain — the bottom of it down to where a
character stops being one, many; trace — decays from what it follows to the
smallest grain; auxiliary — a little under a satellite, at most a few, for
what comes from outside the writing. Derived marks never reach the small
band. A derived mark below the micro band is written in the reading face:
the writing face's thin strokes fall under a pixel of the exported page there
(`face.ts`, `SMALLEST_WRITING`).

**Silhouette: four ways, chosen by the nucleus.** Stroke widths were
measured on both faces (distance transform of the ink, widths along the
middle of the strokes): the reading face varies little (coefficient of
variation 0.01–0.22), the writing face's kanji a lot (0.27–0.37); the line is
drawn at 0.25, between the faces, not per title.

| way | where | what the form does |
| --- | --- | --- |
| residue | the nucleus is what a subtraction left | the residue is filled with grains; the glyph taken out stays where it was as the smallest grains (a trace) — unless the page writes it in that place (a nest) |
| contour | the nucleus's closed white is the subject (the counter the page is about, or white holding a quarter of its box) | only the edge of the ink, a line of grains just off the strokes; twenty to twenty-four grains across the em so the line stands apart from itself |
| density | the nucleus is written in the writing face and its strokes vary (≥ 0.25) | one lattice; the grain under a point is as large as the stroke there is wide (from the smallest grain to twice it) |
| fill | otherwise | every lattice point on ink holds one size of grain (v2a) |

Forced over all 81 titles: fill 34, residue 7, density 5, contour 4. Under
auto on the development set: fill 5, residue 4, density 1, contour 1.

**Four grammars.**

| grammar | linguistic input | rule | auto |
| --- | --- | --- | --- |
| emanation | a nucleus and where its constituents lie (islands/parts in the glyph, or its marks as laid out) | one ray per constituent, in its direction; along a ray each mark smaller, further, turned with the ray; sound one more ray; meaning single marks furthest out. Only where the rays surround the nucleus (three at least, no half-turn empty) | no |
| branch | a grouping the title makes (coordinated terms, occurrences) and what each group is made of (its characters, or its islands of ink and what they read as) | each group grows as many branches as it has members, rows of small marks, all to the side with room; branches do not shrink — the count is compared | where the groups differ in count, before orbit |
| constellation | the kinds of material the title holds: structure, sound (reading reduced to vowels), meaning (review only) | structure and sound are discs of grains whose area is one share per character measured; they stand in the page's own white (largest empty circles), structure nearest the writing, sound further, meaning (a few marks round a ring) furthest | last, before uniform |
| lattice | a repetition laid in two grounded dimensions: a grid whose rows are the occurrences, or a field of lines of the title | a grid's rows are read again smaller cell by cell and go on in the room freed; a field's lines shrink one after another (from the middle for a mirror title), over the extent it covered | occurrence grids |

**Selection (`auto`), now.** Corner → quiet; erasure → attenuation / field;
run of eight → phase / attenuation; formed nucleus → silhouette (its way by
rule; illegible → branch or orbit); occurrence grid → lattice; groups that
differ → branch; poles → orbit; two kinds of material → constellation;
otherwise v1. Emanation is not selected (under review it was the reading
prolonged, not a new event); the lexicon is never selected.

**Semantic material (review only).** `src/language/lexicon/` holds a small
lexicon written for this work (`seed.ts`, seed-lexicon v0): categories of
single characters over whole fields (sky, light, water, land, plants,
animals, the body, people, dwellings, time, things, sound, a few actions) and
typed relations between them — made-of, part, unit (inside the thing), with,
organ (beside it at the same moment), source, becomes, yields (before or
after it); the other end of each is read too (whole, was, use), and those
and opposites are recorded but never taken. Material is taken nearest
relation first, one per head per pass, the page's nucleus first, at most
three, never a character the title writes or the structure already gives.
That order — inside (made-of, part, unit), then beside at the same moment
(with, organ), then before or after (source, becomes, yields) — is adopted as
the default of seed-lexicon v0; it is not fitted to any list of expected
characters. It is this work's rule, not a claim that meaning is ordered so in
general. seed-lexicon v0 (139 heads, 318 stated relations, 13 categories, 175
characters) is a prototype of a finite vocabulary the author defines for the
work, written partly with the development titles in view — not a general
resource for Japanese meaning.
No generated text, no model; the same title always gets the same few. It
enters only the grammars that place several materials (constellation,
emanation, branch), only as auxiliary marks, only when a review asks for it
(`Force.semantic`, `+sem` in `study.html?compare=`), and every mark records
the statement it came from (`Provenance.source`); the page never shows it.

**Review.** `study.html?compare=%231%2Bconstellation%2Bsem|%231%2Bsilhouette/contour`
— a grammar may name one of its ways; `+sem` lets the lexicon in.

**Results.** Development set: every page as before is lossless, in order,
without overlap, no grain on ink or on a grain; 81 titles × 8 ways generate
identically twice (648); v1 (`compose()` with no grammar) is unchanged to the
mark on both sets. Grammars in use on the development set: v2a 6 kinds
(uniform 10) → v2b 9 kinds (uniform 5: three corner pages, 白い 犬, なぜ？).
Holdout: 28 of 47 pages take a grammar (v2a: 22). Sheets:
`docs/research/contact/dev34-v2b.png`, `docs/research/contact/holdout-v2b.png`,
`docs/research/contact/v2b-grammars-compare.png`, `docs/research/contact/v2b-silhouette-ways.png`.

**Still weak.** Emanation almost never has room: its best case (森) bleeds off
the page. Constellation's discs are hexagonal rosettes of one grain size —
a second family texture. Branch reads the computer's island readings as they
are (林's left island reads 扌). Lattice finds grids and fields only. Density
needs a single nucleus that can grow to twice the smallest grain across
twenty-two grains; word nuclei stay fill.

## v2c — curation for a first public release

Nothing was added. The selection was narrowed so that a grammar fires only
where the page it makes is one decision, not the composition plus something
laid on it; a page where nothing fires is a result.

| rule | why | pages it changed (dev / holdout) |
| --- | --- | --- |
| constellation leaves auto (review only) | it was chosen only where nothing else was, so it added clusters to pages already whole; they read as tags | 美しい, 空をさがせ！ / 歩きながら, ない, 春はあけぼの |
| an orbit ring the page cuts below 60% of itself is not drawn | a ring in fragments reads as sparkle | 走れ / 書け |
| orbit only where the rings reach a quarter of the way across to the other pole | smaller, each pole is only haloed and the relation does not cross the page (ratio 0.16 on the halo pages, 0.30–0.54 on the others) | 1と2 / 手と足 |
| silhouette only where the form is made of something the title relates to it, and the title stays written beside it | a glyph drawn in itself, or a title dissolved entirely into grains, keeps no structure | 川 / 木と本 (now orbit) |
| branch only where at least half the branches are writing (what a part reads as) | where the parts read as nothing, the tree only counts islands: a diagram | 川または州 / 雪または霧, 王と玉 (now orbit) |

Tried and reverted: rings of two similar forms left open toward each other
(the difference between them). 大きな犬 improved; on every other page the
pole near the page edge lost its ring altogether, so the exchange was
broken.

Grammars in use under auto: development — v2b uniform 5 / 9 kinds → v2c
uniform 11 / 8 kinds; holdout — 28 → 22 of 47 take a grammar. Untouched:
silhouette's four ways, field and attenuation, phase, lattice, the orbit
shapes, every page listed as strong (王の国, 夜の位置, 海のあと, 見えない,
雨の中の雨, 国際空港, 朝日, 3月, 人々, 木と林と森). Sheets:
`docs/research/contact/dev34-v2c.png`, `docs/research/contact/holdout-v2c.png`,
`docs/research/contact/v2c-before-after.png`.

## v2d — semantic experiment (not adopted)

Question: can nearness in a space of meaning be a material of the visual
grammar — not a related word set beside the title?

**Sources.** symbolic (seed-lexicon v0) and two distributional tables,
distilled once and bundled (`src/language/semantic/data/`, NOTICE.md; build
scripts in `tools/semantic/`): **aozora** — character co-occurrence in 10,246
modern Aozora Bunko works (PPMI → SVD 300, fixed seed); **chive** — the
word2vec vectors of single-kanji words of chiVe v1.3 mc90. Candidates only
among the 3,000 most frequent kanji; never a character of the title or one
read as a part of it; heads only the characters that are whole words of the
title. Bands by rank (1–2 near, 3–8 distinct, 9–24 mid; counter: near one
head, absent from the others' neighbourhoods). Deterministic (68/68), no
network at composition.

**Placement.** Only into a place the page's grammar already has, at most two
marks: a near candidate becomes the grain at the centre of a grain texture;
a mid candidate one mark of the outermost orbit ring; a counter candidate one
smallest mark at the centre of the widest white. The hybrid choice avoids the
lexicon's explanatory relations (made-of, part, unit, organ), prefers what
both vector sources agree on, then rank. Comparison:
`docs/research/contact/v2d-semantic-compare.png` (v2c / symbolic / aozora / chiVe /
chosen, 17 titles; every column free of loss, order break, overlap, grain on
ink or grain).

**Result: not adopted; the published generator stays v2c.**
- One character of meaning inside a texture of the title's own characters
  reads as a misprint, not as structure: 宵 among the grains of 夜 (夜の位置).
  Two marks cannot make it structural, and more would make meaning the
  subject.
- Character neighbours become words where they touch the title's
  characters: a grain of 降 at the head of a row of 雨 reads 降雨. Character
  co-occurrence (aozora) is dominated by compound partners (驟雨, 薔薇, 昨夜);
  word vectors (chive) are semantic but generic, and noise for a character
  that is only part of a word (見, 咲, 位, 置).
- A counterpoint alone in the white reads as a stray mark or a gloss (雪 by
  中, 巨 by 太).
- Many titles have no head at all (見えない, 春はあけぼの, 朝日): meaning could
  never be a general property of the pages.

The tables and the pass stay as a review tool (`Force.semanticSource`,
`study.html?compare=%231%2Bauto%2Bhybrid`); nothing reaches the public page.

## VOID

`void.ts` is kept and is not a preferred choice. Its idea — a region that is
recorded as holding nothing — is wanted later as a primitive shared by GRID (an
empty cell), FIELD (a missing region) and PATH (an interruption), rather than
as a composition of its own.
