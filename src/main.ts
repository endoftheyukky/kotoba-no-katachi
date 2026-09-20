/**
 * The shell: a title, an optional reading, one page.
 *
 * Study parameters (not part of the work):
 *   ?title=子供の城&reading=こどものしろ&variant=1
 *   &op=proliferation|decomposition|transformation|absence   force the primary operation
 *   &space=field|band|radial|axis|centre|void|scattered|cluster   force the spatial composition
 * The development study sheet is /study.html.
 */
import './style.css'
import './glyph/font-face'
import { compose, analyze, OPERATIONS, SPACES, type Force } from './poem/compose'
import type { Analysis, Composition, OperationId, SpatialId } from './poem/types'
import { downloadPNG, renderCanvas } from './render/png'
import { renderSVG } from './render/svg'
import { normalizeTitle, type TitleInput } from './title'

const host = document.getElementById('stage')!
const form = document.getElementById('entry') as HTMLFormElement
const titleField = document.getElementById('title') as HTMLInputElement
const readingField = document.getElementById('reading') as HTMLInputElement
const save = document.getElementById('save') as HTMLButtonElement
const params = new URLSearchParams(location.search)

let current: { analysis: Analysis; composition: Composition } | null = null

function force(): Force {
  return {
    op: (params.get('op') as OperationId | null) ?? undefined,
    space: (params.get('space') as SpatialId | null) ?? undefined,
  }
}

async function make(input: TitleInput): Promise<{ analysis: Analysis; composition: Composition }> {
  const analysis = await analyze(input)
  const composition = compose(analysis, force())
  return { analysis, composition }
}

async function show(input: TitleInput): Promise<void> {
  current = await make(input)
  renderSVG(host, current.composition.draft, current.analysis.glyphs)
  document.body.dataset.state = 'shown'
  report(current.analysis, current.composition)
  const q = new URLSearchParams({ title: input.text })
  if (input.reading) q.set('reading', input.reading)
  if (input.variant) q.set('variant', String(input.variant))
  history.replaceState(null, '', `?${q}`)
}

/** Why the page is as it is — for study, in the console, never on the page. */
function report(a: Analysis, c: Composition): void {
  const ops = [c.primary, ...c.modifiers]
  console.groupCollapsed(`題「${a.input.text}」${a.input.reading ? `（${a.input.reading}）` : ''} — ${ops.map((p) => p.op).join(' + ')} / ${c.spatial.id}`)
  console.log('tokens', a.tokens.map((t) => `${t.surface}/${t.pos}${t.reading ? `(${t.reading})` : ''}`).join(' '))
  console.log('morae', a.morae.map((m) => m.text).join('・'), a.readingAligned ? '' : '（読みを字に対応づけられませんでした）')
  console.log('relations', a.relations)
  console.log('glyph readings', a.glyphRelations.slice(0, 5).map((r) => `${r.inner}${r.kind === 'similarity' ? '≈' : '⊂'}${r.outer} ${r.score.toFixed(2)}`))
  for (const p of ops) {
    const op = OPERATIONS.find((o) => o.id === p.op)!
    console.group(
      `${op.title}${p === c.primary ? '（主）' : '（修飾）'} poetic ${p.poeticPotential?.toFixed(2)} = √(linguistic ${p.linguisticSalience.value.toFixed(2)} × visual ${p.visualPotential?.value.toFixed(2)})`,
    )
    p.evidence.forEach((e) => console.log('根拠:', e))
    op.rules.forEach((r) => console.log('規則:', r))
    console.groupEnd()
  }
  const space = SPACES.find((s) => s.id === c.spatial.id)!
  console.group(`${space.title}（紙面構成・${c.spatial.mode}） ${c.spatial.fitness.toFixed(2)} / scale ${c.scale.regime}: ${c.scale.grounds}`)
  c.spatial.grounds.forEach((g) => console.log('根拠:', g))
  space.rules.forEach((r) => console.log('規則:', r))
  console.groupEnd()
  console.groupEnd()
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const input = normalizeTitle({ text: titleField.value, reading: readingField.value })
  if (typeof input === 'string') {
    titleField.setAttribute('aria-invalid', 'true')
    return
  }
  titleField.removeAttribute('aria-invalid')
  titleField.blur()
  readingField.blur()
  void show(input)
})

save.addEventListener('click', () => {
  if (!current) return
  const { composition, analysis } = current
  const name = composition.input.text + (composition.input.variant ? `-${composition.input.variant}` : '')
  downloadPNG(renderCanvas(composition.draft, analysis.glyphs), name)
})

const titleParam = params.get('title')
if (titleParam) {
  titleField.value = titleParam
  readingField.value = params.get('reading') ?? ''
  const input = normalizeTitle({
    text: titleParam,
    reading: params.get('reading') ?? undefined,
    variant: Number(params.get('variant') ?? 0),
  })
  if (typeof input !== 'string') void show(input)
}
