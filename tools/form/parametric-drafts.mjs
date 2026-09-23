// dump v4 parametric pages with their soundness, for measuring in node
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  return evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts')
    const I = await import('/src/poem/form/invariants.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts'); const P = await import('/src/study/probes.ts')
    const titles = [...T.STUDY_TITLES.map((t) => ({ ...t, set: 'dev' })), ...H.HOLDOUT_TITLES.map((t) => ({ ...t, set: 'holdout' })), ...P.PROBE_TITLES.map((t) => ({ ...t, set: 'probe' }))]
    const r = (v) => Math.round(v * 100) / 100
    const out = []
    for (const t of titles) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') continue
      try {
        const a = await C.analyze(input)
        const c = C.compose(a, { parametric: 'auto', rhyme: ${process.env.RHYME ?? 'undefined'} })
        const sound = I.soundness(a, c.draft.marks, { repetition: c.primary.op === "proliferation", absent: c.absent, alongCurve: (c.parametric.params.closure ?? 0) >= 0.35 || (c.parametric.params.rows ?? 1) > 1.05 })
        const p = c.parametric.params
        out.push({ text: t.text, reading: t.reading ?? '', set: t.set, variant: 0, space: 'trace', mode: 'v4', grammar: 'uniform', gvariant: '',
          material: { density: +c.parametric.material.density.toFixed(3), fineness: +c.parametric.material.fineness.toFixed(3), onForm: +c.parametric.material.onForm.toFixed(3), onRing: +c.parametric.material.onRing.toFixed(3), onPage: +c.parametric.material.onPage.toFixed(3) }, grains: c.parametric.grains, placed: c.parametric.placed, motif: c.parametric.motif, motifs: Object.fromEntries(Object.entries(c.parametric.motifs).map(([k, v]) => [k, +v.toFixed(3)])), params: { kind: c.parametric.kind, closure: +p.closure.toFixed(3), corners: +p.corners.toFixed(3), opening: +p.opening.toFixed(3), eccentricity: +p.eccentricity.toFixed(3), tangency: +p.tangency.toFixed(3), branch: !!p.branch, rows: +p.rows.toFixed(2), spacing: +p.spacing.toFixed(2), shear: +p.shear.toFixed(2), decay: +p.decay.toFixed(2) },
          paper: { scale: +p.paper.scale.toFixed(3), offset: +p.paper.offset.toFixed(3), toward: +p.paper.toward.toFixed(2), hierarchy: +p.paper.hierarchy.toFixed(2) },
          grounds: c.parametric.grounds, sound,
          marks: c.draft.marks.map((k) => ({ c: k.char, x: r(k.x), y: r(k.y), s: r(k.size), ...(k.rotate ? { r: r(k.rotate) } : {}), ...(k.keep ? { keep: k.keep } : {}), ...(k.grapheme !== undefined ? { g: k.grapheme } : {}) })) })
      } catch (e) { out.push({ text: t.text, set: t.set, variant: 0, error: String(e).slice(0, 200) }) }
    }
    return out
  })()`)
}
