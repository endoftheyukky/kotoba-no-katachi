// does v4 fill the space between the v2c families?
const fs = require('fs')
const AXES = ['curvature','closure','radiality','fragmentation','dispersion','periodicity','branching','hierarchy','rotation','axis','symmetry','containment','porosity','linearity']
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error && r.variant === 0)
const V2 = load('v3/v2c-profiles.json')
const V4 = load(process.env.V4 ?? 'v3/v4-profiles.json')
const fam = (r) => (r.grammar !== 'uniform' ? r.grammar : r.space === 'axis' ? `axis/${r.mode === 'joint' ? 'joint' : 'poles'}` : r.space)
const famOf = new Map(V2.map((r) => [r.text, fam(r)]))
const mean = AXES.map((k) => V2.reduce((s, r) => s + r.profile[k], 0) / V2.length)
const sd = AXES.map((k, j) => Math.sqrt(V2.reduce((s, r) => s + (r.profile[k] - mean[j]) ** 2, 0) / V2.length) || 1)
const z = (r) => AXES.map((k, j) => (r.profile[k] - mean[j]) / sd[j])
const d = (p, q) => Math.sqrt(p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0))
const Z2 = V2.map(z), Z4 = V4.map(z)
const fams = [...new Set(V2.map(fam))]
const cent = Object.fromEntries(fams.map((f) => {
  const m = V2.map((r, i) => (fam(r) === f ? Z2[i] : null)).filter(Boolean)
  return [f, AXES.map((_, j) => m.reduce((s, v) => s + v[j], 0) / m.length)]
}))
const between = (Z) => Z.map((p) => { const ds = fams.map((f) => d(p, cent[f])).sort((a, b) => a - b); return ds[0] / ds[1] })
const share = (xs, t) => xs.filter((x) => x > t).length / xs.length
const nn1 = (Z, rows) => {
  let hit = 0
  for (let i = 0; i < Z.length; i++) {
    let best = -1
    for (let j = 0; j < Z.length; j++) if (j !== i && rows[j].text !== rows[i].text && (best < 0 || d(Z[i], Z[j]) < d(Z[i], Z[best]))) best = j
    if (best >= 0 && famOf.get(rows[best].text) === famOf.get(rows[i].text)) hit++
  }
  return hit / Z.length
}
const extremes = (rows) => AXES.map((k) => rows.filter((r) => r.profile[k] < 0.02 || r.profile[k] > 0.98).length / rows.length)
const e2 = extremes(V2), e4 = extremes(V4)
console.log('| descriptor | v2c at 0/1 | v4 at 0/1 |\n| --- | --- | --- |')
AXES.forEach((k, j) => console.log(`| ${k} | ${(e2[j] * 100).toFixed(0)}% | ${(e4[j] * 100).toFixed(0)}% |`))
console.log(`\nmean share at the extremes: v2c ${(e2.reduce((s, x) => s + x, 0) / 14 * 100).toFixed(0)}% → v4 ${(e4.reduce((s, x) => s + x, 0) / 14 * 100).toFixed(0)}%`)
const b2 = between(Z2), b4 = between(Z4)
console.log(`pages between two v2c families (d1/d2 > 0.8): v2c ${(share(b2, 0.8) * 100).toFixed(0)}% → v4 ${(share(b4, 0.8) * 100).toFixed(0)}%`)
console.log(`1-NN recovery of the title's v2c family: v2c ${(nn1(Z2, V2) * 100).toFixed(0)}% → v4 ${(nn1(Z4, V4) * 100).toFixed(0)}%`)
const nnd = (Z, rows) => { const out = []; for (let i = 0; i < Z.length; i++) { let b = Infinity; for (let j = 0; j < Z.length; j++) if (j !== i && rows[j].text !== rows[i].text) b = Math.min(b, d(Z[i], Z[j])); out.push(b) } return out.sort((x, y) => x - y) }
const n2 = nnd(Z2, V2), n4 = nnd(Z4, V4)
const q = (a, p) => a[Math.floor(p * (a.length - 1))].toFixed(2)
console.log(`nearest-neighbour distance (p25 / median / p75): v2c ${q(n2, .25)} / ${q(n2, .5)} / ${q(n2, .75)} → v4 ${q(n4, .25)} / ${q(n4, .5)} / ${q(n4, .75)}`)
