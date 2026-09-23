// Ordinary words: are their pages distinct from one another, and does a
// shared meaning bring pages nearer (a rhyme) without making them the same?
//
//   NN            each word's nearest other word in the form space (z-scored
//                 against v2c): near 0 means two words got the same page
//   twins         pairs of words closer than a fifth of the mean distance
//   meaning ~ form  rank correlation between how far apart two words are in
//                 meaning and how far apart their pages are: 0 means meaning
//                 does not show; near 1 would be an illustration
//
// usage: node tools/form/plain-words.cjs <v2c-profiles> <drafts-with-meaning> <profiles>… (set: difficult)
const fs = require('fs')
const AXES = ['curvature','closure','radiality','fragmentation','dispersion','periodicity','branching','hierarchy','rotation','axis','symmetry','containment','porosity','linearity']
const rows = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error)
const [v2cFile, meaningFile, ...sets] = process.argv.slice(2)
const base = rows(v2cFile).filter((r) => (r.variant ?? 0) === 0)
const mean = AXES.map((k) => base.reduce((s, r) => s + r.profile[k], 0) / base.length)
const sd = AXES.map((k, j) => Math.sqrt(base.reduce((s, r) => s + (r.profile[k] - mean[j]) ** 2, 0) / base.length) || 1)
const z = (r) => AXES.map((k, j) => (r.profile[k] - mean[j]) / sd[j])
const d = (p, q) => Math.sqrt(p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0))
const meanings = new Map(rows(meaningFile).filter((r) => r.meaning).map((r) => [r.text, Object.values(r.meaning)]))
const rank = (xs) => { const o = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); o.forEach(([, i], k) => (r[i] = k)); return r }
const spearman = (a, b) => { const ra = rank(a), rb = rank(b); const n = a.length; const ma = (n - 1) / 2; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2 } return num / Math.sqrt(da * db) }
console.log('| | NN median | twins (< 1/5 mean) | meaning ~ form |')
console.log('| --- | --- | --- | --- |')
for (const f of sets) {
  const rs = rows(f).filter((r) => r.set === 'difficult')
  const Z = rs.map(z)
  const nn = Z.map((p, i) => Math.min(...Z.map((q, j) => (i === j ? Infinity : d(p, q)))))
  let sum = 0, n = 0
  const formD = [], semD = []
  for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) {
    const fd = d(Z[i], Z[j]); sum += fd; n++
    const a = meanings.get(rs[i].text), b = meanings.get(rs[j].text)
    if (a && b) { formD.push(fd); semD.push(Math.sqrt(a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0))) }
  }
  const avg = sum / n
  let twins = 0
  for (let i = 0; i < Z.length; i++) for (let j = i + 1; j < Z.length; j++) if (d(Z[i], Z[j]) < avg / 5) twins++
  const med = [...nn].sort((a, b) => a - b)[Math.floor(nn.length / 2)]
  console.log(`| ${f.replace(/^.*[\/]/, '').replace(/-hard-profiles\.json$/, '')} | ${med.toFixed(2)} | ${twins} of ${n} pairs | ${formD.length ? spearman(semD, formD).toFixed(2) : '—'} |`)
}
