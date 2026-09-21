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
large 5, macro 2. Contact sheets: `docs/contact/dev34-before.png` (before the
visual language pass) and `docs/contact/dev34-v1.png`.

## Holdout (v1)

47 titles written down before the freeze and never used for design
(`study/holdout.ts`), generated once after it. Contact sheet:
`docs/contact/holdout-v1.png`.

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

## VOID

`void.ts` is kept and is not a preferred choice. Its idea — a region that is
recorded as holding nothing — is wanted later as a primitive shared by GRID (an
empty cell), FIELD (a missing region) and PATH (an interruption), rather than
as a composition of its own.
