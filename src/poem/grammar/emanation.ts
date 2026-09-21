/**
 * 放射 — EMANATION (v2)
 *
 *   linguistic input  a nucleus, and where its constituents lie in it: the
 *                     parts the font already separates it into (森's three
 *                     木, each where it sits in the glyph), or, where the
 *                     nucleus is laid out as parts or as a word, where each of
 *                     its marks lies from their common centre. What the rays
 *                     are made of is the structural material of the page
 *                     (grammar/material.ts); where a part reads as a character,
 *                     its ray is made of that character.
 *   rule              one ray from the nucleus per constituent, in the
 *                     direction the constituent lies. Along a ray each mark is
 *                     smaller than the one before and further from it, and it
 *                     turns with the ray, its head away from the nucleus: the
 *                     ray is read outward. It ends where a mark would be
 *                     smaller than a grain, or at the page's edge. Where the
 *                     page has sound, its vowels go out as one more ray, in
 *                     the order they are read, set in the widest angle left
 *                     between the rays and beginning further out; meaning
 *                     (review only) is one mark for each character, further
 *                     out still: the further a material is from the writing,
 *                     the further from the nucleus it begins.
 *   visual output     a character giving off what it is made of.
 *
 * Needs directions that surround the nucleus: three constituents at least,
 * and no half-turn between them left empty. A nucleus whose constituents all
 * sit at its centre, or lie along one axis (a word laid along the reading),
 * has nothing to radiate: the grammar has nothing to act on.
 * Plastic: how fast a ray shrinks (0.84–0.9 per mark), how fast its spacing
 * opens. That the rays follow the constituents, and their number, are not.
 */
import { RELATION_TITLE } from '../../language/lexicon'
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { derive, free, GRAIN_MIN, within, type MarkGrammar } from './common'
import { partsRead, strandsOf, type Strand } from './material'
import { boxOf, fromEm, type PageView } from './page'
import { roleSize, ROLE } from './roles'

interface Ray {
  angle: number
  /** where the ray starts, from the centre */
  from: number
  chars: string[]
  source: (number | undefined)[]
  strand: Strand
  /** the part of the ray that is written */
  most: number
  role: 'satellite' | 'grain' | 'auxiliary'
  note: string
}

/** a constituent this far from the centre, as a share of the nucleus's reach, has a direction */
const OFF_CENTRE = 0.18

function centreOf(ks: Mark[]) {
  const bs = ks.map(boxOf)
  const x = (Math.min(...bs.map((b) => b.x0)) + Math.max(...bs.map((b) => b.x1))) / 2
  const y = (Math.min(...bs.map((b) => b.y0)) + Math.max(...bs.map((b) => b.y1))) / 2
  const reach = Math.max(...bs.map((b) => Math.max(Math.hypot(b.x0 - x, b.y0 - y), Math.hypot(b.x1 - x, b.y1 - y)))) * 0.82
  return { x, y, reach }
}

/** the directions of the nucleus's constituents, each with what its ray is made of */
function directions(v: PageView, structure: Strand): { angle: number; char: string | null; note: string }[] {
  const c = centreOf(v.nucleus)
  // laid out already: each mark where it lies
  if (v.nucleus.length >= 2) {
    const ds = v.nucleus.map((k) => ({ k, d: Math.hypot(k.x - c.x, k.y - c.y) }))
    if (ds.every(({ d }) => d >= OFF_CENTRE * c.reach))
      return ds.map(({ k }) => ({ angle: Math.atan2(k.y - c.y, k.x - c.x), char: null, note: `核の「${k.char}」のある向き` }))
    return []
  }
  // one mark: its parts, where they sit in the glyph
  const k = v.nucleus[0]
  if (k.grapheme === undefined || k.keep?.length || k.minus) return []
  const parts = partsRead(v, k.grapheme)
  const at = parts.map(({ part, char }) => {
    const p = fromEm(k, part.centroid)
    return { angle: Math.atan2(p.y - k.y, p.x - k.x), d: Math.hypot(p.x - k.x, p.y - k.y), char }
  })
  if (at.length < 2 || at.some(({ d }) => d < OFF_CENTRE * c.reach)) return []
  void structure
  return at.map(({ angle, char }) => ({ angle, char, note: `「${k.char}」の部品のある向き${char ? `（「${char}」と読める）` : ''}` }))
}

/**
 * Rays that radiate, not a line: three at least, and no half-turn left
 * empty between them. A word laid along the reading gives two directions on
 * one axis — that is the reading prolonged, which attenuation already is.
 */
function surrounds(angles: number[]): boolean {
  if (angles.length < 3) return false
  const a = [...angles].sort((p, q) => p - q)
  const gaps = a.map((x, i) => (i + 1 < a.length ? a[i + 1] : a[0] + 2 * Math.PI) - x)
  return Math.max(...gaps) < Math.PI * 1.1
}

function rays(v: PageView): Ray[] {
  if (!v.nucleus.length) return []
  const strands = strandsOf(v, v.nucleus)
  const structure = strands[0]
  const dirs = directions(v, structure)
  if (!surrounds(dirs.map((d) => d.angle))) return []
  const c = centreOf(v.nucleus)
  const out: Ray[] = dirs.map((d, i) => ({
    angle: d.angle,
    from: c.reach,
    chars: d.char ? [d.char] : [structure.chars[i % structure.chars.length]],
    source: d.char ? [v.nucleus[0].grapheme] : [structure.from[i % structure.from.length]],
    strand: structure,
    most: Infinity,
    role: 'satellite',
    note: `${d.note}へ、${d.char ? `「${d.char}」` : structure.note}が放たれる`,
  }))
  // the widest angle left between the rays already set
  const widest = () => {
    const angles = out.map((r) => r.angle).sort((p, q) => p - q)
    let best = 0
    let at = 0
    angles.forEach((a0, j) => {
      const a1 = j + 1 < angles.length ? angles[j + 1] : angles[0] + 2 * Math.PI
      if (a1 - a0 > best) {
        best = a1 - a0
        at = a0 + (a1 - a0) / 2
      }
    })
    return at
  }
  // sound: one ray, the vowels in the order they are read, starting further out
  // meaning: one mark for each character, furthest out of all
  for (const s of strands.slice(1)) {
    if (s.layer === 'sound')
      out.push({
        angle: widest(),
        from: c.reach * 1.3,
        chars: s.chars,
        source: s.from,
        strand: s,
        most: s.chars.length,
        role: 'satellite',
        note: `${s.note}が一本の光線になる`,
      })
    else
      s.chars.forEach((ch, i) =>
        out.push({
          angle: widest(),
          from: c.reach * 1.75,
          chars: [ch],
          source: [s.from[i]],
          strand: s,
          most: 1,
          role: 'auxiliary',
          note: `「${s.items![i].head}」の${RELATION_TITLE[s.items![i].relation]}「${ch}」（語彙）`,
        }),
      )
  }
  return out
}

export const emanation: MarkGrammar = {
  id: 'emanation',
  title: '放射',
  rules: [
    '核から、その構成要素ごとに一本の光線が出る：フォントが字を分けている部品それぞれの、字の中での向きへ（森なら三つの木のある三方向）。核が部品や語として並べられているときは、それぞれの字のある向きへ',
    '光線は、部品が字として読めればその字で、読めなければ紙面の構造の材料でできる。一本の上で字は一つごとに小さく、間隔は開き、光線とともに向きを変える（字の頭は核の外を向く：光線は外へ読まれる）。粒より小さくなるところ、または紙面の端で終わる',
    '音（読みの母音）は、光線の間に残る最も広い角に、読みの順のまま一本の光線として出る。レビュー時の語彙の材料は、一字ずつ、その次に広い角の最も遠いところに一つだけ。書かれたものから遠い材料ほど、核から遠くで始まる',
    '光線は核を囲むときだけ：構成要素が三つ以上あり、その向きの間に半周以上の空きがないこと。構成要素が核の中心にあるか、一つの軸に並ぶだけ（読みの向きに置かれた語）なら、それは読みの延長であって放射ではない：働かない',
    '縮む速さ（一つごとに0.84〜0.9）と間隔の開き方は造形。光線の数と向きは造形ではない',
  ],

  offer(v) {
    const rs = rays(v)
    if (!rs.length) return null
    return {
      grounds: [`核「${v.nucleus.map((k) => k.char).join('')}」から${rs.filter((r) => r.strand.layer === 'structure').length}本の光線`, ...rs.map((r) => r.note)],
      uses: [
        { property: 'rays', value: `${rs.filter((r) => r.strand.layer === 'structure').length}` },
        ...rs.filter((r) => r.strand.layer !== 'structure').map((r) => ({ property: r.strand.layer, value: r.chars.join('') })),
      ],
    }
  },

  apply(v, rng) {
    const rs = rays(v)
    if (!rs.length) return v.marks
    const c = centreOf(v.nucleus)
    const q = within(rng, 0.84, 0.9)
    const open = within(rng, 0.1, 0.18)
    const added: Mark[] = []
    const margin = PAGE * 0.02
    for (const r of rs) {
      const role = r.role
      // the first mark of a ray: a satellite, never more than a third of the nucleus
      const top = Math.max(ROLE.satellite.size[0] * PAGE, Math.min(ROLE.satellite.size[1] * PAGE, Math.max(...v.nucleus.map((k) => k.size)) / 3))
      let s = role === 'auxiliary' ? roleSize('auxiliary', 1, PAGE) : r.strand.layer === 'sound' ? roleSize('satellite', 0.3, PAGE) : top
      let d = r.from + s * 0.7
      let n = 0
      for (let i = 0; n < r.most && s >= GRAIN_MIN * PAGE; i++) {
        const x = c.x + Math.cos(r.angle) * d
        const y = c.y + Math.sin(r.angle) * d
        if (x < margin + s / 2 || y < margin + s / 2 || x > PAGE - margin - s / 2 || y > PAGE - margin - s / 2) break
        if (free(v, v.marks, added, x, y, s * 1.05)) {
          const rotate = ((((r.angle * 180) / Math.PI + 90) % 360) + 540) % 360 - 180
          added.push({
            char: r.chars[i % r.chars.length],
            x,
            y,
            size: s,
            ...(Math.abs(rotate) > 0.5 ? { rotate } : {}),
            role: role === 'satellite' && s < ROLE.satellite.size[0] * PAGE ? 'grain' : role,
            derived: derive(
              'emanation',
              r.strand.kind,
              r.note,
              r.source[i % r.source.length],
              r.strand.source?.[r.strand.chars.indexOf(r.chars[i % r.chars.length])],
            ),
          })
          n++
        }
        const next = s * q
        d += ((s + next) / 2) * (1.12 + open * i)
        s = next
      }
    }
    return [...v.marks, ...added]
  },
}
