/**
 * 位相 — PROGRESSIVE PHASE (v2)
 *
 *   linguistic input  the order in which the title's own marks are read.
 *   rule              each mark turns about its own centre by an angle that
 *                     grows with its place in the reading: the first stands,
 *                     the next turns a little, the next a little more. A short
 *                     sequence turns by a fixed step; a long run of repeated
 *                     marks (a band, a field) turns through one whole cycle
 *                     over its length, so the repetition has a phase.
 *                     Residues, parts and the rest of the title beside a figure
 *                     do not turn: their geometry is the relation itself.
 *   visual output     a sequence in which each character has its own local
 *                     change, not a line that bends as a whole.
 *
 * The step for a short sequence (10–16°) and its sense are plastic. That it
 * grows with the order is not.
 */
import type { Mark } from '../types'
import { within, type MarkGrammar } from './common'
import type { PageView } from './page'

function sequence(v: PageView): Mark[] {
  return v.body.filter((k) => !k.keep && !k.minus)
}

export const phase: MarkGrammar = {
  id: 'phase',
  title: '位相',
  rules: [
    '各字は、読みの順での位置に比例した角度だけ、自分の中心で回る：最初は立ち、次は少し、その次はもう少し',
    '四字以上の列に限る（二、三字の回転は向きの違いにしか見えない）。短い列は一定の刻みで回る。反復の長い並び（帯・場）は、その長さ全体で一周する：反復に位相が生まれる',
    '残り・部品・図の脇の文脈は回らない：その形そのものが関係だから',
    '短い列の刻み（10〜16°）と向きは造形。順に比例して増えることは造形ではない',
  ],

  offer(v) {
    const seq = sequence(v)
    if (seq.length < 4) return null
    return {
      grounds: [`${seq.length}字が読みの順に並ぶ → 順番に比例して回る`],
      uses: [{ property: 'sequence', value: `${seq.length}` }],
    }
  },

  apply(v, rng) {
    const seq = sequence(v)
    if (seq.length < 4) return v.marks
    const sense = rng.next() < 0.5 ? -1 : 1
    const step = seq.length > 12 ? 360 / seq.length : within(rng, 10, 16)
    const turn = new Map(seq.map((k, i) => [k, sense * i * step]))
    return v.marks.map((k) => {
      const t = turn.get(k)
      if (!t) return k
      const rotate = (((k.rotate ?? 0) + t + 540) % 360) - 180
      return { ...k, rotate: rotate || undefined }
    })
  },
}
