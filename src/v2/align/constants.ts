/**
 * align-1: the constants of the fit (spec-1 §2.1 ink, §16 Stage 3). Each says
 * what it is and where its value comes from; all are written into the
 * manifest, so that another value is another table.
 */
export const ALIGN = {
  /** the smallest and largest scale of a component's own ink box, per axis (anisotropic) */
  SCALE_MIN: { value: 0.15, source: 'full run of the split fit, fits with lift ≥ 0.9 and precision ≥ 0.95: characters sx 0.20–1.08, sy 0.18–1.05 (p0.5–p99.5), a radical form down to 0.23 (木 in 械); below 0.15 a component is a dense spot, not itself' },
  SCALE_MAX: { value: 1.3, source: 'the same run: variants and components drawn small on their own reach 1.24–1.29 (冫 in 翠, ⺝ in 育); a fit at a limit is approximate (at-scale-limit)' },
  /** the largest ratio between the two axes' scales (a component squeezed one way only) */
  ASPECT_MAX: { value: 4, source: 'the same run: aspect p99 3.9 among good fits, all radical forms squeezed one way (木 in 桐 0.25/0.93, 心 in 忠 1.0/0.31)' },
  /** how far a child's box may lie outside its parent's region, per side (share of the region's side) */
  SLACK: { value: 0.06, source: 'Noto Sans JP 500: a component overhangs its nominal region by a stroke or less' },
  /** side by side / stacked: where the parent may be cut between two children (shares of the parent along the axis) */
  SPLITS: { value: [0.2, 0.275, 0.35, 0.425, 0.5, 0.575, 0.65, 0.725, 0.8], source: 'the unequal splits of the benchmark (氵|林 about 0.3|0.7); nine cuts, every 7.5% of the side' },
  /** the same for a split inside a component (one level down), and deeper */
  SPLITS_NESTED: { value: [0.2, 0.35, 0.5, 0.65, 0.8], source: 'a split inside a component: five cuts, every 15%' },
  SPLITS_DEEP: { value: [0.25, 0.5, 0.75], source: 'two levels down and deeper: three cuts' },
  /** three children side by side / stacked: the smallest share of the parent between two cuts */
  SPLIT_MIN_PART: { value: 0.15, source: 'a middle component takes at least a stroke and its gaps' },
  /** how far a child may overhang the cut into its neighbour's part (share of the parent) */
  SPLIT_MARGIN: { value: 0.08, source: 'Noto Sans JP 500: neighbouring components interlock by about a stroke' },
  /** how far a stroke may cross the cut (strokes an IDS splits meet where they join) */
  SPLIT_MARGIN_STROKE: { value: 0.25, source: '厂 = ⿱一丿: the 丿 begins at the end of the 一' },
  /** the first (last) child of the character's own split starts (ends) within this share of the whole's ink box (a wrapper reaches its sides) */
  ANCHOR: { value: 0.2, source: 'a split fills its region: its outer children reach its edges' },
  /** an enclosing component that is a glyph spans at least this share of its region, per axis */
  WRAPPER_MIN: { value: 0.5, source: 'the wrapper spans the character (門 in 闇, 囗 in 囚, 辶 in 辻)' },
  /** an enclosed child keeps this share of the region away from the closed sides */
  INSET: { value: 0.1, source: 'the wall of the enclosure: about one stroke' },
  /** an enclosed child of ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ starts at least this share in from the wrapping sides */
  INNER_FROM: { value: 0.15, source: 'the wrapping stroke and its gap' },
  /** a whole's ink cell counts as explained within this distance of a placed component's ink (em) */
  TOLERANCE: { value: 1.5, source: 'one 1 em cell and its diagonal (v1 relate reads with one cell of tolerance)' },
  /** the first look: twice COARSE_STEP, every fourth ink cell, and this tolerance (em) */
  FIRST_TOLERANCE: { value: 5, source: 'a looser eye for a step of 8 em' },
  /** the coarse pass: step of the box search and its tolerance (em) */
  COARSE_STEP: { value: 4, source: 'half a stroke of Noto Sans JP 500 at EM = 100' },
  COARSE_TOLERANCE: { value: 3, source: 'the first pass looks with a looser eye than its step' },
  /** ink placed off the whole's ink costs this many times the ink placed on it */
  OFF_COST: { value: 3, source: 'a placement is worth keeping only when most of it lands on ink' },
  /** what a cell of ink a stroke explains is worth to the joint fit (a component's: 1) */
  STROKE_WEIGHT: { value: 0.5, source: 'a stroke glyph fits almost any ink: in 作, opened into strokes, a stroke took the ink of 亻 at full worth' },
  /** what a cut costs for each of the whole's ink cells it runs through (a split runs along the seam) */
  SEAM_COST: { value: 2, source: 'v1 glyph/metrics seam: 偏 and 旁 part where the ink is thinnest; in 換 a cut through 扌 let 冂 take its stroke' },
  /** two children claiming the same ink: each shared cell costs this much (not under ⿻) */
  OVERLAP_COST: { value: 1, source: 'shared ink is explained once' },
  /** the coarse pass's best boxes (a step apart from each other) climbed further */
  SEEDS: { value: 12, source: 'enough to hold every distinct place a component could take in its region' },
  /** sweeps of searching each component again with the others held still */
  RECONSIDER: { value: 2, source: 'a second sweep settles what the first one moved' },
  /** candidates kept per component in each region, and solutions kept per node, for the joint fit */
  CANDIDATES: { value: 6, source: 'enough for the joint fit to prefer a spanning placement to a dense spot' },
  /** lift's chance is read in the placed box grown by this (em) on every side */
  LIFT_MARGIN: { value: 4, source: 'half a stroke: the white next to a stroke is where chance would put it' },
  /** aligned, not approximate: at least this share of the placed glyph on the whole's ink */
  PRECISION_MIN: { value: 0.85, source: 'the p1 of precision among direct placements (0.84): below it a placement lies visibly off the ink' },
  /** aligned, not approximate: at least this far beyond chance (v1 relate RELATION_THRESHOLD is 0.65) */
  LIFT_MIN: { value: 0.65, source: 'v1 src/glyph/relation.ts RELATION_THRESHOLD' },
  /** a rival placement: one that costs the joint fit less than this share of what the component explains (ambiguity 1 − cost ÷ span) */
  AMBIGUITY_SPAN: { value: 0.5, source: 'a place that loses half of the ink the component explains is no rival to it' },
  /** aligned, not approximate: ambiguity at most this (a rival costs at least a quarter of the component's ink) */
  AMBIGUITY_MAX: { value: 0.5, source: 'the midpoint of the span: aligned when the best rival costs at least a quarter of the ink' },
  /** alike islands: shapes on a 16 × 16 grid over each island's box at least this alike (IoU) */
  ALIKE_SHAPE: { value: 0.55, source: 'the pre-v2 reading of alike islands (雨: four dots, 森: three 木)' },
  /** alike islands: shares of the ink within this share of the larger */
  ALIKE_SHARE: { value: 0.5, source: 'the pre-v2 reading of alike islands' },
  /** a crossing: both runs of ink at least this share of the ink box */
  CROSS_RUN: { value: 0.35, source: 'the pre-v2 reading of crossings (十, 辻)' },
  /** a crossing: each run reaching at least this share of the ink box on both sides of the cell */
  CROSS_ARM: { value: 0.12, source: 'the pre-v2 reading of crossings: straight through, not a corner or a T' },
  /** crossing cells within this distance (em) are one crossing */
  CROSS_JOIN: { value: 10, source: 'about a stroke and its edge' },
  /** a residual piece smaller than this share of the whole's ink is a sliver, not a form (v1 glyph/relation SLIVER) */
  SLIVER: { value: 0.03, source: 'v1 src/glyph/relation.ts' },
} as const

export type AlignConstName = keyof typeof ALIGN
export const A = <K extends AlignConstName>(k: K): (typeof ALIGN)[K]['value'] => ALIGN[k].value
