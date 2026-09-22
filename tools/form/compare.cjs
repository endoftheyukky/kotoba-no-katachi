// before/after in one standardised form space: how far pages moved, relative to the gaps between families;
// within-family spread; and an SVG map with arrows (PCA basis fitted on the v2c pages).
// usage: node v3-compare.cjs <v2c-profiles.json> <v3-profiles.json> <out-prefix> <label>
const fs = require('fs')
const [fa, fb, out, label] = process.argv.slice(2)
const AXES = ['curvature', 'closure', 'radiality', 'fragmentation', 'dispersion', 'periodicity', 'branching', 'hierarchy', 'rotation', 'axis', 'symmetry', 'containment', 'porosity', 'linearity']
const family = (r) => (r.grammar !== 'uniform' ? r.grammar : r.space === 'axis' ? `axis/${r.mode === 'joint' ? 'joint' : 'poles'}` : r.space)
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error && r.variant === 0)
const A = load(fa)
const B = load(fb)
const n = A.length
const mean = AXES.map((k) => A.reduce((s, r) => s + r.profile[k], 0) / n)
const sd = AXES.map((k, j) => Math.sqrt(A.reduce((s, r) => s + (r.profile[k] - mean[j]) ** 2, 0) / n) || 1)
const z = (r) => AXES.map((k, j) => (r.profile[k] - mean[j]) / sd[j])
const ZA = A.map(z)
const ZB = B.map(z)
const d = (p, q) => Math.sqrt(p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0))
// for each page: how far it moved, and how far its nearest page of another family (another title) was, in v2c
const rows = A.map((r, i) => {
  const moved = d(ZA[i], ZB[i])
  let gap = Infinity
  A.forEach((o, j) => {
    if (j !== i && o.text !== r.text && family(o) !== family(r)) gap = Math.min(gap, d(ZA[i], ZA[j]))
  })
  let same = Infinity
  A.forEach((o, j) => {
    if (j !== i && o.text !== r.text && family(o) === family(r)) same = Math.min(same, d(ZA[i], ZA[j]))
  })
  return { text: r.text, family: family(r), moved, gap, same, ratio: moved / gap }
})
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const movedPages = rows.filter((r) => r.moved > 0.05)
// within-family spread before and after (mean distance to the family centroid), families with ≥ 3 pages
const fams = [...new Set(rows.map((r) => r.family))]
const spread = (Z) =>
  fams
    .map((f) => {
      const idx = rows.map((r, i) => (r.family === f ? i : -1)).filter((i) => i >= 0)
      if (idx.length < 3) return null
      const c = AXES.map((_, j) => idx.reduce((s, i) => s + Z[i][j], 0) / idx.length)
      return idx.reduce((s, i) => s + d(Z[i], c), 0) / idx.length
    })
    .filter((x) => x !== null)
const sA = spread(ZA)
const sB = spread(ZB)
let md = `## ${label}: how far pages moved in the form space (variant 0, ${n} pages, standardised on v2c)\n\n`
md += `| | value |\n| --- | --- |\n`
md += `| pages that moved | ${movedPages.length} of ${n} |\n`
md += `| median distance moved (moved pages) | ${med(movedPages.map((r) => r.moved)).toFixed(2)} |\n`
md += `| median distance to the nearest page of another family (v2c) | ${med(rows.map((r) => r.gap)).toFixed(2)} |\n`
md += `| median distance to the nearest page of the same family (v2c) | ${med(rows.filter((r) => Number.isFinite(r.same)).map((r) => r.same)).toFixed(2)} |\n`
md += `| median moved / gap to another family (moved pages) | ${med(movedPages.map((r) => r.ratio)).toFixed(2)} |\n`
md += `| pages that moved at least half the gap | ${movedPages.filter((r) => r.ratio >= 0.5).length} |\n`
md += `| mean within-family spread, v2c → v3 | ${(sA.reduce((s, x) => s + x, 0) / sA.length).toFixed(2)} → ${(sB.reduce((s, x) => s + x, 0) / sB.length).toFixed(2)} |\n\n`
md += `Largest moves: ${[...rows].sort((a, b) => b.moved - a.moved).slice(0, 10).map((r) => `${r.text} ${r.moved.toFixed(2)} (gap ${r.gap.toFixed(2)})`).join(' · ')}\n`
fs.writeFileSync(`${out}.md`, md)
console.log(md)

// PCA on v2c (power iteration), both sets projected, arrows v2c → v3
function pca(Z) {
  const k = Z[0].length
  const C = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) / Z.length))
  const comps = []
  let M = C.map((r) => [...r])
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: k }, (_, i) => 1 / Math.sqrt(k) + i * 1e-3)
    for (let it = 0; it < 500; it++) {
      const w = M.map((r) => r.reduce((s, x, j) => s + x * v[j], 0))
      const norm = Math.hypot(...w)
      v = w.map((x) => x / norm)
    }
    const lambda = v.reduce((s, x, i) => s + x * M[i].reduce((t, y, j) => t + y * v[j], 0), 0)
    comps.push(v)
    M = M.map((r, i) => r.map((x, j) => x - lambda * v[i] * v[j]))
  }
  return comps
}
const P = pca(ZA)
const proj = (r) => P.map((v) => r.reduce((s, x, j) => s + x * v[j], 0))
const pa = ZA.map(proj)
const pb = ZB.map(proj)
const all = [...pa, ...pb]
const [x0, x1] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))]
const [y0, y1] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))]
const W = 860
const H = 620
const sx = (x) => 40 + ((x - x0) / (x1 - x0 || 1)) * (W - 260)
const sy = (y) => 40 + ((y - y0) / (y1 - y0 || 1)) * (H - 80)
const palette = ['#1b1b19', '#b3452c', '#2c6fb3', '#3d8b3d', '#8a4bb3', '#c28a1e', '#1e9aa0', '#b32c78', '#6b6b6b', '#5a3c1e', '#9aa01e', '#1e4aa0', '#a01e1e', '#4a1ea0', '#1ea04a', '#777']
const col = Object.fromEntries(fams.sort().map((f, i) => [f, palette[i % palette.length]]))
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,Consolas,monospace" font-size="11"><rect width="100%" height="100%" fill="#f4f3f0"/>`
svg += `<text x="40" y="22" fill="#333">${label}: the ${n} public pages in the form space (PCA of v2c). dot = v2c, arrow = where v3 moved it</text>`
rows.forEach((r, i) => {
  const [ax, ay] = [sx(pa[i][0]), sy(pa[i][1])]
  const [bx, by] = [sx(pb[i][0]), sy(pb[i][1])]
  if (Math.hypot(bx - ax, by - ay) > 1.5) svg += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col[r.family]}" stroke-width="1.2" stroke-opacity="0.7"/><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2" fill="${col[r.family]}"/>`
  svg += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4" fill="none" stroke="${col[r.family]}" stroke-width="1.4"/>`
})
Object.keys(col).forEach((f, i) => (svg += `<circle cx="${W - 200}" cy="${46 + i * 18}" r="5" fill="${col[f]}"/><text x="${W - 188}" y="${50 + i * 18}" fill="#333">${f} (${rows.filter((r) => r.family === f).length})</text>`))
svg += `</svg>`
fs.writeFileSync(`${out}-map.svg`, svg)
