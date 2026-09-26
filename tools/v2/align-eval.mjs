// Evaluation only: align-1's direct placements against KanjiVG's component groups (IoU of boxes).
//
//   node tools/v2/align-eval.mjs --kanjivg <kanjivg.xml.gz> [--table public/v2/align-1] [--stroke 9] [--out report.json]
//
// KanjiVG (Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net) is an external reference for
// checking the table, never a source of it: tools/v2/align.mjs does not read it, nothing in src/
// reads it, and the file is not kept in the repository. KanjiVG draws a different design (stroke
// centrelines, not Noto Sans JP), so an IoU well under 1 can still be a right placement: this
// measures agreement, not truth.
//
// A KanjiVG box is laid on the whole's ink box: the kanji's centreline box is stretched to the ink
// box less a stroke's width, and each component's centreline box is then grown by half a stroke.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const arg = (name, d) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : d
}

/** every kanji's group tree: { element, original, part, boxes of its own strokes, children } */
export function readKanjiVG(path) {
  const text = gunzipSync(readFileSync(path)).toString('utf8')
  const out = new Map()
  for (const m of text.matchAll(/<kanji id="kvg:kanji_([0-9a-f]+)">([\s\S]*?)<\/kanji>/g)) {
    const char = String.fromCodePoint(parseInt(m[1], 16))
    const stack = []
    let root = null
    for (const t of m[2].matchAll(/<(\/?)(g|path)\b([^>]*?)(\/?)>/g)) {
      const [, close, tag, attrs, self] = t
      const at = (k) => (new RegExp(`(?:^|\\s)${k}="([^"]*)"`).exec(attrs) ?? [])[1]
      if (tag === 'g' && !close) {
        const g = { element: at('kvg:element'), original: at('kvg:original'), part: at('kvg:part'), box: null, children: [] }
        if (stack.length) stack[stack.length - 1].children.push(g)
        else root ??= g
        stack.push(g)
        if (self) stack.pop()
      } else if (tag === 'g' && close) stack.pop()
      else if (tag === 'path' && !close) {
        const box = pathBox(at('d') ?? '')
        for (const g of stack) g.box = merge(g.box, box)
      }
    }
    if (root) out.set(char, root)
  }
  return out
}

const merge = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) })

/** the box of an SVG path (M L C S H V Z, absolute and relative), curves sampled */
function pathBox(d) {
  const tok = d.match(/[MmLlCcSsHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let i = 0
  let cmd = null
  let x = 0
  let y = 0
  let px = 0
  let py = 0
  let box = null
  const put = (a, b) => (box = merge(box, { x0: a, y0: b, x1: a, y1: b }))
  const num = () => Number(tok[i++])
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 8; k++) {
      const s = k / 8
      const a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, c = 3 * (1 - s) * s * s, e = s ** 3
      put(a * x + b * x1 + c * x2 + e * x3, a * y + b * y1 + c * y2 + e * y3)
    }
    px = x2
    py = y2
    x = x3
    y = y3
  }
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M':
      case 'L':
        x = ox + num()
        y = oy + num()
        put(x, y)
        if (cmd === 'M') cmd = 'L'
        if (cmd === 'm') cmd = 'l'
        break
      case 'H':
        x = ox + num()
        put(x, y)
        break
      case 'V':
        y = oy + num()
        put(x, y)
        break
      case 'C': {
        const a = [num(), num(), num(), num(), num(), num()]
        cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5])
        break
      }
      case 'S': {
        const a = [num(), num(), num(), num()]
        cubic(2 * x - px, 2 * y - py, ox + a[0], oy + a[1], ox + a[2], oy + a[3])
        break
      }
      case 'Z':
        break
      default:
        i++
    }
  }
  return box
}

const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const I = ix * iy
  const U = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - I
  return U > 0 ? I / U : 0
}

/** the KanjiVG box of each direct child of an entry, where KanjiVG names the same component at its top level */
export function referenceBoxes(entry, kvg, stroke) {
  const root = kvg.get(entry.char)
  if (!root?.box || !entry.whole) return new Map()
  const tops = root.children.filter((g) => g.element)
  const k = root.box
  const hw = entry.whole.half.w
  const hh = entry.whole.half.h
  const sx = (2 * hw - stroke) / Math.max(1e-6, k.x1 - k.x0)
  const sy = (2 * hh - stroke) / Math.max(1e-6, k.y1 - k.y0)
  const place = (b) => ({
    x0: -hw + stroke / 2 + (b.x0 - k.x0) * sx - stroke / 2,
    x1: -hw + stroke / 2 + (b.x1 - k.x0) * sx + stroke / 2,
    y0: -hh + stroke / 2 + (b.y0 - k.y0) * sy - stroke / 2,
    y1: -hh + stroke / 2 + (b.y1 - k.y0) * sy + stroke / 2,
  })
  const out = new Map()
  const used = new Map()
  const direct = entry.rows.filter((r) => r.depth === 1)
  for (const r of entry.rows) {
    if (r.depth !== 1 || r.node.kind !== 'leaf') continue
    const c = r.node.char
    // KanjiVG's top level laid out as the structure's (as many groups, none in parts): pair by place
    if (tops.length === direct.length && !tops.some((g) => g.part)) {
      const g = tops[r.index]
      if (g.element === c || g.original === c) out.set(r.path, place(g.box))
      continue
    }
    // KanjiVG's own element first; the form it is a variant of (氵 of 水) only when nothing else is c
    const named = tops.filter((g) => g.element === c)
    const same = named.length ? named : tops.filter((g) => g.original === c)
    if (!same.length) continue
    // a component KanjiVG splits in parts (門 around 音) is the union of its parts; repeated ones (木 木) in order
    const parted = same.filter((g) => g.part)
    let box = null
    if (parted.length && parted.length === same.length) for (const g of parted) box = merge(box, g.box)
    else {
      const n = used.get(c) ?? 0
      used.set(c, n + 1)
      box = same[n]?.box ?? null
    }
    if (box) out.set(r.path, place(box))
  }
  return out
}

if (process.argv[1]?.endsWith('align-eval.mjs')) {
  const kvgPath = arg('--kanjivg')
  if (!kvgPath) {
    console.error('usage: --kanjivg <kanjivg.xml.gz> [--table dir] [--stroke 9] [--out report.json]')
    process.exit(2)
  }
  const dir = arg('--table', 'public/v2/align-1')
  const stroke = Number(arg('--stroke', '9'))
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const entries = manifest.shards.files.flatMap((f) => Object.values(JSON.parse(readFileSync(join(dir, f.name), 'utf8')).entries))
  const kvg = readKanjiVG(kvgPath)
  const rows = []
  for (const e of entries) {
    if (e.status !== 'fitted') continue
    const ref = referenceBoxes(e, kvg, stroke)
    for (const r of e.rows) {
      const b = ref.get(r.path)
      if (!b || !r.box) continue
      const ours = { x0: r.box.x, y0: r.box.y, x1: r.box.x + r.box.w, y1: r.box.y + r.box.h }
      rows.push({ char: e.char, path: r.path, component: r.node.char, tier: r.node.tier, status: r.status, confidence: r.confidence, iou: Math.round(iou(ours, b) * 1000) / 1000 })
    }
  }
  const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null)
  const summary = (rs) => ({ n: rs.length, p10: q(rs.map((r) => r.iou), 0.1), p25: q(rs.map((r) => r.iou), 0.25), median: q(rs.map((r) => r.iou), 0.5), below05: rs.filter((r) => r.iou < 0.5).length })
  const by = (k) => Object.fromEntries([...new Set(rows.map((r) => r[k]))].sort().map((v) => [v, summary(rows.filter((r) => r[k] === v))]))
  const report = {
    reference: { name: 'KanjiVG', file: kvgPath.split(/[\\/]/).pop(), use: 'evaluation only' },
    table: manifest.sha256,
    stroke,
    compared: summary(rows),
    byStatus: by('status'),
    byTier: by('tier'),
    lowest: [...rows].sort((a, b) => a.iou - b.iou).slice(0, 40),
    rows,
  }
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(report, null, 1))
  const { rows: _, lowest, ...head } = report
  console.log(JSON.stringify(head, null, 1))
  console.log('lowest:', lowest.slice(0, 25).map((r) => `${r.char}:${r.component}${r.iou}(${r.status})`).join(' '))
}
