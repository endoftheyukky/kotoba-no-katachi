# Generator v2: local decisions (spec-1 stages 3–10)

spec-1 is the architecture. These are the local decisions its stages needed, with the reason for each. None
names a word; none was made to pass a benchmark case.

## Stage 3 — align-1

- **Glyphs are measured by v1's own code** (`glyph/metrics` measure, `glyph/parts` islands) in headless Chrome,
  in the bundled Noto Sans JP 500 (@fontsource, pinned by sha256). Another face, version or measure is a new table.
- **A component is placed as the glyph of its own code point** (氵 as 氵, 囗 as 囗). A code point the face lacks is
  `unavailable`; no other character stands in for it.
- **The fit is structure-driven and top-down**: a split operator (⿰⿲⿱⿳) tries each cut, each child is searched in
  its part only, and a cut is charged for the ink it runs through (the seam v1 reads between 偏 and 旁). Searching
  each component alone first let a large component spread over its neighbour while the small one shrank into a
  dense spot (the failure pre-v2 met with 氵).
- **Strokes**: a stroke glyph is the stroke drawn alone (丶 a dot, 丿 short), not its form in a character. Stroke
  rows are `approximate` by rule (`stroke-form`), and ink a stroke explains counts half in the joint fit.
- **Status is not existence**: `approximate` and `unavailable` never deny a component. Known misfits (about 1% of
  direct relations) are left as they are: `aligned` means "passed this system's own criteria", not ground truth.
- **Islands, alike groups, crossings** (added before Stage 4, rows unchanged): the repetition gates of §4.1 ask for
  n alike islands of ink, and an intersection has a point; stroke placements are approximate, so both are read
  from the whole glyph's own ink, not from placements.

## Stage 4 — Discovery

- **Candidates come from the structure alone**; ink never makes or unmakes a candidate. Ink enters only through
  gates, and only from an `aligned` placement: an approximate one fails the ink gate ("not observed").
- **Addition ink measures**: base size = max(sx, sy) (the unsqueezed axis; a 偏旁 squeezes one axis), distortion =
  1 − min/max, delta share = the residual's share, pieces = the residual's pieces. Side agrees when the residual's
  centroid lies beyond the base's centre on the IDS side (⿰⿱), inside the base's box for ⿻, never for a wrap.
- **Repetition**: read at the leaves first (雨 丶×4); "the whole less one leaf" only when the whole is the units and
  exactly one variant or character; stroke units twice are no candidate (§4.1); arrangement: 2×2, a line (row,
  stack) when one operator repeats, else the operator at the top (森, 品: ⿱).
- **Group geometry**: from the whole's alike islands when there are exactly n; else from placements, carried
  through a character seen through by transform composition (森's 木 inside 林).
- **A component's own repetition or crossing** (淋's 林 = 木×2, 辻's 十) is found as a nested Discovery and is never
  the primary; a secondary is a candidate that shares a term with the primary and passed its own gates.
- **Known deviation**: 琳's 𤣩 holds 26.8% of the ink, over ADDITION_MAX_DELTA_SHARE (0.25, provisional, TODO-4/5);
  the benchmark expects an addition. Left visible in the tests, not tuned away.

## Stage 5 — Semantic Resonance

- **Sources**: Japanese WordNet (L0, one or two typed links) and chiVe v1.3 mc90 (L1 percentiles, cleaned as for
  axes-1). No model at run time; nothing past L1 is ever written.
- **Character-origin data is not chosen (TODO-11)**: no origin, component-whole or lexical-candidate evidence, and
  so no F demotion yet (田・回 keep their enclosure until the source is chosen).
- **Schemas**: pre-v2's eleven fixed anchor sets (which avoid every benchmark character); L1 only for the two
  active pairs (enclosure × CONTAINER, character repetition × MULTITUDE) at percentile ≥ 90. L0 schema paths may
  reach a schema's nouns and its head noun (PATH: 道, CENTER: 中心 …).
- **Part-referent**: when the resource names a component of the whole as the unit (林 has-member 木), only those
  rows; else every has-part / has-member row (雨 has-part 雨滴).
- **The nine semantic axes** are not read by Discovery or Resonance; they stay an auxiliary whole-word quantity.

## Stage 6 — Constraints

- **§6's table, by the primary's type**, each constraint naming its Discovery (and the evidence it rests on).
  A title with no primary has no structural constraint; a title with nothing has no constraint at all, and that is
  kept as a result, not an error.
- **Gaps in §6, filled without a new architecture**:
  - partial_enclosure without a crossing (辺 迫 …: 34 of 35) gets extent(glyph): the wrapper is a form never
    written alone (R4), so the character itself carries the relation (GlyphItself, §7.2).
  - inter_containment (川 ⊂ 州) is an addition between two written characters (v1 relate: the outer is the inner
    and a residue): major(inner), difference(outer), boundary-side from the residue's centroid (else interleave),
    visibility(hidden). inter_similarity (人 ≈ 入): the same with interleave(1).
- **The words and the sound** (added constraint kinds `sequence`, `split`, `recurrence`): §7.2's Sequence names
  lexical and phonological Discoveries as its source but §6 gives them no constraint. They are auxiliary only: they
  never stand for a structure, and a structural primary is never replaced by them.
- **Evidence**: radical-meaning (L0) on the delta turns an addition's difference into a zone; part-referent (L0)
  and MULTITUDE (L1) are named as causes of a repetition's count; CONTAINER (L1) makes an enclosure's extent the
  page. Without evidence every constraint still stands.

## Stage 7 — SpatialPlan

- **§7.2's rules as a relational grammar**: each rule applies only when its required constraints are present and
  names the constraints it keeps and what it adds unasked (unmotivated). Selection is §7.3's order only.
- **The words never replace a structure**: Sequence is a candidate only where the title has no structural
  constraint. With a structural primary, the title's other graphemes (`rest`) stand beside the chosen plan in
  reading order; how they compose into one sequence is TODO-10 (Stage 10).
- **GlyphItself** also carries a partial enclosure without a crossing (wrapper-zone with extent(glyph)).
- **ScaleTransfer** is a candidate for character units only (stroke units carried to page scale are the diagrams
  pre-v2 met with 品 and 雨); WholeEmerges keeps more constraints and is the default (TODO-3), so ScaleTransfer is
  recorded as a candidate and not chosen.
- **Unmotivated in a candidate**: RegionSplit's band where the delta is a difference (no zone); Frame's ring of
  container units where the extent is the character (no page evidence).

## Stage 8 — FieldGeometry

- **Every property is set with its cause** (a constraint, evidence, a named constant, the auxiliary axes, or — on
  the fallback page only — `fallback`: nothing was found). A property set without one is unmotivated; the chosen
  geometry has none. The whole frame, dense, is kept as §8.3's comparison candidate and always loses.
- **Minimum carrier, by rule**:
  - a difference (FieldSingleton, FieldInterleave): the smallest grid in the base's frame whose count is in the
    hidden band (more than IMMEDIATE, at most ⌊√(IMMEDIATE × HIDDEN)⌋) with the delta reaching TAU; a field reads
    as one from three rows. The derived character stands at the edge on the delta's side, its base part on a unit.
  - a zone (RegionSplit): three along the band and the smallest field beside it (immediate).
  - an enclosure at page scale: a one-unit ring of the container on its closed sides, one unit of closed white,
    the smallest inner field (3 × 3), the whole at the interface (INTERFACE_SCALE) opposite the opening.
  - CrossRoads: 5 × 5 in the core's frame, roads empty, the whole at the crossing, the wrapper's zone white.
  - Separation: one mark per part (a 2 × 3 field of each is a candidate and loses), the seam SEAM_COEF × (1 +
    severance from axes-1, auxiliary and recorded as such).
  - WholeEmerges: n × groups units, groups = 2 × 2^(part-referent L0, MULTITUDE L1) — **a misreading of §8.2,
    corrected at Stage 9** (groups = n × 2^k). Two at least: the whole emerges among another group of its units. The field's pitch is the units' own pitch inside the whole (its nearest-
    neighbour distance), so the whole, at its size, stands with its units on the field's points (TODO-2 settled
    this way); the other units take the lattice points nearest the field's centre, clear of the whole's ink box;
    the field lies away from the whole's remainder (the whole closes where the remainder stands), else round it
    (TODO-1).
  - GlyphItself: one mark, GLYPH_ITSELF_SCALE of the frame (a stylistic constant).
  - Sequence: the title once along the writing direction, a half-unit break at each split; a character is at
    most SEQUENCE_MAX_UNIT of the frame (a stylistic constant).
  - Absent: the title once, FALLBACK_SPAN of the page, FALLBACK_OFFSET of the way from the centre toward the
    corner where reading ends (v1's pages that found nothing, §10; TODO-9).
- **The rest of a longer title** (TODO-10, Stage 10): the figure's frame gives way along the writing axis and the
  other graphemes are written once, in reading order, at the figure's unit size (same scale), before and after it.
- **Added constants** (spec.ts, versioned): GLYPH_ITSELF_SCALE 0.72, SEQUENCE_MAX_UNIT 0.16, FALLBACK_SPAN 0.16,
  FALLBACK_OFFSET 0.85. **Added types**: CauseRef `fallback`; FieldGeometry `detail` (what each rule's page is
  made of, so that Layout decides nothing).


## Stage 9 — Layout and the composition

The first evaluation pages (benchmark, controls, boundary, the 131 public titles; `tools/v2/eval.mjs`) were
looked at page by page. What they showed was fixed as rules of a type, never for a character; each rule below
names the failure it answers.

- **Layout decides nothing**: every position is FieldGeometry's (`detail.grid`, `points`, `parts`, `ring`,
  `interfaceAt`, `titleUnit`, lines). The page is v1's Draft: v1's renderers and invariants read it unchanged.
- **A title character keeps its own index**: a character of the relation is written with the title's own
  grapheme of that character (an inter-character relation lies across two). Where the field's unit is itself a
  title character (大 in 大と太), the field's first unit in reading order writes it and the others repeat it
  (*failure: the base of an inter-character relation was only grain, and was lost*).
- **The delta reaches TAU, whatever the band** (§8.2): the hidden band bounds the count; when no grid of the band
  keeps the delta at TAU, the field is the largest that does, and the visibility target is recorded as unmet.
  The delta is measured on the derived character as written (unit ÷ base scale for a singleton, the unit for an
  interleave); Stage 8 had multiplied where it should divide (*failure: deltas too small to see*).
- **A field's pitch is its unit's own ink** plus the gap UNIT_SPACING leaves (UNIT_SPACING − 1 of a unit), along
  each axis: 川 stands in close columns, 皿 wide, 一 in close rows (*failure: every field had the same square
  texture*). Rings and crossings keep square cells (two units, or a road, share them).
- **WholeEmerges** (*failure: the whole dominated a thin ring of units; 雨's units hit each other and the whole*):
  - groups = n × 2^k as §8.2 writes it (Stage 8 had 2 × 2^k; the same for n = 2, fewer for n > 2): 雨 32, 森 36, 品 9.
  - the lattice is the units' own arrangement in the whole, a pitch per axis (§9.1 "a unit keeps its place"): the
    smallest distance between unit centres along the axis (above a quarter of nn), else nn; never less than a
    unit's own ink. The road (§9.1) is kept by the unit's own ink box against the whole's, not by a constant.
- **Interface** (*failure: 闇, 囚 — the whole alone on the closed white read as a label*): the whole at
  INTERFACE_SCALE takes the contained unit at the contained field's face toward the container, on the side
  opposite the opening. The closed white between container and contained is now empty.
- **Separation** (*failure: 悲 — the parts at their size in the glyph, at the frame's scale, read as an exploded
  diagram*): each part is written as a character in its own right (the unsqueezed form, as §9.1 asks of
  character units), all at one measure — the measure of a character written as itself (SEQUENCE_MAX_UNIT) —
  in their order along the axis, the seam SEAM_COEF × (1 + severance) of the frame between them. The page holds
  isolated components, not a glyph taken apart for explanation.
- **One size for the title's characters on a page** (*failure: the rest of a longer title as tiny captions,
  and words written over the figure*): the rest is written at the figure's measure — its unit, or the whole
  where the units are strokes — at most SEQUENCE_MAX_UNIT; the figure gives way along the writing axis just as
  far as that needs (where the figure's measure and the room beside it cross); a half unit parts the words from
  the figure, as a split parts a line. A rest too long to fit even so is written at the room left. Provisional:
  how a figure stands in a line is TODO-10 (Stage 10, v1's trace, §9.3).
- **Sequence**: a reduplication (a recurrence of a token) parts its line at each return of its unit (ころ | ころ),
  the same half unit as a split. A recurrence the line does not show (an echo, a mirror, a voicing) is no longer
  counted as satisfied (*failure: a constraint claimed but not realised*).
- **Nothing found**: the title keeps the ink of a one-character title (its line's area FALLBACK_SPAN² of the
  page): a longer title is written longer, not smaller (*failure: long fallback titles shrank to a caption*).
- **Evaluation** (development only, never read by `src/`): v1's invariants (lost, overlap, inkHit, finite) on
  every page, plus `collide` (any two marks whose ink boxes share more than a tenth of the smaller: v1's overlap
  skips pairs of very different sizes). A stroke unit (the whole at its size, cut to one island) is checked by
  v1's inkHit as the mark its kept ink is; v1's code is unchanged.
- **Added types**: FieldGrid, FieldDetail `grid`, `titleUnit`, `interfaceAt.cell`; FieldProperty `pitch`,
  `titleUnit`. No constant added.


## Stage 10 — the runtime, a longer title, and the flow of a line

The evaluation pages were composed on the runtime path and looked at against Stage 9's (re-drawn from 7304a99
in the same browser). Every rule below is a rule of a type or of writing, never of a word; each names the
failure it answers.

- **RuntimeObservation** (§2, §11.3): a title reads only the shards of structure-1, align-1 and resonance-1 it
  can reach (its characters and their components, followed down); a shard not read throws when asked. The page
  from those shards equals the page from the whole tables for every public title and the benchmark, and Stage 9's
  pages are unchanged by the move (checked byte for byte). Nothing is built or recomputed at run time.
- **The flow of a line** (§9.3, v1's trace: its geometry, not its parameters; field/flow.ts). A line is walked
  one character a step, and each shape it takes names its constraint:
  - `line` (sequence); `stair` (a split inside a word: inflection, negation); `verse` (a split between words:
    relation word, coordination) — a new line from the head, but only where the lines still read as lines (the
    longest no shorter than the lines are wide); else `gap`, a half step of white along the one line (*failure:
    私 | の, 手 | と足 — lines of one character side by side read across, backwards in vertical writing*).
  - `return` (a reduplication): each repeat begins a line beside the unit it repeats (ころ | ころ; かえる ぴょこ
    | ぴょこ). Its members are the graphemes that repeat as v1 read them, not the whole word (*failure: the
    reduplication in かえるぴょこぴょこ was lost and the line bent instead*). A character doubled inside a longer
    word is not a word said again (ささやき, 特許許可): no return. A reduplication is never bent: bent upright, its
    repeat reads backwards.
  - `curve` (§9.3 v1 `turns`): (span ÷ line) × (k − 1) ÷ k turns spread over the steps; a mirror closes the
    line (1). Only a sound that comes back: the same mora with a sound of its own heard again after another
    (かなしいかな), a voicing, a mirror; not ー or っ (their sound is their neighbour's: コーヒー), not a mora
    doubled in place (ささ), not a vowel or onset alone; only on a line of three characters or more (*failure:
    curves on weak echoes, and on two characters where no curve can be seen*).
  - `wrap` (the page): where a line meets the end of its room it breaks at its last word's beginning (v1's
    tokens) or split inside a word, into even lines of two characters at least, no wider across than they are
    long; a line never opens on a closing symbol, a mark or a small kana (the character before goes down with
    it, else it hangs) (*failure: a long title's rest in one-character lines, which read as a row, backwards*).
- **A longer title** (TODO-10, §9.3: "the word's SpatialPlan is one item of the line"): the figure is the anchor
  and the rest continues from it, in one of two arrangements, the one that leaves the figure larger:
  - in the line: the runs before and after the figure along the writing, each from the character next to it in
    the figure; the figure as long as the runs still fit at the rest's size;
  - beside: where the figure's own characters stand together in the title, the words before it on the line before
    (above; right in vertical writing), the words after on the next (below; left), from the head of the page, as
    writing goes on when a line is full; the figure keeps the page's length and gives way across.
  The rest is written at the figure's unit — a character unit's size, or for stroke units the lattice cell a unit
  stands in — at most SEQUENCE_MAX_UNIT; smaller only where even the smallest figure leaves no room (*failure:
  written at the whole where the units were strokes, the words tied the figure to their own size: 私の影を踏まない
  でください！ had its figure at 1.4% of the frame at Stage 9, 雨 in 今日も明日も雨が降るでしょう 2%*).
- **Where the figure's unit is the title's character** (木と林と森, 川または州), the unit at that point writes it
  (`titleUnits`, points rather than cells, since a figure's units are not always on a grid).
- **Added types**: FieldDetail `flow`, `flows`, `titleUnits` (replacing `titleUnit`); flow behaviours `line`,
  `stair`, `verse`, `gap`, `return`, `curve`, `space`, `wrap`. No constant added.
- **Not settled here**: a long title whose figure is a field of small units writes its words small (the unit's
  size); the whole's size had made the figure small instead. Latin and digits in vertical writing are walked as
  any character (Good morning!). Both left visible in the evaluation, not tuned away.
