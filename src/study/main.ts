/**
 * Development study sheet (not part of the work).
 * Each title's page is drawn alone, without any text on it; what the system
 * read and decided is written beside it.
 *
 *   /study.html                 all study titles
 *   /study.html?variant=1       the next alternative reading of each
 *   /study.html?only=嘘|海のあと  a subset
 *   /study.html?view=grid       pages only, as a contact sheet
 *   /study.html?set=probe       the probe set instead of the development set
 *   /study.html?set=holdout     the holdout set (never used to design; look only)
 *   /study.html?space=path      draw every title in one composition, where it fits
 *   /study.html?mode=turned     …and in one of that composition's ways
 *   /study.html?compare=auto|path/run|path/turned
 *   /study.html?compare=%231|%232 one title drawn several ways, side by side at
 *                               one size: a composition, `auto` (the page as
 *                               it was chosen), or a place in the selection's
 *                               own order (#1 winner, #2 runner-up)
 *   /study.html?detail=1        …with grounds, marks and completeness too
 *   /study.html?size=420        how large those pages are drawn
 *   /study.html?bare=1          no header: the pages alone
 *
 * The last five are for looking only: they change which realization is drawn,
 * never how one is chosen.
 */
import './study.css'
import '../glyph/font-face'
import type { Relation } from '../language/analysis'
import { loadNeighbours } from '../language/semantic'
import { analyze, compose, type Force, MODIFIER_SALIENCE, OPERATIONS, SPACES } from '../poem/compose'
import { measureAll, verdict } from '../poem/measure'
import type { Analysis, Composition, Decision, GrammarId, Proposal, Realization, SpatialId } from '../poem/types'
import { renderCanvas } from '../render/png'
import { PAGE } from '../render/stage'
import { renderSVG } from '../render/svg'
import { normalizeTitle } from '../title'
import { HOLDOUT_TITLES } from './holdout'
import { PROBE_TITLES } from './probes'
import { STUDY_TITLES, type StudyTitle } from './titles'

const params = new URLSearchParams(location.search)
const variant = Number(params.get('variant') ?? 0)
const only = params.get('only')?.split('|')
const probe = params.get('set') === 'probe'
const holdout = params.get('set') === 'holdout'
const set = probe ? PROBE_TITLES : holdout ? HOLDOUT_TITLES : STUDY_TITLES
const titles = only ? set.filter((t) => only.includes(t.text)) : set
const grid = params.get('view') === 'grid'
/** look at one composition's page for every title it can hold (review only) */
const space = params.get('space') as SpatialId | null
const mode = params.get('mode')
/**
 * The same title drawn several ways at one size. An entry names either a
 * composition (`path`, `path/turned`), the page as it was chosen (`auto`), or
 * a place in the selection's own order (`#1` the winner, `#2` the runner-up),
 * which is how two titles with different winners can still be set beside each
 * other. Nothing here takes part in the choice; it reads the order it made.
 */
const compare = params.get('compare')?.split('|').map((s) => s.trim()).filter(Boolean)
const size = Number(params.get('size') ?? 0)
if (size) {
  document.documentElement.style.setProperty('--page', `${size}px`)
  document.documentElement.style.setProperty('--cell', `${size}px`)
}
/** also print the grounds, the marks and the completeness under each page */
const detail = params.get('detail') === '1'
/** pages only: no header, no summary — a contact sheet to look at whole */
const bare = params.get('bare') === '1'

/**
 * a comparison entry → the review-only force that draws it. An entry may end
 * in `+grammar` (v2): `#1+field` is the chosen page written as a density field.
 * A grammar may name one of its ways (`#1+silhouette/contour`), and `+sem`
 * lets the grammars that place several materials take one from the lexicon
 * (`#1+constellation+sem`). Both are review only.
 */
function forceOf(spec: string, fits: readonly Realization[]): Force | null {
  const [base, ...more] = spec.split('+')
  const SEM = ['sym', 'aozora', 'chive', 'hybrid'] as const
  const g = more.find((x) => x !== 'sem' && !(SEM as readonly string[]).includes(x))
  const [gid, named] = (g ?? '').split('/')
  const source = more.find((x) => (SEM as readonly string[]).includes(x))
  const grammar = {
    ...(gid ? { grammar: gid as GrammarId | 'auto' } : {}),
    ...(named ? { variant: named } : {}),
    ...(more.includes('sem') ? { semantic: true } : {}),
    // v2d experiment: `+hybrid`, `+aozora`, `+chive`, `+sym`
    ...(source ? { semanticSource: (source === 'sym' ? 'symbolic' : source) as 'symbolic' | 'aozora' | 'chive' | 'hybrid' } : {}),
  }
  if (base === 'auto' || base === '') return { ...grammar }
  const rank = /^#(\d+)$/.exec(base)
  if (rank) {
    const r = fits[Number(rank[1]) - 1]
    return r ? { space: r.id, mode: r.mode, ...grammar } : null
  }
  const [id, way] = base.split('/')
  return { space: (id || undefined) as SpatialId | undefined, mode: way || undefined, ...grammar }
}

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
    el('span', 'ground', `L${p.level} ${{ 1: '語', 2: '字', 3: '音', 4: '画' }[p.level]}`),
    el('span', 'sal', `poetic ${f2(p.poeticPotential ?? 0)}`),
    el('div', 'parts', `linguistic ${f2(s.value)} = rs ${f2(s.relationStrength)} · d ${f2(s.distinctiveness)} · cov ${f2(s.coverage)}`),
    el('div', 'parts', v ? `visual ${f2(v.value)} = legibility ${f2(v.legibility)} × structure ${f2(v.structure)}` : ''),
  )
  li.append(el('div', 'rel', p.relations.join('  ')))
  if (p.scope)
    li.append(
      el('div', 'parts', `scope ${{ whole: '題全体', span: '連続した部分', unit: '局所' }[p.scope.kind]} — ${p.scope.grounds}`),
    )
  if (status !== 'offered') {
    li.append(el('div', 'ev', p.evidence.join(' / ')))
    if (v?.notes.length) li.append(el('div', 'ev', v.notes.join(' / ')))
  }
  if (p.roles.note) li.append(el('div', 'reason', `△ ${p.roles.note}`))
  if (reason) li.append(el('div', 'reason', `✕ ${reason}`))
  return li
}

/**
 * Does the page still hold the title? Every character must be drawn, or be
 * one the poem writes as space; and what is drawn must keep the order it was
 * written in (repetition aside, which reorders by its nature).
 */
function completeness(a: Analysis, c: Composition): { missing: string[]; unexplained: string[]; ordered: boolean } {
  const title = a.graphemes.filter((g) => g.char.trim())
  const pool = c.draft.marks.map((k) => k.char)
  const absent = new Set(c.absent)
  const missing: string[] = []
  const unexplained: string[] = []
  for (const g of title) {
    const i = pool.indexOf(g.char)
    if (i >= 0) {
      pool.splice(i, 1)
      continue
    }
    missing.push(g.char)
    if (!absent.has(g.index)) unexplained.push(g.char)
  }
  const along = (k: { x: number; y: number }) => (a.direction === 'vertical' ? k.y : k.x)
  const once = title.filter((g) => title.filter((o) => o.char === g.char).length === 1)
  const seen = once
    .map((g) => {
      const hits = c.draft.marks.filter((k) => k.char === g.char)
      return hits.length === 1 ? { index: g.index, at: along(hits[0]), size: hits[0].size } : null
    })
    .filter((v): v is { index: number; at: number; size: number } => !!v)
  // two marks at the same height along the reading carry their order across it
  // (a horizontal axis under a vertical reading): only a clear reversal counts
  const ordered =
    c.primary.op === 'proliferation' ||
    seen.every((v, i) => i === 0 || v.at >= seen[i - 1].at - Math.max(v.size, seen[i - 1].size) * 0.75)
  return { missing, unexplained, ordered }
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
  row(
    dl,
    'phonology',
    a.phonology
      .map((f) =>
        f.kind === 'voicing'
          ? `voicing ${f.base}+${f.mark}=${f.voiced}${f.alsoWritten.length ? '（清音も題にある）' : ''}`
          : f.kind === 'special'
            ? `special ${f.sub}「${a.morae[f.mora].text}」${f.sub === 'N' ? '（検出のみ：操作へ接続しない）' : ''}`
            : `echo ${{ mora: '拍', vowel: '母音', onset: '子音' }[f.unit]}「${f.value}」×${f.morae.length} 拍の${(f.share * 100).toFixed(0)}%`,
      )
      .join('\n') || '—',
  )
  box.append(dl)

  box.append(el('h3', undefined, `feature descent — 第${c.descent.layer}層`))
  box.append(
    el(
      'p',
      'rel',
      `採用 ${f2(c.descent.adopted)} · 上位 ${c.descent.upper ? f2(c.descent.upper) : '—'} · 最下層 ${f2(c.descent.deepest)}${c.descent.held.length ? ` · 同一観測で置換抑止（${c.descent.held.join('・')}）` : ''}`,
    ),
  )
  box.append(el('p', 'rel', c.descent.reason))

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
    li.append(
      el('span', 'op', spaceTitle(f.id)),
      el('span', 'ground', f.mode),
      el('span', 'sal', f2(f.fitness)),
      el('span', 'rel', f.grounds.join(' / ')),
    )
    if (f.uses.length) li.append(el('div', 'parts', `使う: ${f.uses.map((u) => `${u.property} ${u.value}`).join(' · ')}`))
    if (f.losses?.length)
      li.append(el('div', 'reason', `失う: ${f.losses.map((u) => `${u.property} ${u.value}`).join(' · ')}`))
    fits.append(li)
  })
  box.append(fits)

  if (c.parameters.length) {
    box.append(el('h3', undefined, 'composition parameters (言語的 / 造形的)'))
    const ul = el('ul', 'params')
    for (const p of [...c.parameters].sort((x, y) => Number(y.applied) - Number(x.applied) || y.deviation - x.deviation)) {
      const li = el('li', p.applied ? 'applied' : 'neutralised')
      li.append(
        el('span', 'op', p.name),
        el('span', 'ground', p.ground === 'linguistic' ? '言語' : '造形'),
        el('span', 'sal', p.applied ? p.value : `${p.neutral}（中立に戻す・偏差 ${f2(p.deviation)}）`),
        el('div', 'rel', p.note),
      )
      ul.append(li)
    }
    box.append(ul)
  }

  const decisions = (title: string, ds: Decision[]) => {
    box.append(el('h3', undefined, title))
    const ul = el('ul', 'params')
    for (const d of ds) {
      const li = el('li', 'applied')
      li.append(
        el('span', 'op', d.name),
        el('span', 'ground', d.ground === 'linguistic' ? '言語' : '造形'),
        el('span', 'sal', d.value),
        el('div', 'rel', d.note),
      )
      ul.append(li)
    }
    box.append(ul)
  }

  if (c.contract) {
    const { occupancy: o, fitted } = c.contract
    decisions(
      `occupancy — reach ${f2(o.reach)} / fill ${f2(o.fill)} / ${o.spread}${o.bleed ? ' · 断ち落とし可' : ''}`,
      o.decisions,
    )
    decisions(
      `scale contract — 望む帯 ${fitted.desired} → 実際 ${fitted.achieved}${fitted.bled ? ' · 紙面外へ' : ''} · 字の大きさ ${fitted.sizes.map((v) => (v / PAGE).toFixed(2)).join(' : ')}`,
      fitted.decisions,
    )
  }

  if (c.contract?.context?.length) decisions('context — 題の残りをどう保つか', c.contract.context)

  const mm = measureAll(c.draft.marks)
  const v = verdict(mm.total, c.spatial.id)
  const comp = completeness(a, c)
  box.append(el('h3', undefined, 'measured page'))
  box.append(
    el(
      'p',
      'rel',
      `feature: reach ${f2(mm.feature.reach)} · 最大字 ${f2(mm.feature.maxEm)} · marks ${mm.feature.count}` +
        (c.contract ? `（契約 reach ${f2(c.contract.occupancy.reach)} / fill ${f2(c.contract.occupancy.fill)}）` : ''),
    ),
  )
  box.append(
    el(
      'p',
      v.dead ? 'dead' : 'rel',
      `total: reach ${f2(mm.total.reach)} · ink ${f2(mm.total.weight)} · marks ${mm.total.count}` +
        (mm.context ? ` · うち文脈 ${mm.context.count}字（${f2(mm.context.maxEm)}）` : '') +
        ` — ${v.note}`,
    ),
  )
  box.append(
    el(
      'p',
      comp.unexplained.length || !comp.ordered ? 'dead' : 'rel',
      `文脈: ${comp.missing.length ? `欠落「${comp.missing.join('')}」` : '題の字はすべて紙面にある'}` +
        (comp.unexplained.length ? ` — うち説明のつかない脱落「${comp.unexplained.join('')}」` : '') +
        (comp.ordered ? ' · 読み順は保たれている' : ' · 読み順が壊れている'),
    ),
  )

  box.append(el('h3', undefined, 'not adopted'))
  const rest = el('ul', 'ops')
  for (const r of c.rejected) rest.append(proposalLine(r.proposal, 'offered', r.reason))
  box.append(rest)
  box.append(el('p', 'meta', `marks ${c.draft.marks.length} · seed ${c.seed.toString(16)} · variant ${variant}`))
  return box
}

/**
 * Review only. One title, drawn several ways, at one size, with nothing beside
 * each page but what that way did: which composition and which of its ways,
 * its fitness, what it uses and what it cannot keep. The choice is untouched —
 * the page marked 採用 is the one the system would have made on its own.
 */
async function comparison(list: HTMLElement): Promise<void> {
  // the v2d experiment reads neighbour tables: load them before any title is analysed
  if (compare!.some((s) => /\+(sym|aozora|chive|hybrid)/.test(s))) await loadNeighbours()
  for (const t of titles) {
    const input = normalizeTitle({ text: t.text, reading: t.reading, variant })
    if (typeof input === 'string') continue
    const a = await analyze(input)
    const chosen = compose(a)
    const item = el('section', 'item')
    const head = el('h2')
    head.append(el('span', 'title', t.text))
    if (t.reading) head.append(el('span', 'reading', `（${t.reading}）`))
    item.append(head)
    const shots = el('div', 'shots')
    for (const spec of compare!) {
      const force = forceOf(spec, chosen.fits)
      if (!force) {
        // a place in an order that this title does not reach
        const shot = el('div', 'shot')
        shot.append(el('div', 'page'), el('div', 'caption', `${spec}：この題には無い`))
        shots.append(shot)
        continue
      }
      const c = compose(a, force)
      const r = c.spatial
      const same = r.id === chosen.spatial.id && r.mode === chosen.spatial.mode
      const shot = el('div', same ? 'shot chosen' : 'shot')
      const page = el('div', 'page')
      shot.append(page)
      renderSVG(page, c.draft, a.glyphs)
      const cap = el('div', 'caption')
      cap.append(
        el('p', 'shotname', `${spaceTitle(r.id)} / ${r.mode}${c.grammar.id !== 'uniform' ? ` + ${c.grammar.id}${c.grammar.variant ? `/${c.grammar.variant}` : ''}` : ''}${force.semantic ? ' +語彙' : ''}${same && c.grammar.id === 'uniform' ? '　← 採用' : ''}`),
        el('p', undefined, `fitness ${f2(r.fitness)}`),
        el('p', undefined, `使う: ${r.uses.length ? r.uses.map((u) => `${u.property} ${u.value}`).join(' · ') : '—'}`),
        el('p', r.losses?.length ? 'dead' : undefined, `失う: ${r.losses?.length ? r.losses.map((u) => `${u.property} ${u.value}`).join(' · ') : '—'}`),
      )
      if (c.grammar.id !== 'uniform' || c.grammar.grounds.length)
        cap.append(
          el('p', undefined, `grammar: ${c.grammar.grounds.join(' / ')}`),
          el('p', undefined, `派生: ${Object.entries(c.grammar.derived).map(([k, n]) => `${k}×${n}`).join(' ') || '—'}`),
          // semantic material: where each character was read from (review only; never on the page)
          ...[...new Set(c.draft.marks.filter((k) => k.derived?.source).map((k) => k.derived!.source!))].map((src) => el('p', 'dead', `語彙: ${src}`)),
        )
      if (detail) {
        const mm = measureAll(c.draft.marks).total
        const comp = completeness(a, c)
        cap.append(
          el('p', undefined, r.grounds.join('\n')),
          el('p', undefined, `marks ${c.draft.marks.length} · reach ${f2(mm.reach)} · 最大字 ${f2(mm.maxEm)}`),
          // what is actually on the paper, in the order it was placed
          el(
            'p',
            undefined,
            c.draft.marks
              .map((k) => `${k.char}(${Math.round(k.x)},${Math.round(k.y)})r${(k.rotate ?? 0).toFixed(1)}`)
              .join(' '),
          ),
          el(
            'p',
            comp.unexplained.length || !comp.ordered ? 'dead' : undefined,
            (comp.unexplained.length ? `説明のつかない脱落「${comp.unexplained.join('')}」` : '脱落なし') +
              (comp.ordered ? ' · 読み順は保たれている' : ' · 読み順が壊れている'),
          ),
        )
      }
      shot.append(cap)
      shots.append(shot)
    }
    item.append(shots)
    list.append(item)
  }
}

async function main(): Promise<void> {
  const header = el('header')
  header.append(
    el('h1', undefined, 'study sheet'),
    el('p', undefined, `${probe ? 'probe set（特定のfeatureが設計どおり発火するかを見るための題。一般化の証拠ではない）' : holdout ? 'holdout set（設計に一度も使っていない題。見るだけ）' : 'development set'}${compare ? `  ⟨比較: ${compare.join('  ')}（同じ大きさで並べるだけ。選択には影響しない）⟩` : space || mode ? `  ⟨強制描画: ${space ?? ''}${mode ? '/' + mode : ''}（選択には影響しない）⟩` : ''} · ${titles.length} titles · variant ${variant} · the pages carry no text; what was read and decided is written beside them`),
  )
  const list = el('main', compare ? 'compare' : grid ? 'grid' : undefined)
  document.body.append(...(bare ? [list] : [header, list]))
  // a comparison sheet has no distribution to count: the same title, several ways
  if (compare) return comparison(list)

  const byOp = new Map<string, number>()
  const bySpace = new Map<string, number>()
  const byPair = new Map<string, number>()
  const byScale = new Map<string, number>()
  const inventory = { candidates: 0, primary: 0, modifier: 0, components: [] as string[] }
  const covers: number[] = []
  const dead: string[] = []
  const reaches: number[] = []
  const descended: string[] = []
  const lost: string[] = []
  const disordered: string[] = []
  const byLevel = new Map<string, number>()
  const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const t of titles) {
    const input = normalizeTitle({ text: t.text, reading: t.reading, variant })
    if (typeof input === 'string') continue
    const item = el('section', 'item')
    const page = el('div', 'page')
    item.append(page)
    list.append(item)
    const a = await analyze(input)
    const c = compose(a, space || mode ? { space: space ?? undefined, mode: mode ?? undefined } : {})
    renderSVG(page, c.draft, a.glyphs)
    const cover = inkCover(c, a)
    covers.push(cover)
    if (grid) item.append(el('p', 'caption', `${t.text}${t.reading ? `（${t.reading}）` : ''} · ${opTitle(c.primary.op)} / ${spaceTitle(c.spatial.id)}`))
    else item.append(record(t, a, c, cover))
    count(byOp, opTitle(c.primary.op))
    count(bySpace, spaceTitle(c.spatial.id))
    count(byPair, `${opTitle(c.primary.op)} / ${spaceTitle(c.spatial.id)}`)
    count(byScale, c.scale.regime)
    count(byLevel, `L${c.primary.level} ${{ 1: '語', 2: '字', 3: '音', 4: '画' }[c.primary.level]}`)
    if (c.primary.level === 3)
      descended.push(`${t.text}（${c.primary.relations[0]?.split(' ')[0] ?? c.primary.op}）`)
    // the whole page, context included, is what a reader sees
    const mm = measureAll(c.draft.marks).total
    reaches.push(mm.reach)
    if (verdict(mm, c.spatial.id).dead) dead.push(t.text)
    const comp = completeness(a, c)
    if (comp.unexplained.length) lost.push(`${t.text}「${comp.unexplained.join('')}」`)
    if (!comp.ordered) disordered.push(t.text)
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

  // nothing matched (?only= with no such title): there is nothing to summarise
  if (!titles.length || !reaches.length) {
    header.append(el('p', 'coverline', '該当する題がありません'))
    return
  }
  const summary = el('div', 'summary')
  for (const [title, m] of [
    ['primary operation', byOp],
    ['spatial composition', bySpace],
    ['operation / space', byPair],
    ['scale regime', byScale],
    ['feature level (primary)', byLevel],
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
  summary.append(
    el(
      'p',
      'coverline',
      `level 3（音）へ降りた題: ${descended.length}/${titles.length}${descended.length ? ` — ${descended.join(' · ')}` : ''}`,
    ),
  )
  summary.append(
    el(
      'p',
      lost.length ? 'coverline dead' : 'coverline',
      `説明のつかない脱落: ${lost.length}/${titles.length}${lost.length ? ` — ${lost.join(' · ')}` : ' — なし'} · 読み順が壊れた題: ${disordered.length}${disordered.length ? `（${disordered.join(' ')}）` : ''}`,
    ),
  )
  summary.append(
    el(
      'p',
      dead.length ? 'coverline dead' : 'coverline',
      `死域（少数・小さな字・狭い範囲）: ${dead.length}/${titles.length}${dead.length ? ` — ${dead.join(' ')}` : ' — なし'} · reach 中央値 ${[...reaches].sort((x, y) => x - y)[Math.floor(reaches.length / 2)].toFixed(2)}`,
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
