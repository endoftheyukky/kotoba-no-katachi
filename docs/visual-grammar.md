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

## VOID

`void.ts` is kept and is not a preferred choice. Its idea — a region that is
recorded as holding nothing — is wanted later as a primitive shared by GRID (an
empty cell), FIELD (a missing region) and PATH (an interruption), rather than
as a composition of its own.
