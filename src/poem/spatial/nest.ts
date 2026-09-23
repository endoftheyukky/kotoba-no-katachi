/**
 * 入れ子 — NEST / CONTAINMENT
 *
 * When the computer reads one letterform inside another, the poem has so far
 * shown it by pulling the two apart (二極) or by giving the page to what was
 * left (中心・周縁). Neither draws the relation itself: a thing that is inside
 * another has never been put inside it.
 *
 * Here it is. The outer character is written to hold most of the page, with
 * the inner one taken out of it, so that its own ink leaves a hole exactly where
 * the reading found the inner form; and the inner is written small, inside
 * that hole, where it was found. Nothing is invented for the placement: the
 * reading already carries where the inner sits in the outer's em space and at
 * what scale (p = q·scale + (dx, dy)).
 *
 * What is left of the outer is not a third term set beside them — it is the
 * outer, in its place, being what surrounds. So the residue is never drawn
 * apart. The rest of the title is another matter: it is kept, on the line of
 * the reading, unless the poem writes it as space (poem/context.ts).
 *
 * v1 takes only containment read between letterforms. A counter — the white a
 * character's own strokes close in — is also an inside, and 中心・周縁 already
 * puts the title into it; the two can be brought together later.
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import { layContext, MIN_READABLE } from '../context'
import type { Mark, Realization, SpatialComposition, Unit } from '../types'
import { allUnits, isWritten } from './common'

/** how much smaller than the hole the inner form is written, so that it is in it */
const SHRINK = 0.45
/**
 * The outer holds most of the page, not all of it: a container is read by
 * its edge, and the white around it is what makes it one. The rest of the
 * title then has room beside it instead of being written over it.
 */
const OUTER = 0.68
/** below this share the outer has no body left to be an outside */
const BODY_MIN = 0.12
const BODY_FULL = 0.32

function held(m: { tokens: Unit[][] }, char: string): Unit | undefined {
  return m.tokens.flat().find((u) => u.char === char && isWritten(u))
}

export const nest: SpatialComposition = {
  id: 'nest',
  title: '入れ子',
  accepts: ['pair'],
  // the outer holds the page; nothing here needs to leave it
  bleed: false,
  rules: [
    '字の中に字が読まれたとき、内にあるものを、実際に内側に置く：引き離しも、残りを中心に据えることもしない',
    '外の字は紙面の大半を占める大きさで書かれ、そのインクからは内の字が抜かれる：穴は、読みが内の字を見つけた場所そのものである。周りの白が、外を外として読ませる',
    '内の字は、その穴の中に、見つかった位置と縮尺で、穴より小さく書かれる（p = q·scale + (dx, dy) は読みがすでに持っている）',
    '引いた残りは第三項として外に出さない：残りは「外にあるもの」そのものであって、並べて見せる別の項ではない',
    '外が体として残らない読み（残りが少なすぎる、粒に砕けている）は、内と外の関係を作れない：適合しない',
    '題の残りの字は消えない。欠落操作が明示的に空白にしたもの以外は、読みの線に席のまま残る',
  ],

  offer(_a, m) {
    const f = m.primary.focus
    if (f.kind !== 'pair' || f.relation.kind !== 'containment') return []
    // a voiced kana and the plain one it decomposes into are the same ink:
    // there is no outside left to be inside of
    if (f.voicing) return []
    const r = f.relation
    const outer = held(m, r.outer)
    if (!outer) return []

    // what must still be there for an inside to have an outside
    const body = clamp((r.residue.share - BODY_MIN) / (BODY_FULL - BODY_MIN))
    const fitness = r.score * body * r.residue.substance
    const size = OUTER * PAGE
    const inner = r.scale * size * SHRINK
    const realization: Realization = {
      id: 'nest',
      mode: 'nested',
      uses: [
        { property: 'containment', value: `${r.inner}⊂${r.outer} ${r.score.toFixed(2)}` },
        { property: 'residue.share', value: `${(r.residue.share * 100).toFixed(0)}%` },
        { property: 'residue.substance', value: `${(r.residue.substance * 100).toFixed(0)}%` },
        { property: 'position', value: `dx ${r.dx.toFixed(0)} dy ${r.dy.toFixed(0)} ×${r.scale.toFixed(2)}` },
      ],
      grounds: [
        `「${r.inner}」は「${r.outer}」の中にある → 内にあるものを、見つかった場所で、実際に内側に置く`,
        r.residue.share >= BODY_FULL
          ? `引いた残りは${(r.residue.share * 100).toFixed(0)}%：外は十分に体として残る`
          : `引いた残りは${(r.residue.share * 100).toFixed(0)}%：外として残るものが薄い`,
      ],
      fitness,
      realisable: inner >= MIN_READABLE * PAGE && r.residue.share > BODY_MIN,
      demand: { reach: OUTER, spread: 'mass', minSize: inner / PAGE, depth: 1 },
    }
    return [realization]
  },

  fit(a, m) {
    const [r] = this.offer!(a, m)
    return r && r.realisable ? { id: 'nest', score: r.fitness, grounds: r.grounds } : null
  },

  realize(a, m, rng, _scale) {
    const f = m.primary.focus
    if (f.kind !== 'pair') return { marks: [] }
    const r = f.relation
    const outer = held(m, r.outer)!
    const size = OUTER * PAGE
    // 造形: the outer sits a little off the middle of the page
    const at = { x: PAGE / 2 + rng.range(-0.03, 0.03) * PAGE, y: PAGE / 2 + rng.range(-0.03, 0.03) * PAGE }
    const minus = { char: r.inner, dx: r.dx, dy: r.dy, scale: r.scale, keep: r.residue.pieces }
    const marks: Mark[] = [{ char: outer.char, grapheme: outer.grapheme, x: at.x, y: at.y, size, minus, keep: r.residue.pieces }]

    // the inner, in the hole it left, smaller than the hole
    const k = size / EM
    const inner = r.scale * size * SHRINK
    const held2 = allUnits(m).find((u) => u.char === r.inner && isWritten(u) && u.grapheme !== outer.grapheme)
    marks.push({ char: r.inner, ...(held2 ? { grapheme: held2.grapheme } : {}), x: at.x + r.dx * k, y: at.y + r.dy * k, size: inner })

    const placed = [{ grapheme: outer.grapheme, x: at.x, y: at.y, size }]
    if (held2) placed.push({ grapheme: held2.grapheme, x: at.x + r.dx * k, y: at.y + r.dy * k, size: inner })
    const context = layContext(a, m, placed, PAGE)
    if (context) marks.push(...context.marks)
    return { marks, contract: undefined, parameters: undefined }
  },
}
