/**
 * 分岐 — BRANCH (v2)
 *
 *   linguistic input  a structure of two levels the title itself measures.
 *                     The first level is a grouping of the title: the terms
 *                     it coordinates (木 と 林 と 森), or the occurrences of a
 *                     unit it repeats (ころ|ころ, 雨 … 雨). The second level is
 *                     what each group is made of: its characters, where it has
 *                     more than one; or, where it is one character, the
 *                     islands of ink the font already separates it into —
 *                     never a cut the computer makes — each as what it reads
 *                     as (森: 木, 木, and a part that reads as nothing, which
 *                     stays 森).
 *   rule              each group is an origin; from it grow as many branches
 *                     as it has members at the second level, one row of small
 *                     marks each, written in the member's character. All
 *                     branches grow to one side of the writing — the side the
 *                     page has room on — fanned about the perpendicular to the
 *                     reading. The branches do not shrink: what is compared is
 *                     how many there are, group by group.
 *                     Meaning (review only) is at most one mark at the tip of
 *                     a branch, the branch of the head it was read from.
 *   visual output     a tree the title draws of itself: 木 one branch, 林
 *                     two, 森 three.
 *
 * Needs both levels: at least two groups, and at least one group with two
 * members or more. Groups laid on top of each other (a nest) are not origins.
 * Plastic: a branch's length (four to six marks), the fan's opening. The
 * number of branches, and where they grow from, are not.
 */
import { PAGE } from '../../render/stage'
import { covers } from '../../glyph/coverage'
import { isRelationWord } from '../salience'
import type { Mark } from '../types'
import { derive, free, within, type MarkGrammar } from './common'
import { meaningOf, partsRead } from './material'
import type { PageView } from './page'
import { roleSize } from './roles'

interface Member {
  char: string
  from: number | undefined
  note: string
  /** the branch is writing: a character of the group, or what its part reads as — not the group's own glyph standing in for a part that reads as nothing */
  read: boolean
}
interface Group {
  marks: Mark[]
  x: number
  y: number
  members: Member[]
  note: string
}

/** origins must stand at least this far apart (share of the page) to grow apart */
const APART = 0.12

function groups(v: PageView): Group[] {
  const { a } = v
  let sets: number[][] = []
  let why = ''
  const coord = a.relations.filter((r) => r.kind === 'coordination')
  if (coord.length) {
    const tokens = [...new Set(coord.flatMap((r) => (r.kind === 'coordination' ? [r.left, r.right] : [])))].sort((p, q) => p - q)
    sets = tokens.map((t) => {
      const tk = a.tokens[t]
      return Array.from({ length: tk.end - tk.start }, (_, i) => tk.start + i)
    })
    why = '並べられた項'
  } else {
    const f = v.m.primary.focus
    const red = a.relations.find((r) => r.kind === 'reduplication')
    const rec = a.relations.find((r) => r.kind === 'recurrence' && r.unit === 'grapheme' && !isRelationWord(a, r.members[0]))
    if (f.kind === 'repetition' && f.occurrences.length >= 2 && !f.sound) sets = f.occurrences
    else if (red?.kind === 'reduplication') sets = red.occurrences
    else if (rec?.kind === 'recurrence') sets = rec.members.map((g) => [g])
    why = '繰り返しの出現'
  }
  if (sets.length < 2) return []
  const out: Group[] = []
  for (const set of sets) {
    const written = set.filter((g) => a.graphemes[g]?.char.trim())
    const marks = v.body.filter((k) => k.grapheme !== undefined && written.includes(k.grapheme) && !k.context)
    if (!marks.length) continue
    const x = marks.reduce((s, k) => s + k.x, 0) / marks.length
    const y = marks.reduce((s, k) => s + k.y, 0) / marks.length
    const text = written.map((g) => a.graphemes[g].char).join('')
    let members: Member[]
    if (written.length >= 2) members = written.map((g) => ({ char: a.graphemes[g].char, from: g, note: `「${text}」の字「${a.graphemes[g].char}」`, read: true }))
    else {
      const g = written[0]
      const parts = partsRead(v, g, 'islands')
      members = parts.length
        ? parts.map((p) => {
            const c = p.char && covers('serif', p.char) ? p.char : a.graphemes[g].char
            return { char: c, from: g, note: p.char ? `「${text}」の部品（「${p.char}」と読める）` : `「${text}」の部品（字として読めない：「${text}」のまま）`, read: c !== a.graphemes[g].char }
          })
        : [{ char: a.graphemes[g].char, from: g, note: `「${text}」は分かれない`, read: false }]
    }
    out.push({ marks, x, y, members, note: `${why}「${text}」` })
  }
  if (out.length < 2 || out.every((g) => g.members.length < 2)) return []
  // groups on top of each other are not origins
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) if (Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < APART * PAGE) return []
  return out
}

/**
 * Whether the groups differ in how many members they have: then the branches
 * compare something (木 one, 林 two, 森 three). Groups all alike in number
 * (ころ|ころ) give a tree that says nothing the repetition does not.
 */
export function branchesDiffer(v: PageView): boolean {
  const gs = groups(v)
  return gs.length >= 2 && new Set(gs.map((g) => g.members.length)).size >= 2
}

/**
 * Whether the branches are writing rather than a count: at least half of them
 * written in what their parts read as (or in the group's own characters).
 * Where the parts read as nothing, every branch is the group's glyph again,
 * and the tree only counts islands of ink — a diagram, not a page.
 */
export function branchesWrite(v: PageView): boolean {
  const ms = groups(v).flatMap((g) => g.members)
  return ms.length > 0 && ms.filter((m) => m.read).length >= ms.length / 2
}

export const branch: MarkGrammar = {
  id: 'branch',
  title: '分岐',
  rules: [
    '題が自分で測れる二段の構造があるときだけ：一段目は題のまとまり（並べられた項、繰り返しの出現）、二段目はそれぞれが何でできているか（二字以上ならその字、一字ならフォントがすでに離しているインクの島と、その島が読める字。計算機が継ぎ目で切った部品は使わない）',
    'まとまりの一つ一つが起点になり、二段目の数だけ枝が出る。枝は小さな字の一列で、その構成要素の字で書かれる。部品が字として読めなければ、元の字のまま',
    '枝はすべて、書かれた題の片側（紙面に余白のある側）へ、読みの向きに直交する方向を中心に扇状に伸びる。枝は縮まない：比べられるのは、まとまりごとの枝の数',
    'レビュー時の語彙の材料は、読まれた頭の字の枝の先に、一字だけ',
    '枝の長さ（四〜六字）と扇の開きは造形。枝の数と起点は造形ではない',
  ],

  offer(v) {
    const gs = groups(v)
    if (!gs.length) return null
    return {
      grounds: gs.map((g) => `${g.note}から${g.members.length}本：${g.members.map((m) => m.char).join('・')}`),
      uses: gs.map((g) => ({ property: 'branches', value: `${g.marks.map((k) => k.char).join('')}×${g.members.length}` })),
    }
  },

  apply(v, rng) {
    const gs = groups(v)
    if (!gs.length) return v.marks
    const vertical = v.a.direction === 'vertical'
    const s = roleSize('grain', within(rng, 0.6, 1), PAGE)
    const length = Math.round(within(rng, 4, 6))
    const fan = within(rng, 0.32, 0.42)
    const step = s * 1.2
    // the side of the writing the page has room on: perpendicular to the reading
    const bs = v.body.map((k) => ({ lo: vertical ? k.x - k.size / 2 : k.y - k.size / 2, hi: vertical ? k.x + k.size / 2 : k.y + k.size / 2 }))
    const before = Math.min(...bs.map((b) => b.lo))
    const after = PAGE - Math.max(...bs.map((b) => b.hi))
    // horizontal writing: up (−y) or down; vertical: left (−x) or right
    const base = vertical ? (before >= after ? Math.PI : 0) : before >= after ? -Math.PI / 2 : Math.PI / 2
    const added: Mark[] = []
    const meaning = meaningOf(v, v.nucleus, new Set(gs.flatMap((g) => g.members.map((m) => m.char))))
    const tips: Mark[] = []
    for (const g of gs) {
      const n = g.members.length
      const reach = Math.max(...g.marks.map((k) => Math.hypot(k.x - g.x, k.y - g.y) + k.size / 2))
      g.members.forEach((m, i) => {
        const t = base + (i - (n - 1) / 2) * fan
        let last: { x: number; y: number } | null = null
        let written = 0
        for (let j = 0; written < length && j < length * 3; j++) {
          const d = reach + s * 0.8 + j * step
          const x = g.x + Math.cos(t) * d
          const y = g.y + Math.sin(t) * d
          if (x < s || y < s || x > PAGE - s || y > PAGE - s) break
          if (!free(v, v.marks, added, x, y, s)) continue
          added.push({ char: m.char, x, y, size: s * 0.94, role: 'grain', derived: derive('branch', 'form', `${g.note}の枝：${m.note}`, m.from) })
          last = { x: x + Math.cos(t) * step, y: y + Math.sin(t) * step }
          written++
        }
        // meaning, once, at the tip of a branch of the head it was read from
        const item = meaning?.items?.find((it) => it.from === m.from && !tips.some((k) => k.char === it.char))
        if (item && last && free(v, v.marks, added, last.x, last.y, s * 1.15)) {
          const tip: Mark = {
            char: item.char,
            x: last.x,
            y: last.y,
            size: roleSize('auxiliary', 0.3, PAGE),
            role: 'auxiliary',
            derived: derive('branch', 'semantic', `枝の先：「${item.head}」に語彙が関係づける「${item.char}」`, item.from, item.source),
          }
          tips.push(tip)
          added.push(tip)
        }
      })
    }
    return [...v.marks, ...added]
  },
}
