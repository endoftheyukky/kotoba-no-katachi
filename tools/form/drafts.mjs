// dump every page's marks (dev + holdout + probe × variants) under a force, for measuring in node
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const force = process.env.FORCE ?? '{"grammar":"auto"}'
  const variants = (process.env.VARIANTS ?? '0').split(',').map(Number)
  return evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts'); const P = await import('/src/study/probes.ts')
    const titles = [...T.STUDY_TITLES.map((t) => ({ ...t, set: 'dev' })), ...H.HOLDOUT_TITLES.map((t) => ({ ...t, set: 'holdout' })), ...P.PROBE_TITLES.map((t) => ({ ...t, set: 'probe' }))]
    const r = (v) => Math.round(v * 100) / 100
    const out = []
    for (const t of titles) for (const variant of ${JSON.stringify(variants)}) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading, variant })
      if (typeof input === 'string') continue
      try {
        const a = await C.analyze(input); const c = C.compose(a, ${force})
        out.push({ text: t.text, reading: t.reading ?? '', set: t.set, variant, space: c.spatial.id, mode: c.spatial.mode, grammar: c.grammar.id, gvariant: c.grammar.variant ?? '', form: c.form ?? null,
          marks: c.draft.marks.map((k) => ({ c: k.char, x: r(k.x), y: r(k.y), s: r(k.size), ...(k.rotate ? { r: r(k.rotate) } : {}), ...(k.keep ? { keep: k.keep } : {}), ...(k.minus ? { minus: 1 } : {}), ...(k.role ? { role: k.role } : {}), ...(k.derived ? { d: k.derived.grammar } : {}), ...(k.grapheme !== undefined ? { g: k.grapheme } : {}), ...(k.context ? { ctx: 1 } : {}) })) })
      } catch (e) { out.push({ text: t.text, set: t.set, variant, error: String(e) }) }
    }
    return out
  })()`)
}
