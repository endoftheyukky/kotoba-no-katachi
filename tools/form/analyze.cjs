// v3 Stage 1 analysis: families, descriptor table, discreteness diagnostics, PCA scatter.
// usage: node v3-analyze.cjs <profiles.json> <out-prefix> [label]
const fs = require('fs')
const [file, outPrefix, label = ''] = process.argv.slice(2)
const AXES = ['curvature', 'closure', 'radiality', 'fragmentation', 'dispersion', 'periodicity', 'branching', 'hierarchy', 'rotation', 'axis', 'symmetry', 'containment', 'porosity', 'linearity']
const raw = JSON.parse(fs.readFileSync(file, 'utf8')).log.filter((r) => !r.error)
const family = (r) => (r.grammar !== 'uniform' ? r.grammar : r.space === 'axis' ? `axis/${r.mode === 'joint' ? 'joint' : 'poles'}` : r.space)
const rows = raw.map((r) => ({ ...r, family: family(r), v: AXES.map((k) => r.profile[k]) }))

function analyse(rows, tag) {
  const n = rows.length
  const mean = AXES.map((_, j) => rows.reduce((s, r) => s + r.v[j], 0) / n)
  const sd = AXES.map((_, j) => Math.sqrt(rows.reduce((s, r) => s + (r.v[j] - mean[j]) ** 2, 0) / n) || 1)
  const z = rows.map((r) => r.v.map((x, j) => (x - mean[j]) / sd[j]))
  const d = (a, b) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) ** 2, 0))
  const D = z.map((a) => z.map((b) => d(a, b)))
  // leave-one-out 1-NN: can the family be told from the form alone?
  let hits = 0
  // same-page variants would make this trivial: exclude the same title
  for (let i = 0; i < n; i++) {
    let best = -1
    for (let j = 0; j < n; j++) if (j !== i && rows[j].text !== rows[i].text && (best < 0 || D[i][j] < D[i][best])) best = j
    if (best >= 0 && rows[best].family === rows[i].family) hits++
  }
  // silhouette of the family partition
  const fams = [...new Set(rows.map((r) => r.family))]
  let sil = 0
  let silN = 0
  for (let i = 0; i < n; i++) {
    const same = rows.map((r, j) => (j !== i && r.family === rows[i].family ? D[i][j] : null)).filter((x) => x !== null)
    if (!same.length) continue
    const a = same.reduce((s, x) => s + x, 0) / same.length
    const b = Math.min(
      ...fams.filter((f) => f !== rows[i].family).map((f) => {
        const o = rows.map((r, j) => (r.family === f ? D[i][j] : null)).filter((x) => x !== null)
        return o.length ? o.reduce((s, x) => s + x, 0) / o.length : Infinity
      }),
    )
    sil += (b - a) / Math.max(a, b)
    silN++
  }
  // in-between: pages about as near to a second family's centre as to their own nearest
  const cent = Object.fromEntries(fams.map((f) => {
    const m = rows.map((r, i) => (r.family === f ? z[i] : null)).filter(Boolean)
    return [f, AXES.map((_, j) => m.reduce((s, v) => s + v[j], 0) / m.length)]
  }))
  const ratios = z.map((a) => {
    const ds = fams.map((f) => d(a, cent[f])).sort((x, y) => x - y)
    return ds.length > 1 ? ds[0] / ds[1] : 0
  })
  const between = ratios.filter((x) => x > 0.8).length / n
  // how many distinct values each descriptor really takes: share of pages at its extremes, bins used
  const shape = AXES.map((k, j) => {
    const vs = rows.map((r) => r.v[j])
    const ext = vs.filter((x) => x < 0.02 || x > 0.98).length / n
    const bins = new Set(vs.map((x) => Math.min(9, Math.floor(x * 10)))).size
    return { k, ext, bins }
  })
  return { tag, n, fams: fams.length, knn: hits / n, silhouette: sil / silN, between, mean, sd, z, cent, shape }
}

const all = analyse(rows, 'all variants')
const v0 = analyse(rows.filter((r) => r.variant === 0), 'variant 0 (the public series)')

// family table (all variants), means
const fams = [...new Set(rows.map((r) => r.family))].sort()
const table = fams.map((f) => {
  const m = rows.filter((r) => r.family === f)
  return { family: f, n: m.length, means: AXES.map((_, j) => m.reduce((s, r) => s + r.v[j], 0) / m.length) }
})
const fmt = (x) => x.toFixed(2).replace(/^0\./, '.').replace(/^1\.00$/, '1')
let md = `## Form descriptors by family ${label}\n\n| family | n | ${AXES.map((a) => a.slice(0, 5)).join(' | ')} |\n| --- | --- | ${AXES.map(() => '---').join(' | ')} |\n`
for (const t of table) md += `| ${t.family} | ${t.n} | ${t.means.map(fmt).join(' | ')} |\n`
md += `\n## Discreteness ${label}\n\n| set | pages | families | 1-NN family accuracy (other titles) | silhouette | pages between two families (d1/d2 > 0.8) |\n| --- | --- | --- | --- | --- | --- |\n`
for (const s of [v0, all]) md += `| ${s.tag} | ${s.n} | ${s.fams} | ${(s.knn * 100).toFixed(0)}% | ${s.silhouette.toFixed(2)} | ${(s.between * 100).toFixed(0)}% |\n`
md += `\n## How each descriptor is used ${label} (all variants)\n\n| descriptor | pages at 0 or 1 | of 10 bins used |\n| --- | --- | --- |\n`
for (const s of all.shape) md += `| ${s.k} | ${(s.ext * 100).toFixed(0)}% | ${s.bins} |\n`
fs.writeFileSync(`${outPrefix}.md`, md)

// PCA of the standardised profiles (power iteration), scatter as SVG
function pca(z) {
  const n = z.length
  const k = z[0].length
  const C = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => z.reduce((s, r) => s + r[a] * r[b], 0) / n))
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
    comps.push({ v, lambda })
    M = M.map((r, i) => r.map((x, j) => x - lambda * v[i] * v[j]))
  }
  const total = C.reduce((s, r, i) => s + r[i], 0)
  return { comps, share: comps.map((c) => c.lambda / total) }
}
const P = pca(all.z)
const xy = all.z.map((r) => P.comps.map((c) => r.reduce((s, x, j) => s + x * c.v[j], 0)))
const palette = ['#1b1b19', '#b3452c', '#2c6fb3', '#3d8b3d', '#8a4bb3', '#c28a1e', '#1e9aa0', '#b32c78', '#6b6b6b', '#5a3c1e', '#9aa01e', '#1e4aa0', '#a01e1e', '#4a1ea0', '#1ea04a']
const col = Object.fromEntries(fams.map((f, i) => [f, palette[i % palette.length]]))
const X = xy.map((p) => p[0])
const Y = xy.map((p) => p[1])
const [x0, x1, y0, y1] = [Math.min(...X), Math.max(...X), Math.min(...Y), Math.max(...Y)]
const W = 760
const H = 560
const sx = (x) => 40 + ((x - x0) / (x1 - x0 || 1)) * (W - 240)
const sy = (y) => 30 + ((y - y0) / (y1 - y0 || 1)) * (H - 70)
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,Consolas,monospace" font-size="11"><rect width="100%" height="100%" fill="#f4f3f0"/>`
svg += `<text x="40" y="18" fill="#333">${label} — form descriptors, PCA of ${all.n} pages (PC1 ${(P.share[0] * 100).toFixed(0)}%, PC2 ${(P.share[1] * 100).toFixed(0)}%)</text>`
rows.forEach((r, i) => {
  svg += `<circle cx="${sx(xy[i][0]).toFixed(1)}" cy="${sy(xy[i][1]).toFixed(1)}" r="${r.variant === 0 ? 4.2 : 2.6}" fill="${col[r.family]}" fill-opacity="${r.variant === 0 ? 0.9 : 0.45}"/>`
})
fams.forEach((f, i) => {
  svg += `<circle cx="${W - 180}" cy="${40 + i * 18}" r="5" fill="${col[f]}"/><text x="${W - 168}" y="${44 + i * 18}" fill="#333">${f} (${rows.filter((r) => r.family === f).length})</text>`
})
svg += `<text x="40" y="${H - 12}" fill="#777">large dots: variant 0 (the public series); small: variants 1–3</text></svg>`
fs.writeFileSync(`${outPrefix}-pca.svg`, svg)
fs.writeFileSync(`${outPrefix}-summary.json`, JSON.stringify({ v0: { n: v0.n, knn: v0.knn, silhouette: v0.silhouette, between: v0.between }, all: { n: all.n, knn: all.knn, silhouette: all.silhouette, between: all.between }, pca: P.comps.map((c, i) => ({ share: P.share[i], loadings: Object.fromEntries(AXES.map((a, j) => [a, +c.v[j].toFixed(2)])) })) }, null, 1))
console.log(md)
console.log('PCA loadings:', JSON.stringify(P.comps.map((c, i) => ({ share: +P.share[i].toFixed(2), top: AXES.map((a, j) => [a, c.v[j]]).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).slice(0, 5).map(([a, v]) => `${a}${v > 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`) }))))
