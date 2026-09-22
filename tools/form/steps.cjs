// what the solver did: operators fired, how much of the asked amount each page took, what stopped it
const fs = require('fs')
const pages = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).log.filter((p) => p.form && p.variant === 0)
const ops = {}
let moved = 0, worse = 0
for (const p of pages) {
  const s = p.form.steps
  if (s.some((x) => x.achieved > 0)) moved++
  const b = p.form.soundness.before, a = p.form.soundness.after
  if (Object.keys(b).some((k) => a[k] > b[k])) worse++
  for (const x of s) {
    const o = (ops[x.op] ??= { asked: 0, full: 0, partial: 0, none: 0, stops: {} })
    o.asked++
    if (x.achieved === 1) o.full++
    else if (x.achieved > 0) o.partial++
    else o.none++
    if (x.stopped) for (const k of x.stopped.split(', ')) { const key = k.split(' ')[0]; o.stops[key] = (o.stops[key] ?? 0) + 1 }
  }
}
console.log(`variant 0: ${pages.length} pages, ${moved} moved by at least one operator, ${worse} less sound than their anchor`)
for (const [k, o] of Object.entries(ops)) console.log(k.padEnd(7), `asked ${o.asked}, full ${o.full}, partial ${o.partial}, none ${o.none}`, JSON.stringify(o.stops))
