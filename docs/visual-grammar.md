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

## VOID

`void.ts` is kept and is not a preferred choice. Its idea — a region that is
recorded as holding nothing — is wanted later as a primitive shared by GRID (an
empty cell), FIELD (a missing region) and PATH (an interruption), rather than
as a composition of its own.
