/**
 * The shell: a sheet of paper, one line to write on, and nothing else.
 *
 *   /                                   blank paper and the line
 *   /?title=見えない                     the poem first; 別のことばで試す opens the line
 *   /?title=子供の城&reading=こどものしろ  with its reading
 *   &v=1       the generator as it was frozen at v1 (v2 is the default)
 *   &debug=1   why the page is as it is, in the console (never on the page)
 *
 * The same words always give the same poem: there is nothing here to redraw,
 * shuffle or vary. Every poem written is a place in the browser's history, so
 * Back and Forward walk through them. The development sheets are
 * /study.html and /review.html.
 */
import './style.css'
import './glyph/font-face'
import { uncovered } from './glyph/coverage'
import { analyze, compose, OPERATIONS, SPACES } from './poem/compose'
import type { Analysis, Composition } from './poem/types'
import { downloadPNG, renderCanvas } from './render/png'
import { renderSVG } from './render/svg'
import { MAX_TITLE, normalizeTitle, type TitleInput } from './title'

const body = document.body
const stage = document.getElementById('stage')!
const form = document.getElementById('entry') as HTMLFormElement
const field = document.getElementById('title') as HTMLInputElement
const caption = document.getElementById('caption')!
const examples = document.getElementById('examples')!
const save = document.getElementById('save') as HTMLButtonElement
const share = document.getElementById('share') as HTMLButtonElement
const tryOwn = document.getElementById('try') as HTMLButtonElement
const note = document.getElementById('note')!
const about = document.getElementById('about') as HTMLDialogElement
const aboutOpen = document.getElementById('about-open') as HTMLButtonElement

const params = new URLSearchParams(location.search)
const debug = params.has('debug')
/** which generator writes the page: v2 (mark grammars) unless v1 is asked for */
const version = params.get('v') === '1' ? 1 : 2

let current: { input: TitleInput; analysis: Analysis; composition: Composition } | null = null
/** only the latest request may draw: a slow page must not replace a newer one */
let ticket = 0
let quiet: number | undefined

/** a line under the paper, said quietly; `fade` lets it go by itself */
function say(text: string, fade = false): void {
  note.textContent = text
  clearTimeout(quiet)
  if (fade && text) quiet = window.setTimeout(() => (note.textContent = ''), 2400)
}

/** write: the line is open. view: a poem is on the paper and is looked at first (保存 · 共有 · 別のことばで試す) */
function mode(m: 'write' | 'view'): void {
  body.dataset.mode = m
}

/**
 * One line holds the words and, optionally, their reading in brackets after
 * them — 子供の城（こどものしろ）. Anything else in brackets is part of the words.
 */
function parse(value: string): { text: string; reading: string } {
  const m = /^(.*\S)\s*[（(]\s*([\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+)\s*[）)]\s*$/u.exec(value)
  return m ? { text: m[1], reading: m[2] } : { text: value, reading: '' }
}

/** words the work can write, or why not */
function read(text: string, reading: string): TitleInput | string {
  const input = normalizeTitle({ text, reading })
  if (input === 'empty') return 'ことばを入力してください'
  if (input === 'too-long') return `ことばは${MAX_TITLE}字までです`
  const missing = uncovered(input.text)
  if (missing.length) return `「${missing.join('')}」は、この作品の字体にない字です`
  return input
}

/** the address of a poem: its words and reading, and nothing that could vary it */
function addressOf(input: TitleInput | null): string {
  if (!input) return version === 1 ? '?v=1' : location.pathname
  const q = new URLSearchParams({ title: input.text })
  if (input.reading) q.set('reading', input.reading)
  if (version === 1) q.set('v', '1')
  return `?${q}`
}

const same = (a: TitleInput | null, b: TitleInput | null) => !!a && !!b && a.text === b.text && (a.reading ?? '') === (b.reading ?? '')

function blank(): void {
  ticket++
  current = null
  stage.replaceChildren()
  stage.setAttribute('aria-label', '白い紙面')
  caption.textContent = ''
  body.dataset.state = 'idle'
  document.title = __SITE__.title
}

async function show(input: TitleInput, history: 'push' | 'replace' | 'none'): Promise<void> {
  const mine = ++ticket
  const was = body.dataset.state
  body.dataset.state = 'working'
  say('')
  try {
    const analysis = await analyze(input)
    if (mine !== ticket) return
    const composition = compose(analysis, version === 2 ? { grammar: 'auto' } : {})
    current = { input, analysis, composition }
    renderSVG(stage, composition.draft, analysis.glyphs)
    const label = input.reading ? `${input.text}（${input.reading}）` : input.text
    stage.setAttribute('aria-label', `「${label}」の紙面`)
    caption.textContent = `「${label}」`
    body.dataset.state = 'shown'
    // a poem on the paper is looked at first, however it came: the line closes
    // until 別のことばで試す opens it again
    mode('view')
    // once a poem has been written, the examples have done their work
    examples.hidden = true
    document.title = `${input.text} — ${__SITE__.title}`
    if (history === 'push') window.history.pushState(null, '', addressOf(input))
    if (history === 'replace') window.history.replaceState(null, '', addressOf(input))
    if (debug) report(analysis, composition)
  } catch (e) {
    if (mine !== ticket) return
    body.dataset.state = was === 'shown' ? 'shown' : 'idle'
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
  console.group(`字の振る舞い: ${c.grammar.id}${c.grammar.variant ? ` / ${c.grammar.variant}` : ''}`)
  c.grammar.grounds.forEach((g) => console.log('根拠:', g))
  Object.entries(c.grammar.derived).forEach(([k, n]) => console.log('派生:', k, n))
  console.groupEnd()
  console.groupEnd()
}

/** what the address asks for: a poem, a mistake to be said quietly, or blank paper */
function fromAddress(): TitleInput | string | null {
  const q = new URLSearchParams(location.search)
  const title = q.get('title')
  if (!title) return null
  return read(title, q.get('reading') ?? '')
}

// Enter writes the poem — but an Enter that only confirms a conversion must not also send the words
field.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  if (e.isComposing || e.keyCode === 229) return
  form.requestSubmit()
})

field.addEventListener('input', () => {
  if (field.hasAttribute('aria-invalid')) {
    field.removeAttribute('aria-invalid')
    say('')
  }
})

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const { text, reading } = parse(field.value)
  const input = read(text, reading)
  if (typeof input === 'string') {
    field.setAttribute('aria-invalid', 'true')
    say(input)
    return
  }
  field.removeAttribute('aria-invalid')
  // the keyboard would keep covering the poem
  field.blur()
  // the poem already on the paper: nothing to write again, only to look at
  if (same(input, current?.input ?? null) && body.dataset.state === 'shown') {
    mode('view')
    return
  }
  void show(input, 'push')
})

examples.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a')
  if (!a) return
  e.preventDefault()
  const input = read(a.textContent ?? '', '')
  if (typeof input === 'string') return
  field.value = input.text
  void show(input, 'push')
})

save.addEventListener('click', () => {
  if (!current) return
  // the paper alone: no title, no address, no mark of the site
  const name = current.input.text.replace(/[\\/:*?"<>|\s]+/g, '_')
  downloadPNG(renderCanvas(current.composition.draft, current.analysis.glyphs), name)
})

share.addEventListener('click', async () => {
  if (!current) return
  // the poem's canonical address: the site's own, wherever the page was opened from
  const url = new URL(addressOf(current.input), __SITE__.url ? `${__SITE__.url}/` : location.href).href
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      // the name as text too: some places a link is shared to ignore the title
      await nav.share({ title: __SITE__.title, text: __SITE__.title, url })
      return
    } catch (e) {
      // the person closed the sheet: nothing to say
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(`${__SITE__.title}\n${url}`)
    say('リンクをコピーしました', true)
  } catch {
    say(url)
  }
})

// 別のことばで試す: the line opens again on this page. The address and the
// history stay as they are until new words are written (then a new entry).
tryOwn.addEventListener('click', () => {
  mode('write')
  field.value = ''
  field.removeAttribute('aria-invalid')
  say('')
  field.focus()
})

aboutOpen.addEventListener('click', () => about.showModal())
about.addEventListener('click', (e) => {
  // a click on the backdrop closes it
  if (e.target === about) about.close()
})

// Back and Forward: the poem at that address, drawn again the same
window.addEventListener('popstate', () => {
  const input = fromAddress()
  if (!input) {
    blank()
    mode('write')
    field.value = ''
    say('')
    return
  }
  if (typeof input === 'string') {
    say(input)
    return
  }
  void show(input, 'none')
})

const first = fromAddress()
if (first && typeof first !== 'string') {
  // arrived at a poem: the poem first, the line later
  mode('view')
  void show(first, 'replace')
} else {
  mode('write')
  blank()
  if (typeof first === 'string') {
    const q = new URLSearchParams(location.search)
    field.value = q.get('reading') ? `${q.get('title')}（${q.get('reading')}）` : (q.get('title') ?? '')
    field.setAttribute('aria-invalid', 'true')
    say(first)
  }
}
