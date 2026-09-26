# Generator v2: local decisions (spec-1 stages 3–9)

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
  - WholeEmerges: n × groups units, groups = 2 × 2^(part-referent L0, MULTITUDE L1). Two at least: the whole emerges
    among another group of its units. The field's pitch is the units' own pitch inside the whole (its nearest-
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

