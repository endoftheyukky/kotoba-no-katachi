/**
 * Development study sheet (not part of the work).
 * Each title's page is drawn alone, without any text on it; what the system
 * read and decided is written beside it.
 *
 *   /study.html                 all study titles
 *   /study.html?variant=1       the next alternative reading of each
 *   /study.html?only=嘘|海のあと  a subset
 *   /study.html?view=grid       pages only, as a contact sheet
 */
import './study.css'
import '../glyph/font-face'
import type { Relation } from '../language/analysis'
import { analyze, compose, MODIFIER_SALIENCE, OPERATIONS, SPACES } from '../poem/compose'
import type { Analysis, Composition, Proposal } from '../poem/types'
import { renderCanvas } from '../render/png'
import { renderSVG } from '../render/svg'
import { normalizeTitle } from '../title'
import { STUDY_TITLES, type StudyTitle } from './titles'

const params = new URLSearchParams(location.search)
const variant = Number(params.get('variant') ?? 0)
const only = params.get('only')?.split('|')
const titles = only ? STUDY_TITLES.filter((t) => only.includes(t.text)) : STUDY_TITLES
const grid = params.get('view') === 'grid'

const opTitle = (id: string) => OPERATIONS.find((o) => o.id === id)?.title ?? id
const spaceTitle = (id: string) => SPACES.find((s) => s.id === id)?.title ?? id
const POS: Record<string, string> = {
  noun: '名', particle: '助', conjunction: '接', verb: '動', adjective: '形', symbol: '記', other: '他',
}
const f2 = (v: number) => v.toFixed(2)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function row(dl: HTMLElement, term: string, value: string): void {
  dl.append(el('dt', undefined, term), el('dd', undefined, value))
}

function relationLabel(a: Analysis, r: Relation): string {
  const t = (i: number) => a.tokens[i]?.surface ?? '?'
  switch (r.kind) {
    case 'recurrence':
      return `recurrence ${{ grapheme: '字', mora: '拍', vowel: '母音' }[r.unit]}「${r.value}」×${r.members.length}`
    case 'dependency':
      return `dependency ${t(r.dependent)} →${t(r.marker)}→ ${t(r.head)}`
    case 'coordination':
      return `coordination ${t(r.left)} ${t(r.marker)} ${t(r.right)}`
    case 'relationWord':
      return `relationWord「${t(r.token)}」`
    case 'silence':
      return `silence「${a.morae[r.mora].text}」`
    case 'reduplication':
      return `reduplication「${r.value}」×${r.occurrences.length}`
    case 'mirror':
      return 'mirror（回文）'
    case 'negation':
      return `negation「${t(r.token)}」`
    case 'separation':
      return `separation ${t(r.left)} ␣ ${t(r.right)}`
    case 'imperative':
      return `imperative「${t(r.token)}」`
    case 'inflection':
      return `inflection「${t(r.token)}」語幹|活用語尾`
  }
}

/**
 * a proposal: poeticPotential = √(linguisticSalience × visualPotential), then
 * each measure with its components
 */
function proposalLine(p: Proposal, status: 'primary' | 'modifier' | 'offered', reason?: string): HTMLElement {
  const li = el('li', status)
  const s = p.linguisticSalience
  const v = p.visualPotential
  li.append(
    el('span', 'op', opTitle(p.op)),
    el('span', 'sal', `poetic ${f2(p.poeticPotential ?? 0)}`),
    el('div', 'parts', `linguistic ${f2(s.value)} = rs ${f2(s.relationStrength)} · d ${f2(s.distinctiveness)} · cov ${f2(s.coverage)}`),
    el('div', 'parts', v ? `visual ${f2(v.value)} = legibility ${f2(v.legibility)} × structure ${f2(v.structure)}` : ''),
  )
  li.append(el('div', 'rel', p.relations.join('  ')))
  if (status !== 'offered') {
    li.append(el('div', 'ev', p.evidence.join(' / ')))
    if (v?.notes.length) li.append(el('div', 'ev', v.notes.join(' / ')))
  }
  if (p.roles.note) li.append(el('div', 'reason', `△ ${p.roles.note}`))
  if (reason) li.append(el('div', 'reason', `✕ ${reason}`))
  return li
}

/** share of the page covered by ink, measured on a small rendering of the same marks */
function inkCover(c: Composition, a: Analysis): number {
  const canvas = renderCanvas(c.draft, a.glyphs, 160)
  const d = canvas.getContext('2d')!.getImageData(0, 0, 160, 160).data
  let ink = 0
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) ink++
  return ink / (160 * 160)
}

function record(t: StudyTitle, a: Analysis, c: Composition, cover: number): HTMLElement {
  const box = el('div', 'record')
  const head = el('h2')
  head.append(el('span', 'title', t.text))
  if (t.reading) head.append(el('span', 'reading', `（${t.reading}）`))
  box.append(head, el('p', 'note', t.note))

  // the decision, first
  const decision = el('p', 'decision')
  decision.append(
    el('b', undefined, opTitle(c.primary.op)),
    document.createTextNode(c.modifiers.length ? ` + ${c.modifiers.map((m) => opTitle(m.op)).join(' + ')}` : ''),
    document.createTextNode('  /  '),
    el('b', undefined, spaceTitle(c.spatial.id)),
    document.createTextNode(`  /  ${c.scale.regime}`),
    el('span', 'cover', `  ink ${(cover * 100).toFixed(0)}%`),
  )
  box.append(decision)

  const dl = el('dl')
  row(dl, 'tokens', a.tokens.map((k) => `${k.surface}/${POS[k.pos]}${k.form === 'imperative' ? '命' : ''}${k.reading ? `=${k.reading}` : ''}`).join('  '))
  row(dl, 'morae', `${a.morae.map((m) => m.text + (m.devoiced ? '°' : '')).join('・')}${a.readingAligned ? '' : ' ⚠読み未対応'}`)
  const rels = a.relations.filter((r) => !(r.kind === 'recurrence' && r.unit !== 'grapheme'))
  row(dl, 'relations', rels.map((r) => relationLabel(a, r)).join('\n') || '—')
  row(
    dl,
    'glyph',
    a.glyphRelations
      .slice(0, 4)
      .map((r) => `${r.inner}${r.kind === 'similarity' ? '≈' : '⊂'}${r.outer} ${f2(r.score)}${r.origin === 'inventory' ? '(在庫)' : ''}`)
      .join('  ') || '—',
  )
  box.append(dl)

  box.append(el('h3', undefined, 'primary operation'))
  const primary = el('ol', 'ops')
  primary.append(proposalLine(c.primary, 'primary'))
  box.append(primary)

  if (c.modifiers.length) {
    box.append(el('h3', undefined, `modifiers (salience ≥ ${MODIFIER_SALIENCE})`))
    const mods = el('ol', 'ops')
    for (const p of c.modifiers) mods.append(proposalLine(p, 'modifier'))
    box.append(mods)
  }

  box.append(el('h3', undefined, 'scale regime'), el('p', 'rel', `${c.scale.regime} — ${c.scale.grounds}`))
  box.append(el('h3', undefined, 'spatial composition'))
  const fits = el('ol', 'fits')
  c.fits.forEach((f) => {
    const li = el('li', f === c.spatial ? 'primary' : 'offered')
    li.append(el('span', 'op', spaceTitle(f.id)), el('span', 'sal', f2(f.score)), el('span', 'rel', f.grounds.join(' / ')))
    fits.append(li)
  })
  box.append(fits)

  box.append(el('h3', undefined, 'not adopted'))
  const rest = el('ul', 'ops')
  for (const r of c.rejected) rest.append(proposalLine(r.proposal, 'offered', r.reason))
  box.append(rest)
  box.append(el('p', 'meta', `marks ${c.draft.marks.length} · seed ${c.seed.toString(16)} · variant ${variant}`))
  return box
}

async function main(): Promise<void> {
  const header = el('header')
  header.append(
    el('h1', undefined, 'study sheet'),
    el('p', undefined, `development set · ${titles.length} titles · variant ${variant} · the pages carry no text; what was read and decided is written beside them`),
  )
  const list = el('main', grid ? 'grid' : undefined)
  document.body.append(header, list)

  const byOp = new Map<string, number>()
  const bySpace = new Map<string, number>()
  const byPair = new Map<string, number>()
  const byScale = new Map<string, number>()
  const inventory = { candidates: 0, primary: 0, modifier: 0, components: [] as string[] }
  const covers: number[] = []
  const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const t of titles) {
    const input = normalizeTitle({ text: t.text, reading: t.reading, variant })
    if (typeof input === 'string') continue
    const item = el('section', 'item')
    const page = el('div', 'page')
    item.append(page)
    list.append(item)
    const a = await analyze(input)
    const c = compose(a)
    renderSVG(page, c.draft, a.glyphs)
    const cover = inkCover(c, a)
    covers.push(cover)
    if (grid) item.append(el('p', 'caption', `${t.text}${t.reading ? `（${t.reading}）` : ''} · ${opTitle(c.primary.op)} / ${spaceTitle(c.spatial.id)}`))
    else item.append(record(t, a, c, cover))
    count(byOp, opTitle(c.primary.op))
    count(bySpace, spaceTitle(c.spatial.id))
    count(byPair, `${opTitle(c.primary.op)} / ${spaceTitle(c.spatial.id)}`)
    count(byScale, c.scale.regime)
    const found = a.glyphRelations.filter((r) => r.origin === 'inventory')
    if (found.length) {
      inventory.candidates++
      inventory.components.push(...found.map((r) => `${r.inner}${r.kind === 'similarity' ? '≈' : '⊂'}${r.outer}`))
    }
    const used = [c.primary, ...c.modifiers].find(
      (p) => p.focus.kind === 'pair' && p.focus.relation.origin === 'inventory',
    )
    if (used === c.primary) inventory.primary++
    else if (used) inventory.modifier++
  }

  const summary = el('div', 'summary')
  for (const [title, m] of [
    ['primary operation', byOp],
    ['spatial composition', bySpace],
    ['operation / space', byPair],
    ['scale regime', byScale],
  ] as const) {
    const col = el('div')
    col.append(el('h3', undefined, title))
    const ul = el('ul')
    for (const [k, n] of [...m].sort((x, y) => y[1] - x[1])) {
      const li = el('li')
      li.append(el('span', 'count', String(n)), el('span', undefined, k))
      ul.append(li)
    }
    col.append(ul)
    summary.append(col)
  }
  summary.append(
    el(
      'p',
      'coverline',
      `inventory readings: ${inventory.candidates}/${titles.length} titles have one · primary in ${inventory.primary} · modifier in ${inventory.modifier} · found: ${inventory.components.join(' ') || '—'}`,
    ),
  )
  const sorted = [...covers].sort((x, y) => x - y)
  const sparse = covers.filter((v) => v < 0.3).length
  summary.append(
    el(
      'p',
      'coverline',
      `ink coverage: min ${(sorted[0] * 100).toFixed(0)}% · median ${(sorted[Math.floor(sorted.length / 2)] * 100).toFixed(0)}% · max ${(sorted[sorted.length - 1] * 100).toFixed(0)}% · pages under 30%: ${sparse}/${covers.length}`,
    ),
  )
  header.append(summary)
}

void main()
