// Does the set still read as one series? Two things are asked of it:
//
//   spread     how far apart the pages stand in the form space, against how
//              large the whole cloud is. A series is not held together by pages
//              being near each other but by the cloud being one cloud: the
//              nearest-neighbour distance is read as a share of the mean
//              distance between any two pages.
//   register   what every page shares whatever its form: how large the writing
//              is, how much of the page it uses, how many marks there are, how
//              far the largest and the smallest stand apart. A series holds
//              when the register is the same and the forms differ.
//
// usage: node tools/form/series.cjs <v2c-profiles> <v4-profiles> <v2c-drafts> <v4-drafts>
const fs = require('fs')
const AXES = ['curvature','closure','radiality','fragmentation','dispersion','periodicity','branching','hierarchy','rotation','axis','symmetry','containment','porosity','linearity']
const PAGE = 1000
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error && (r.variant ?? 0) === 0)
const [pv2, pv4, dv2, dv4] = process.argv.slice(2)
const P2 = load(pv2)
const P4 = load(pv4)

const mean = AXES.map((k) => P2.reduce((s, r) => s + r.profile[k], 0) / P2.length)
const sd = AXES.map((k, j) => Math.sqrt(P2.reduce((s, r) => s + (r.profile[k] - mean[j]) ** 2, 0) / P2.length) || 1)
const z = (r) => AXES.map((k, j) => (r.profile[k] - mean[j]) / sd[j])
const d = (p, q) => Math.sqrt(p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0))
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }

function cloud(rows) {
  const Z = rows.map(z)
  const nn = Z.map((p, i) => Math.min(...Z.map((q, j) => (j === i || rows[j].text === rows[i].text ? Infinity : d(p, q)))))
  let sum = 0
  let n = 0
  for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) { sum += d(Z[i], Z[j]); n++ }
  const pair = sum / n
  return { nn: quant(nn, 0.5), pair, ratio: quant(nn, 0.5) / pair, far: quant(nn, 0.95) / pair }
}

console.log('## the cloud (v2c form space, z-scored)\n')
console.log('| | v2c | v4 |')
console.log('| --- | --- | --- |')
const c2 = cloud(P2)
const c4 = cloud(P4)
console.log(`| nearest neighbour (median) | ${c2.nn.toFixed(2)} | ${c4.nn.toFixed(2)} |`)
console.log(`| mean distance between two pages | ${c2.pair.toFixed(2)} | ${c4.pair.toFixed(2)} |`)
console.log(`| nearest neighbour ÷ mean distance | ${(100 * c2.ratio).toFixed(0)}% | ${(100 * c4.ratio).toFixed(0)}% |`)
console.log(`| the loneliest page (95th) ÷ mean | ${(100 * c2.far).toFixed(0)}% | ${(100 * c4.far).toFixed(0)}% |`)

// the register: measured on the marks themselves, not on the form descriptors
const marksOf = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error && (r.variant ?? 0) === 0)
function register(rows) {
  const out = []
  for (const r of rows) {
    const ms = r.marks
    if (!ms?.length) continue
    const own = ms.filter((k) => k.g !== undefined)
    const sizes = ms.map((k) => k.s)
    const big = Math.max(...sizes)
    const x0 = Math.min(...ms.map((k) => k.x - k.s / 2)), x1 = Math.max(...ms.map((k) => k.x + k.s / 2))
    const y0 = Math.min(...ms.map((k) => k.y - k.s / 2)), y1 = Math.max(...ms.map((k) => k.y + k.s / 2))
    out.push({
      largest: big / PAGE,
      written: own.length,
      marks: ms.length,
      area: ms.reduce((s, k) => s + (k.s / PAGE) ** 2, 0),
      used: ((x1 - x0) * (y1 - y0)) / PAGE ** 2,
      hierarchy: big / Math.max(1, Math.min(...own.map((k) => k.s))),
      margin: Math.min(x0, y0, PAGE - x1, PAGE - y1) / PAGE,
    })
  }
  return out
}
const KEYS = [
  ['largest', 'the largest character (share of the page)'],
  ['written', 'characters of the title written'],
  ['marks', 'marks on the page'],
  ['area', 'ink laid down (sum of squares)'],
  ['used', 'page the figure uses'],
  ['hierarchy', 'largest ÷ smallest written'],
  ['margin', 'nearest edge'],
]
const R2 = register(marksOf(dv2))
const R4 = register(marksOf(dv4))
console.log('\n## the register (p25 / median / p75)\n')
console.log('| | v2c | v4 |')
console.log('| --- | --- | --- |')
for (const [k, label] of KEYS) {
  const f = (rs) => [0.25, 0.5, 0.75].map((q) => quant(rs.map((r) => r[k]), q)).map((v) => (v >= 10 ? v.toFixed(0) : v.toFixed(2))).join(' / ')
  console.log(`| ${label} | ${f(R2)} | ${f(R4)} |`)
}
