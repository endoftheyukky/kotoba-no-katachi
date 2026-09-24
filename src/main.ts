/**
 * The shell: the name said small, a sheet of paper, one line to write on,
 * and nothing else.
 *
 *   /                                   blank paper and the line
 *   /?title=見えない                     the poem first; 別のことばで試す opens the line
 *   /?title=子供の城&reading=こどものしろ  with its reading
 *   &v=1       the generator that drew it (poem/generators.ts); every address
 *              the page writes names it, and one without it is drawn by the
 *              current generator
 *   &debug=1   why the page is as it is, in the console (never on the page)
 *   /s?title=… the address the share buttons give: the same poem, with a head
 *              written for it on the server (functions/s.ts), so that a link
 *              preview shows its card. Opened, it stays /s, so that an address
 *              copied or shared from the browser keeps its card too.
 *
 * The same words always give the same poem: there is nothing here to redraw,
 * shuffle or vary. Every poem written is a place in the browser's history, so
 * Back and Forward walk through them.
 *
 * A poem someone newly writes is also recorded, after it is drawn and without
 * waiting, in the anonymous archive (archive/record.ts, docs/site.md).
 * Nothing else is: not an address opened, not a 作例 looked at.
 */
import './style.css'
import './glyph/font-face'
import type { Source } from './archive/protocol'
import { record } from './archive/record'
import { uncovered } from './glyph/coverage'
import { analyze, OPERATIONS } from './poem/compose'
import { archiveName, CURRENT, versionOf, write, type Version } from './poem/generators'
import type { Analysis, Composition } from './poem/types'
import { downloadBlob, pngOf, renderCanvas } from './render/png'
import { renderSVG } from './render/svg'
import { MAX_READING, MAX_TITLE, normalizeTitle, type TitleInput } from './title'

const body = document.body
const stage = document.getElementById('stage')!
const form = document.getElementById('entry') as HTMLFormElement
const field = document.getElementById('title') as HTMLInputElement
const caption = document.getElementById('caption')!
const examples = document.getElementById('examples')!
const save = document.getElementById('save') as HTMLButtonElement
const share = document.getElementById('share') as HTMLButtonElement
const shareMenu = document.getElementById('share-menu')!
const shareX = document.getElementById('share-x') as HTMLAnchorElement
const shareOther = document.getElementById('share-other') as HTMLButtonElement
const shareCopy = document.getElementById('share-copy') as HTMLButtonElement
const tryOwn = document.getElementById('try') as HTMLButtonElement
const note = document.getElementById('note')!
const about = document.getElementById('about') as HTMLDialogElement
const aboutOpen = document.getElementById('about-open') as HTMLButtonElement

const params = new URLSearchParams(location.search)
const debug = params.has('debug')
/**
 * The generator new words are written in: the one published now. A poem's own
 * address says which generator drew it, and that one draws it again
 * (poem/generators.ts).
 */
const writing: Version = CURRENT

let current: {
  input: TitleInput
  version: Version
  analysis: Analysis
  composition: Composition
  /** the paper as an image, made once the poem is drawn, so that 保存 can hand it over at once */
  png: Promise<Blob>
  /** the same image once it is made: a share sheet must be asked for within the touch itself */
  file?: File
} | null = null
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
  if (input === 'reading-too-long') return `よみは${MAX_READING}字までです`
  const missing = uncovered(input.text)
  if (missing.length) return `「${missing.join('')}」は、この作品の字体にない字です`
  return input
}

/**
 * The address of a poem: its words, its reading, and the generator that drew
 * it — nothing that could vary it. The version is always written, so that the
 * address keeps its page when another version is published.
 */
function addressOf(input: TitleInput | null, v: Version = writing): string {
  if (!input) return location.pathname
  const q = new URLSearchParams({ title: input.text })
  if (input.reading) q.set('reading', input.reading)
  q.set('v', String(v))
  return `?${q}`
}

const same = (a: TitleInput | null, b: TitleInput | null) => !!a && !!b && a.text === b.text && (a.reading ?? '') === (b.reading ?? '')

/**
 * the address a poem is shared at: /s with its words, reading and version, on
 * the site's own address wherever the page was opened from. /s shows the same
 * poem, and tells a link preview which card is its own (functions/s.ts).
 */
function sharedURL(input: TitleInput, v: Version): string {
  return new URL(`/s${addressOf(input, v)}`, __SITE__.url ? `${__SITE__.url}/` : location.href).href
}

/** the work's own tag, the only one ever added */
const TAG = '#KotobaNoKatachi'

/**
 * what is shared, by every way of sharing, on four lines: the name, the
 * poem's title (the words alone; a reading stays in the address), the tag,
 * its address
 */
function sharedText(input: TitleInput, v: Version): string {
  return `${__SITE__.title}\n「${input.text}」\n${TAG}\n${sharedURL(input, v)}`
}

/** the file name of the paper: the words, with what a file system will not take made plain */
const fileName = (input: TitleInput) => input.text.replace(/[\\/:*?"<>|\s]+/g, '_')

const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean }

/** the row of places to share to, under 共有; it closes when a place is chosen or the poem changes */
function shareRow(open: boolean, refocus = false): void {
  if (open && !current) return
  if (open && current) {
    // X is asked to write the four lines itself: a link card alone would drop the name, the title and the tag
    shareX.href = `https://x.com/intent/post?text=${encodeURIComponent(sharedText(current.input, current.version))}`
    shareOther.hidden = typeof nav.share !== 'function'
    say('')
  }
  shareMenu.hidden = !open
  // the row stands where the note is said
  note.hidden = open
  share.setAttribute('aria-expanded', String(open))
  if (!open && refocus) share.focus()
}

async function copy(text: string, url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    say('コピーしました', true)
  } catch {
    // no clipboard: the address, to be copied by hand
    say(url)
  }
}

function blank(): void {
  ticket++
  current = null
  shareRow(false)
  stage.replaceChildren()
  stage.setAttribute('aria-label', '白い紙面')
  caption.textContent = ''
  body.dataset.state = 'idle'
  delete body.dataset.waiting
  document.title = __SITE__.title
}

/**
 * While a poem is being written, the paper is white. If it takes long enough to
 * be noticed, a single 〓 stands on it — the geta, the mark a compositor sets in
 * the place of a character not yet cast. Nothing moves but its faint breathing.
 */
let waiting: number | undefined
function wait(on: boolean): void {
  clearTimeout(waiting)
  if (!on) {
    delete body.dataset.waiting
    return
  }
  waiting = window.setTimeout(() => (body.dataset.waiting = ''), 280)
}

/**
 * Draw the poem for these words. `source` is given only when someone has just
 * written it (typed words): that poem, and only that one, is recorded in the
 * archive — after it is on the paper, never before.
 */
async function show(input: TitleInput, history: 'push' | 'replace' | 'none', version: Version, source?: Source): Promise<void> {
  const mine = ++ticket
  // the row belonged to the poem that was on the paper; the paper itself is
  // white until the next poem is written — a poem is never shown under words
  // it does not belong to
  shareRow(false)
  say('')
  current = null
  stage.replaceChildren()
  caption.textContent = ''
  body.dataset.state = 'working'
  wait(true)
  try {
    const analysis = await analyze(input)
    if (mine !== ticket) return
    const composition = await write(analysis, version)
    if (mine !== ticket) return
    wait(false)
    const png = new Promise<Blob>((resolve, reject) =>
      window.setTimeout(() => pngOf(renderCanvas(composition.draft, analysis.glyphs)).then(resolve, reject), 0),
    )
    // an image not yet asked for is not an error
    png.catch(() => undefined)
    current = { input, version, analysis, composition, png }
    const held = current
    png.then((blob) => {
      if (typeof File === 'function') held.file = new File([blob], `${fileName(input)}.png`, { type: 'image/png' })
    }, () => undefined)
    const drawn = renderSVG(stage, composition.draft, analysis.glyphs)
    const label = input.reading ? `${input.text}（${input.reading}）` : input.text
    stage.setAttribute('aria-label', `「${label}」の紙面`)
    caption.textContent = `「${label}」`
    body.dataset.state = 'shown'
    // a poem on the paper is looked at first, however it came: the line closes
    // until 別のことばで試す opens it again
    mode('view')
    document.title = `${input.text} — ${__SITE__.title}`
    if (history === 'push') window.history.pushState(null, '', addressOf(input, version))
    if (history === 'replace') window.history.replaceState(null, '', addressOf(input, version))
    if (debug) report(analysis, composition)
    if (source && history === 'push') {
      record({ text: input.text, reading: input.reading ?? '', source, generator: archiveName(version), svg: drawn.svg })
    }
  } catch (e) {
    if (mine !== ticket) return
    wait(false)
    body.dataset.state = 'idle'
    say('紙面をつくれませんでした。もう一度お試しください。')
    console.error(e)
  }
}

/** Why the page is as it is — for study, in the console, only with ?debug. */
function report(a: Analysis, c: Composition): void {
  const ops = [c.primary, ...c.modifiers]
  console.groupCollapsed(`題「${a.input.text}」${a.input.reading ? `（${a.input.reading}）` : ''} — ${ops.map((p) => p.op).join(' + ')}`)
  console.log('tokens', a.tokens.map((t) => `${t.surface}/${t.pos}${t.reading ? `(${t.reading})` : ''}`).join(' '))
  console.log('morae', a.morae.map((m) => m.text).join('・'))
  for (const p of ops) {
    const op = OPERATIONS.find((o) => o.id === p.op)!
    console.group(`${op.title}${p === c.primary ? '（主）' : '（修飾）'}`)
    p.evidence.forEach((e) => console.log('根拠:', e))
    console.groupEnd()
  }
  if (c.parametric.meaning) console.log('meaning', c.parametric.meaning.axes, 'read', c.parametric.meaning.read)
  c.parametric.grounds.forEach((g) => console.log('根拠:', g))
  console.groupEnd()
}

/** what the address asks for: a poem and the generator that draws it, a mistake to be said quietly, or blank paper */
function fromAddress(): { input: TitleInput; version: Version } | string | null {
  const q = new URLSearchParams(location.search)
  const title = q.get('title')
  if (!title) return null
  const input = read(title, q.get('reading') ?? '')
  return typeof input === 'string' ? input : { input, version: versionOf(q.get('v')) }
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
  // the poem already on the paper, by the generator words are written in now:
  // nothing to write again, only to look at
  if (same(input, current?.input ?? null) && current?.version === writing && body.dataset.state === 'shown') {
    mode('view')
    return
  }
  void show(input, 'push', writing, 'manual')
})

// 作例: a poem that already exists, opened at its own address (title, reading,
// version) — as if that address had been followed. Nothing is written anew and
// nothing is recorded. A click that asks for a new tab is left to the link.
examples.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a')
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const q = new URL(a.href).searchParams
  const input = read(q.get('title') ?? '', q.get('reading') ?? '')
  if (typeof input === 'string') return
  e.preventDefault()
  field.value = ''
  window.scrollTo(0, 0)
  mode('view')
  void show(input, 'push', versionOf(q.get('v')))
})

/**
 * 保存. On a phone the image is handed to the system's share sheet, where
 * 「画像を保存」 puts it in Photos (a page cannot write to Photos itself; a plain
 * download would go to Files). Elsewhere it downloads as before. The paper
 * alone: no title, no address, no mark of the site.
 */
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
save.addEventListener('click', async () => {
  if (!current) return
  const name = fileName(current.input)
  let blob: Blob
  try {
    blob = await current.png
  } catch {
    blob = await pngOf(renderCanvas(current.composition.draft, current.analysis.glyphs))
  }
  const file = typeof File === 'function' ? new File([blob], `${name}.png`, { type: 'image/png' }) : null
  if (touch && file && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return
    } catch (e) {
      // closed without saving: nothing to say
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }
  downloadBlob(blob, name)
})

/**
 * On a phone, 共有 hands the paper and the four lines to the system's share
 * sheet at once, where it can take them: a PNG file (the same image 保存
 * gives) with the text. The address is in the text, not given separately, so
 * it is there whichever parts an app keeps — which is the app's own choice.
 * Returns null where this cannot be done; then 共有 opens the row.
 */
function paperShare(): Promise<void> | null {
  if (!touch || !current?.file || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return null
  const data: ShareData = { title: __SITE__.title, text: sharedText(current.input, current.version), files: [current.file] }
  if (!nav.canShare(data)) return null
  return nav.share(data)
}

// 共有: on a phone, the share sheet with the paper (above); elsewhere, or where
// the sheet will not take the paper, the row: X · その他 · コピー. Every one of
// them shares the same four lines — the name, the title, the tag and the address.
share.addEventListener('click', () => {
  if (shareMenu.hidden !== false) {
    const sent = paperShare()
    if (sent) {
      // closed: nothing to say; failed: the row, to share another way
      sent.catch((e: unknown) => (e as DOMException)?.name !== 'AbortError' && shareRow(true))
      return
    }
  }
  shareRow(shareMenu.hidden !== false)
})

// X: its own post screen in a new tab (the link does the opening), the text written in
shareX.addEventListener('click', () => {
  window.setTimeout(() => shareRow(false, true))
})

// その他: the system's share sheet. The four lines go as the text, and the
// address is not given again separately, so it cannot appear twice. Where the
// system takes a file with text (iOS, Android, Safari, Edge / Chrome on
// Windows), the paper goes with them as a PNG — the same image 保存 gives;
// which of the two an app keeps is the app's own choice. Elsewhere, the text.
shareOther.addEventListener('click', async () => {
  if (!current || typeof nav.share !== 'function') return
  const text = sharedText(current.input, current.version)
  const url = sharedURL(current.input, current.version)
  const withPaper: ShareData = { title: __SITE__.title, text, files: current.file ? [current.file] : [] }
  const paper = !!current.file && typeof nav.canShare === 'function' && nav.canShare(withPaper)
  const sent = nav.share(paper ? withPaper : { title: __SITE__.title, text })
  shareRow(false, true)
  try {
    await sent
  } catch (e) {
    // the person closed the sheet: nothing to say
    if ((e as DOMException)?.name === 'AbortError') return
    await copy(text, url)
  }
})

shareCopy.addEventListener('click', () => {
  if (!current) return
  const text = sharedText(current.input, current.version)
  const url = sharedURL(current.input, current.version)
  shareRow(false, true)
  void copy(text, url)
})

// the row closes with Escape, or with a touch anywhere else
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || shareMenu.hidden || about.open) return
  e.preventDefault()
  shareRow(false, shareMenu.contains(document.activeElement) || document.activeElement === share)
})
document.addEventListener('pointerdown', (e) => {
  if (shareMenu.hidden) return
  const t = e.target as Node
  if (!share.contains(t) && !shareMenu.contains(t)) shareRow(false)
})

// 別のことばで試す: the paper is white again at once and the line opens on it.
// The address and the history stay as they are until new words are written
// (then a new entry); Back returns to the poem that was there.
tryOwn.addEventListener('click', () => {
  blank()
  mode('write')
  field.value = ''
  field.removeAttribute('aria-invalid')
  say('')
  field.focus()
})

// About closes with ×, Escape (the dialog's own), or a click outside it; the
// focus goes back to About.
aboutOpen.addEventListener('click', () => {
  // opens at its first line, however far it was read last time
  about.showModal()
  about.scrollTop = 0
})
about.addEventListener('click', (e) => {
  // a click on the backdrop reaches the dialog itself, outside its box
  if (e.target !== about) return
  const r = about.getBoundingClientRect()
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (!inside) about.close()
})
about.addEventListener('close', () => aboutOpen.focus({ preventScroll: true }))

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
  mode('view')
  void show(input.input, 'none', input.version)
})

const first = fromAddress()
if (first && typeof first !== 'string') {
  // arrived at a poem: the poem first, the line later
  mode('view')
  void show(first.input, 'replace', first.version)
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
