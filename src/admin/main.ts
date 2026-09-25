/**
 * Generations — the archive of pages people wrote, for looking at.
 *
 *   /admin/                     every page, newest first (or oldest), by title
 *   /admin/?visitor=<id>        one browser profile: its visits in order, each with its pages
 *   /admin/?session=<id>        one visit: the pages in the order they were written
 *   …&id=<event>                one page, large, with everything recorded about it;
 *                               ‹ › (or the arrow keys) to the page before and after it
 *   …&hide=mine                 every browser but this one
 *
 * Above every page: the last fourteen days (the viewer's own days) and the
 * words written by the most browsers. A browser that has written on the work
 * itself knows its own id there (archive/record.ts): its records are marked
 * "you", and can be left out.
 *
 * The pages are the snapshots kept when they were written (never redrawn by
 * today's generator); each is fetched when it comes near the screen and checked
 * again before it is shown (check.ts). Numbers stay small; the sheets are the work.
 */
import '../glyph/font-face'
import './style.css'
import { paper } from './check'

interface Row {
  id: string
  created_at: number
  client_created_at: number | null
  visitor_id: string
  session_id: string
  title: string
  reading: string
  source: string
  generator_version: string
  output_hash: string
  bytes?: number | null
}
interface Page {
  items: Row[]
  next: string | null
}
interface Span {
  id: string
  first_at: number
  last_at: number
  generations: number
}
interface Visitor extends Span {
  sessions: Span[]
}
interface Session extends Span {
  visitor_id: string
  number: number
}

const byId = (id: string) => document.getElementById(id)!
const sheets = byId('sheets')
const context = byId('context')
const filters = byId('filters')
const more = byId('more')
const status = byId('status')
const totals = byId('totals')
const detail = byId('detail') as HTMLDialogElement
const search = byId('q') as HTMLInputElement
const overview = byId('overview')
const hideMine = byId('hide-mine') as HTMLButtonElement
const prev = byId('prev') as HTMLButtonElement
const next = byId('next') as HTMLButtonElement

/** this browser's own id on the work (archive/record.ts), if it has written there */
const me = (() => {
  try {
    const id = localStorage.getItem('kotoba:visitor') ?? ''
    return /^[0-9a-f-]{36}$/.test(id) ? id : ''
  } catch {
    return ''
  }
})()
hideMine.hidden = !me

// --- words -------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')
const day = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}
const clock = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const stamp = (ms: number) => `${day(ms)} ${clock(ms)}`
const seconds = (ms: number) => `${stamp(ms)}:${pad(new Date(ms).getSeconds())}`
const gap = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 3600 ? `+${Math.floor(s / 60)}:${pad(s % 60)}` : `+${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`
}
const short = (id: string) => id.slice(0, 4).toUpperCase()
const visitorName = (id: string) => `Visitor ${short(id)}`
const quoted = (r: Row) => `「${r.title}」`
const count = (n: number, one: string) => `${n.toLocaleString('en')} ${one}${n === 1 ? '' : 's'}`

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

/** a link inside the sheet: followed without leaving the page */
function link(query: Record<string, string>, text: string): HTMLAnchorElement {
  const a = el('a', 'nav', text)
  a.href = `/admin/?${new URLSearchParams(query)}`
  return a
}

// --- the server ----------------------------------------------------------------

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (res.status === 401) {
    location.href = '/admin/login'
    throw new Error('signed out')
  }
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}

// snapshots: a few at a time, each once
const kept = new Map<string, Promise<string | null>>()
const queue: Array<() => void> = []
let running = 0
function snapshot(id: string): Promise<string | null> {
  let p = kept.get(id)
  if (!p) {
    p = new Promise<void>((go) => (running < 6 ? (running++, go()) : queue.push(go)))
      .then(() => fetch(`/admin/api/generations/${id}/svg`, { credentials: 'same-origin' }))
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .finally(() => {
        const next = queue.shift()
        if (next) next()
        else running--
      })
    kept.set(id, p)
  }
  return p
}

let prefixes = 0
async function draw(host: HTMLElement, id: string): Promise<void> {
  const markup = await snapshot(id)
  const svg = markup ? paper(markup, `p${prefixes++}-`) : null
  host.replaceChildren(svg ?? el('span', 'none', 'no snapshot'))
}

const near = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      near.unobserve(e.target)
      const host = e.target as HTMLElement
      void draw(host, host.dataset.id!)
    }
  },
  { rootMargin: '800px 0px' },
)

// --- a sheet -----------------------------------------------------------------------

interface CardOptions {
  /** when: the full date and time, or the time of day only (inside a visit) */
  when: 'stamp' | 'clock'
  visitor?: boolean
  step?: number
  since?: number
}

function card(r: Row, o: CardOptions): HTMLElement {
  const a = el('article', 'card')
  if (o.step !== undefined) {
    const s = el('p', 'step', String(o.step))
    if (o.since !== undefined) s.append(el('span', 'since', gap(o.since)))
    a.append(s)
  }
  const open = el('button', 'sheet')
  open.type = 'button'
  open.setAttribute('aria-label', `${quoted(r)}、${stamp(r.created_at)}`)
  const p = el('div', 'paper')
  p.dataset.id = r.id
  near.observe(p)
  open.append(p)
  open.addEventListener('click', () => openDetail(r.id, true))
  a.append(open, el('p', 'title', quoted(r)), el('p', 'time', o.when === 'stamp' ? stamp(r.created_at) : clock(r.created_at)))
  const meta = el('p', 'meta')
  if (o.visitor) meta.append(link({ visitor: r.visitor_id }, visitorName(r.visitor_id)), ' · ')
  meta.append(r.source)
  if (me && r.visitor_id === me) meta.append(' · ', el('span', 'you', 'you'))
  a.append(meta)
  return a
}

// --- where we are ----------------------------------------------------------------------

interface View {
  visitor: string
  session: string
  order: 'newest' | 'oldest'
  q: string
  hide: '' | 'mine'
  id: string
}

function view(): View {
  const p = new URLSearchParams(location.search)
  return {
    visitor: p.get('visitor') ?? '',
    session: p.get('session') ?? '',
    order: p.get('order') === 'oldest' ? 'oldest' : 'newest',
    q: p.get('q') ?? '',
    hide: me && p.get('hide') === 'mine' ? 'mine' : '',
    id: p.get('id') ?? '',
  }
}

function address(v: Partial<View>): string {
  const p = new URLSearchParams()
  for (const [k, val] of Object.entries(v)) if (val && !(k === 'order' && val === 'newest')) p.set(k, val)
  const s = p.toString()
  return s ? `/admin/?${s}` : '/admin/'
}

let loadMore: (() => Promise<void>) | null = null
let listed = ''
let turn = 0

async function render(): Promise<void> {
  const v = view()
  if (v.id) void openDetail(v.id, false)
  else if (detail.open) detail.close()
  const key = JSON.stringify({ ...v, id: '' })
  if (key === listed) return
  listed = key
  const mine = ++turn
  sheets.replaceChildren()
  more.hidden = true
  status.textContent = ''
  loadMore = null
  filters.hidden = !!(v.visitor || v.session)
  overview.hidden = !!(v.visitor || v.session)
  context.hidden = !(v.visitor || v.session)
  context.replaceChildren()
  try {
    if (v.session) await sessionView(v, mine)
    else if (v.visitor) await visitorView(v, mine)
    else await archiveView(v, mine)
  } catch (e) {
    if (mine === turn) status.textContent = '読み込めませんでした'
    console.warn(e)
  }
}

async function pages(params: Record<string, string>, mine: number, each: (r: Row) => void): Promise<void> {
  let cursor: string | null = null
  const load = async () => {
    const q = new URLSearchParams(params)
    if (cursor) q.set('cursor', cursor)
    const page = await api<Page>(`/admin/api/generations?${q}`)
    if (mine !== turn) return
    page.items.forEach(each)
    cursor = page.next
    more.hidden = !cursor
    loadMore = cursor ? load : null
    if (detail.open) steps(view().id)
  }
  await load()
}

// every page, as a field
async function archiveView(v: View, mine: number): Promise<void> {
  for (const b of filters.querySelectorAll<HTMLButtonElement>('[data-order]')) b.setAttribute('aria-pressed', String(b.dataset.order === v.order))
  if (document.activeElement !== search) search.value = v.q
  hideMine.setAttribute('aria-pressed', String(v.hide === 'mine'))
  void showOverview(v.hide === 'mine' ? me : '')
  const grid = el('div', 'grid')
  sheets.append(grid)
  const params: Record<string, string> = { order: v.order, limit: '40' }
  if (v.q) params.q = v.q
  if (v.hide === 'mine') params.exclude = me
  await pages(params, mine, (r) => grid.append(card(r, { when: 'stamp', visitor: true })))
  if (mine === turn && !grid.children.length) status.textContent = v.q ? '該当する記録はありません' : 'まだ記録はありません'
}

// --- the archive at a glance -----------------------------------------------------------

interface Overview {
  today: string
  days: Array<{ day: string; generations: number; visitors: number }>
  words: Array<{ title: string; generations: number; visitors: number }>
}

/** the browser left out of the overview on screen; null until one is shown (or after refresh) */
let overviewFor: string | null = null

async function showOverview(exclude: string): Promise<void> {
  if (overviewFor === exclude) return
  overviewFor = exclude
  const q = new URLSearchParams({ tz: String(new Date().getTimezoneOffset()), days: '14' })
  if (exclude) q.set('exclude', exclude)
  let o: Overview
  try {
    o = await api<Overview>(`/admin/api/overview?${q}`)
  } catch (e) {
    overviewFor = null
    console.warn(e)
    return
  }
  if (overviewFor !== exclude) return
  const today = o.days.at(-1)!
  const sum = o.days.reduce((n, d) => n + d.generations, 0)
  const head = el('p', 'sum', `today ${count(today.generations, 'generation')} · ${count(today.visitors, 'visitor')} — ${o.days.length} days ${count(sum, 'generation')}`)
  const top = Math.max(1, ...o.days.map((d) => d.generations))
  const days = el('div', 'days')
  for (const d of o.days) {
    const col = el('div', d.day === o.today ? 'day today' : 'day')
    col.title = `${d.day.replace(/-/g, '.')} · ${count(d.generations, 'generation')} · ${count(d.visitors, 'visitor')}`
    const column = el('span', 'column')
    const bar = el('span', 'bar')
    bar.style.height = `${(d.generations / top) * 100}%`
    column.append(bar)
    col.append(column, el('span', 'n', d.generations ? String(d.generations) : ''), el('span', 'date', String(Number(d.day.slice(8)))))
    days.append(col)
  }
  const words = el('p', 'words')
  words.append(el('span', 'label', 'words'))
  for (const w of o.words) {
    const b = el('button', 'word')
    b.type = 'button'
    b.title = `${count(w.visitors, 'visitor')} · ${count(w.generations, 'generation')}`
    b.append(w.title, el('span', 'n', String(w.visitors)))
    b.addEventListener('click', () => {
      search.value = w.title
      history.replaceState(null, '', address({ ...view(), q: w.title, id: '' }))
      void render()
    })
    words.append(b)
  }
  overview.replaceChildren(head, days, ...(o.words.length ? [words] : []))
}

function heading(title: string, sub: string, ...extra: Node[]): void {
  const h = el('h1', '', title)
  h.append(...extra)
  context.append(link({}, '← Generations'), h, el('p', 'sub', sub))
}

// one browser profile: its visits, in order, each with its pages
async function visitorView(v: View, mine: number): Promise<void> {
  const who = await api<Visitor>(`/admin/api/visitors/${encodeURIComponent(v.visitor)}`)
  if (mine !== turn) return
  heading(
    visitorName(who.id) + (who.id === me ? ' (you)' : ''),
    `${count(who.generations, 'generation')} · ${count(who.sessions.length, 'session')} · ${stamp(who.first_at)} – ${stamp(who.last_at)}`,
  )
  const number = new Map(who.sessions.map((s, i) => [s.id, i + 1]))
  const spans = new Map(who.sessions.map((s) => [s.id, s]))
  const rows = new Map<string, HTMLElement>()
  await pages({ visitor: v.visitor, order: 'oldest', limit: '100' }, mine, (r) => {
    let row = rows.get(r.session_id)
    if (!row) {
      const s = spans.get(r.session_id)
      const section = el('section', 'visit')
      const h = el('h2')
      h.append(link({ session: r.session_id }, `Session ${number.get(r.session_id) ?? '?'}`))
      if (s) h.append(el('span', '', ` · ${day(s.first_at)} ${clock(s.first_at)}–${clock(s.last_at)} · ${count(s.generations, 'generation')}`))
      row = el('div', 'grid')
      section.append(h, row)
      sheets.append(section)
      rows.set(r.session_id, row)
    }
    row.append(card(r, { when: 'clock' }))
  })
}

// one visit: the order in which things were tried
async function sessionView(v: View, mine: number): Promise<void> {
  const s = await api<Session>(`/admin/api/sessions/${encodeURIComponent(v.session)}`)
  if (mine !== turn) return
  heading(`Session ${s.number}`, `${day(s.first_at)} ${clock(s.first_at)}–${clock(s.last_at)} · ${count(s.generations, 'generation')} · `)
  context.querySelector('.sub')!.append(link({ visitor: s.visitor_id }, visitorName(s.visitor_id)))
  const grid = el('div', 'grid sequence')
  sheets.append(grid)
  let step = 0
  let previous: number | undefined
  await pages({ session: v.session, order: 'oldest', limit: '100' }, mine, (r) => {
    grid.append(card(r, { when: 'clock', step: ++step, since: previous === undefined ? undefined : r.created_at - previous }))
    previous = r.created_at
  })
}

// --- one page, large ------------------------------------------------------------------------

let pushedDetail = false

async function openDetail(id: string, push: boolean): Promise<void> {
  if (push) {
    const p = new URLSearchParams(location.search)
    p.set('id', id)
    history.pushState(null, '', `/admin/?${p}`)
    pushedDetail = true
  }
  const big = detail.querySelector<HTMLElement>('.big')!
  const dl = detail.querySelector('dl')!
  big.replaceChildren()
  dl.replaceChildren()
  if (!detail.open) detail.showModal()
  steps(id)
  try {
    const r = await api<Row>(`/admin/api/generations/${encodeURIComponent(id)}`)
    const shared = new URLSearchParams({ title: r.title })
    if (r.reading) shared.set('reading', r.reading)
    // the version the snapshot was drawn by, as its address names it (v1 → v=1)
    const version = /^v(\d+)$/.exec(r.generator_version)
    if (version) shared.set('v', version[1])
    const page = el('a', '', '公開ページで開く')
    page.href = `${__SITE__.url || location.origin}/?${shared}`
    page.target = '_blank'
    page.rel = 'noopener'
    const entries: Array<[string, string | Node]> = [
      ['title', quoted(r)],
      ['reading', r.reading || '—'],
      ['created', seconds(r.created_at)],
      ['browser clock', r.client_created_at ? seconds(r.client_created_at) : '—'],
      ['visitor', link({ visitor: r.visitor_id }, visitorName(r.visitor_id))],
      ['session', link({ session: r.session_id }, `Session ${short(r.session_id)}`)],
      ['source', r.source],
      ['generator', r.generator_version],
      ['output hash', r.output_hash],
      ['snapshot', r.bytes ? `${r.bytes.toLocaleString('en')} characters` : '—'],
      ['', page],
    ]
    for (const [k, val] of entries) {
      const dd = el('dd', k === 'output hash' ? 'hash' : '')
      dd.append(val)
      dl.append(el('dt', '', k), dd)
    }
    await draw(big, r.id)
  } catch (e) {
    dl.append(el('dd', '', '読み込めませんでした'))
    console.warn(e)
  }
}

detail.addEventListener('close', () => {
  const id = view().id
  if (!id) return
  // the page just looked at stays in view in the list
  sheets.querySelector(`.paper[data-id="${CSS.escape(id)}"]`)?.closest('.card')?.scrollIntoView({ block: 'nearest' })
  if (pushedDetail) history.back()
  else {
    const p = new URLSearchParams(location.search)
    p.delete('id')
    history.replaceState(null, '', address(Object.fromEntries(p) as Partial<View>))
  }
  pushedDetail = false
})

/** the pages in the list, in the order they stand on the screen */
const listedIds = () => [...sheets.querySelectorAll<HTMLElement>('.paper[data-id]')].map((p) => p.dataset.id!)

/** ‹ and ›: whether there is a page before and after this one (after: perhaps not loaded yet) */
function steps(id: string): void {
  const ids = listedIds()
  const i = ids.indexOf(id)
  prev.disabled = i <= 0
  next.disabled = i < 0 || (i === ids.length - 1 && !loadMore)
}

/** to the page before or after the one shown, in the list's own order, loading more at its end */
async function go(by: -1 | 1): Promise<void> {
  const id = view().id
  if (!id) return
  let ids = listedIds()
  if (ids.indexOf(id) < 0) return
  if (ids.indexOf(id) + by >= ids.length && loadMore) {
    await loadMore()
    ids = listedIds()
  }
  const to = ids[ids.indexOf(id) + by]
  if (!to) return
  const p = new URLSearchParams(location.search)
  p.set('id', to)
  history.replaceState(null, '', `/admin/?${p}`)
  void openDetail(to, false)
}

prev.addEventListener('click', () => void go(-1))
next.addEventListener('click', () => void go(1))
detail.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    void go(e.key === 'ArrowLeft' ? -1 : 1)
  }
})

detail.addEventListener('click', (e) => {
  if (e.target !== detail) return
  const r = detail.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) detail.close()
})

// --- moving about --------------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest?.('a.nav, #home') as HTMLAnchorElement | null
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (detail.open) {
    // leave the page for the view it points to; the entry for the page itself is replaced
    pushedDetail = false
    detail.close()
  }
  history.pushState(null, '', a.href)
  void render()
})

filters.addEventListener('click', (e) => {
  const b = (e.target as Element).closest('button')
  if (!b) return
  const v = view()
  if (b.dataset.order) v.order = b.dataset.order as View['order']
  if (b === hideMine) v.hide = v.hide ? '' : 'mine'
  history.replaceState(null, '', address({ ...v, id: '' }))
  void render()
})

let typing: number | undefined
search.addEventListener('input', () => {
  clearTimeout(typing)
  typing = window.setTimeout(() => {
    history.replaceState(null, '', address({ ...view(), q: search.value.trim(), id: '' }))
    void render()
  }, 300)
})

more.querySelector('button')!.addEventListener('click', async (e) => {
  const b = e.currentTarget as HTMLButtonElement
  if (!loadMore) return
  b.disabled = true
  try {
    await loadMore()
  } catch (err) {
    status.textContent = '読み込めませんでした'
    console.warn(err)
  } finally {
    b.disabled = false
  }
})

window.addEventListener('popstate', () => void render())

function showTotals(): void {
  void api<{ generations: number; visitors: number; sessions: number }>('/admin/api/stats')
    .then((t) => (totals.textContent = `${count(t.generations, 'generation')} · ${count(t.visitors, 'visitor')} · ${count(t.sessions, 'session')}`))
    .catch((e) => console.warn(e))
}

// refresh: the totals, the overview and the list read again (snapshots never change, and stay)
byId('refresh').addEventListener('click', () => {
  listed = ''
  overviewFor = null
  showTotals()
  void render()
})

showTotals()
void render()
