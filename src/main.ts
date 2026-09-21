/**
 * The shell: a title, an optional reading, one page.
 *
 *   ?title=子供の城&reading=こどものしろ&variant=1   the same page, every time
 *   &debug=1   why the page is as it is, in the console (never on the page)
 *
 * The development sheets are /study.html and /review.html.
 */
import './style.css'
import './glyph/font-face'
import { uncovered } from './glyph/coverage'
import { analyze, compose, OPERATIONS, SPACES } from './poem/compose'
import type { Analysis, Composition } from './poem/types'
import { downloadPNG, renderCanvas } from './render/png'
import { renderSVG } from './render/svg'
import { MAX_TITLE, normalizeTitle, type TitleInput } from './title'

const host = document.getElementById('stage')!
const form = document.getElementById('entry') as HTMLFormElement
const titleField = document.getElementById('title') as HTMLInputElement
const readingField = document.getElementById('reading') as HTMLInputElement
const save = document.getElementById('save') as HTMLButtonElement
const note = document.getElementById('note')!
const about = document.getElementById('about') as HTMLDialogElement
const aboutOpen = document.getElementById('about-open') as HTMLButtonElement
const params = new URLSearchParams(location.search)
const debug = params.has('debug')

let current: { analysis: Analysis; composition: Composition } | null = null
/** only the latest request may draw: a slow page must not replace a newer one */
let ticket = 0

function say(text: string): void {
  note.textContent = text
}

async function show(input: TitleInput): Promise<void> {
  const mine = ++ticket
  const had = document.body.dataset.state
  document.body.dataset.state = 'working'
  say('…')
  try {
    const analysis = await analyze(input)
    if (mine !== ticket) return
    const composition = compose(analysis)
    current = { analysis, composition }
    const stage = renderSVG(host, composition.draft, analysis.glyphs)
    stage.svg.setAttribute('role', 'img')
    stage.svg.setAttribute('aria-label', `「${input.text}」の紙面`)
    document.body.dataset.state = 'shown'
    document.title = `${input.text} — 具体詩`
    say('')
    if (debug) report(analysis, composition)
    const q = new URLSearchParams({ title: input.text })
    if (input.reading) q.set('reading', input.reading)
    if (input.variant) q.set('variant', String(input.variant))
    history.replaceState(null, '', `?${q}`)
  } catch (e) {
    if (mine !== ticket) return
    document.body.dataset.state = had === 'shown' ? 'shown' : 'idle'
    say('紙面をつくれませんでした。もう一度お試しください。')
    console.error(e)
  }
}

/** Why the page is as it is — for study, in the console, only with ?debug. */
function report(a: Analysis, c: Composition): void {
  const ops = [c.primary, ...c.modifiers]
  console.groupCollapsed(`題「${a.input.text}」${a.input.reading ? `（${a.input.reading}）` : ''} — ${ops.map((p) => p.op).join(' + ')} / ${c.spatial.id}`)
  console.log('tokens', a.tokens.map((t) => `${t.surface}/${t.pos}${t.reading ? `(${t.reading})` : ''}`).join(' '))
  console.log('morae', a.morae.map((m) => m.text).join('・'))
  for (const p of ops) {
    const op = OPERATIONS.find((o) => o.id === p.op)!
    console.group(`${op.title}${p === c.primary ? '（主）' : '（修飾）'}`)
    p.evidence.forEach((e) => console.log('根拠:', e))
    op.rules.forEach((r) => console.log('規則:', r))
    console.groupEnd()
  }
  const space = SPACES.find((s) => s.id === c.spatial.id)!
  console.group(`${space.title}（${c.spatial.mode}）`)
  c.spatial.grounds.forEach((g) => console.log('根拠:', g))
  space.rules.forEach((r) => console.log('規則:', r))
  console.groupEnd()
  console.groupEnd()
}

/** a title the work can read, or why not — said quietly, under the entry */
function read(text: string, reading: string, variant = 0): TitleInput | null {
  const input = normalizeTitle({ text, reading, variant })
  if (input === 'empty') {
    titleField.setAttribute('aria-invalid', 'true')
    say('題を書いてください')
    return null
  }
  if (input === 'too-long') {
    titleField.setAttribute('aria-invalid', 'true')
    say(`題は${MAX_TITLE}字までです`)
    return null
  }
  const missing = uncovered(input.text)
  if (missing.length) {
    titleField.setAttribute('aria-invalid', 'true')
    say(`「${missing.join('')}」は、この作品の字体にない字です`)
    return null
  }
  titleField.removeAttribute('aria-invalid')
  return input
}

// Enter that only confirms a conversion must not also send the title
for (const field of [titleField, readingField])
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.isComposing || e.keyCode === 229)) e.preventDefault()
  })

titleField.addEventListener('input', () => {
  if (titleField.hasAttribute('aria-invalid')) {
    titleField.removeAttribute('aria-invalid')
    say('')
  }
})

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const input = read(titleField.value, readingField.value)
  if (!input) return
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

aboutOpen.addEventListener('click', () => about.showModal())
about.addEventListener('click', (e) => {
  // a click on the backdrop closes it
  if (e.target === about) about.close()
})

const titleParam = params.get('title')
if (titleParam) {
  titleField.value = titleParam
  readingField.value = params.get('reading') ?? ''
  const input = read(titleParam, params.get('reading') ?? '', Number(params.get('variant') ?? 0) || 0)
  if (input) void show(input)
} else {
  titleField.focus({ preventScroll: true })
}
