// Do pages rhyme? Not "are they the same template" (family recovery) but: do
// titles that share a structure sit near each other, while still being far
// enough apart to be different pages?
//
//   neighbourhood   a page's nearest neighbour, against the mean distance
//                   between any two pages. Small means near-twins (v2c's
//                   templates), large means every page alone (v5).
//   rhyme           the mean distance between two pages that share their
//                   strongest structure, against two that do not. Below 1 means
//                   a shared structure shows on the page.
//   agreement       how often a page's nearest neighbour has the same structure.
//                   Chance is the share of the largest group.
//
// usage: node tools/form/rhyme.cjs <motif-drafts> <profiles…>   (profiles named by file)
const fs = require('fs')
const AXES = ['curvature','closure','radiality','fragmentation','dispersion','periodicity','branching','hierarchy','rotation','axis','symmetry','containment','porosity','linearity']
const rows = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).log.filter((r) => !r.error && (r.variant ?? 0) === 0)
const [labels, ...sets] = process.argv.slice(2)
const motifOf = new Map(rows(labels).map((r) => [r.text, r.motif]))

const base = rows(sets[0])
const mean = AXES.map((k) => base.reduce((s, r) => s + r.profile[k], 0) / base.length)
const sd = AXES.map((k, j) => Math.sqrt(base.reduce((s, r) => s + (r.profile[k] - mean[j]) ** 2, 0) / base.length) || 1)
const z = (r) => AXES.map((k, j) => (r.profile[k] - mean[j]) / sd[j])
const d = (p, q) => Math.sqrt(p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0))
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const groups = new Map()
for (const [, m] of motifOf) groups.set(m, (groups.get(m) ?? 0) + 1)
const chance = Math.max(...groups.values()) / [...groups.values()].reduce((s, v) => s + v, 0)
console.log('titles by their strongest structure:', [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  '))
console.log(`(a nearest neighbour would share it ${(100 * chance).toFixed(0)}% of the time by chance alone)\n`)

console.log('| | nearest ÷ mean | rhyme (same ÷ other) | agreement |')
console.log('| --- | --- | --- | --- |')
for (const file of sets) {
  const rs = rows(file)
  const Z = rs.map(z)
  const nn = []
  let agree = 0
  let same = [0, 0]
  let other = [0, 0]
  let pair = 0
  let pairs = 0
  for (let i = 0; i < Z.length; i++) {
    let best = -1
    for (let j = 0; j < Z.length; j++) {
      if (j === i || rs[j].text === rs[i].text) continue
      const dist = d(Z[i], Z[j])
      if (best < 0 || dist < d(Z[i], Z[best])) best = j
      if (j > i) {
        pair += dist
        pairs++
        const shared = motifOf.get(rs[i].text) === motifOf.get(rs[j].text)
        if (shared) { same[0] += dist; same[1]++ } else { other[0] += dist; other[1]++ }
      }
    }
    if (best >= 0) {
      nn.push(d(Z[i], Z[best]))
      if (motifOf.get(rs[best].text) === motifOf.get(rs[i].text)) agree++
    }
  }
  const name = file.replace(/^.*[\\/]/, '').replace(/-profiles\.json$/, '')
  const ratio = med(nn) / (pair / pairs)
  console.log(
    `| ${name} | ${(100 * ratio).toFixed(0)}% | ${(same[0] / same[1] / (other[0] / other[1])).toFixed(3)} | ${(100 * agree / Z.length).toFixed(0)}% |`,
  )
}
