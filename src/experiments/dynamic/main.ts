/**
 * The shell: one input, one start action, the page.
 * While the poem runs, nothing else is visible. Escape stops it.
 *
 * Study parameters (not part of the work):
 *   ?w=ことば                       pre-fill the word
 *   &rule=wear|aperture|disperse   force a rule
 *   &state=start|middle|final      show that still composition
 *   &state=all                     the three states side by side
 *                                  (all three rules, one row each, if no rule is given)
 *   &t=4.2                         show the page frozen at t seconds
 */
import './style.css'
import { normalizeWord } from './language/analyze'
import { describe, prepare } from './poem/perform'
import { RULES } from './poem/select'
import type { StateName } from './poem/types'

type State = 'idle' | 'playing' | 'ended' | 'still' | 'sheet'

const host = document.getElementById('stage')!
const form = document.getElementById('entry') as HTMLFormElement
const input = document.getElementById('word') as HTMLInputElement
const params = new URLSearchParams(location.search)
const STATES: StateName[] = ['start', 'middle', 'final']

let stopCurrent: (() => void) | null = null

const setState = (s: State) => (document.body.dataset.state = s)

async function play(text: string): Promise<void> {
  stopCurrent?.()
  setState('playing')
  input.blur()

  const prepared = await prepare(text, host, params.get('rule'))
  describe(prepared)
  const { composition } = prepared

  const t0 = performance.now()
  let raf = 0
  let done = false
  const end = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    stopCurrent = null
    setState('ended')
  }
  const frame = () => {
    const t = (performance.now() - t0) / 1000
    composition.render(Math.min(t, composition.duration))
    if (t >= composition.duration) end()
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  stopCurrent = end
}

/** A grid of still pages: rows = rules, columns = start / middle / final. */
async function sheet(text: string, ruleId: string | null): Promise<void> {
  setState('sheet')
  const rules = RULES.filter((r) => !ruleId || r.id === ruleId)
  const grid = document.createElement('div')
  grid.className = 'sheet'
  grid.style.setProperty('--rows', String(rules.length))
  document.body.appendChild(grid)
  for (const rule of rules)
    for (const state of STATES) {
      const cell = document.createElement('figure')
      const page = document.createElement('div')
      page.className = 'page'
      const label = document.createElement('figcaption')
      cell.append(page, label)
      grid.appendChild(cell)
      const p = await prepare(text, page, rule.id)
      p.composition.render(p.composition.states[state])
      label.textContent = `${rule.title} ${rule.id} · ${state} · ${p.composition.states[state].toFixed(1)}s / ${p.composition.duration.toFixed(1)}s`
      if (state === 'start') describe(p)
    }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = normalizeWord(input.value)
  if (!text) return
  input.value = text
  void play(text)
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stopCurrent) stopCurrent()
})

const preset = params.get('w')
if (preset) {
  const text = normalizeWord(preset)
  input.value = text
  const state = params.get('state')
  const t = params.get('t')
  if (state === 'all') void sheet(text, params.get('rule'))
  else if (state || t !== null) {
    setState('still')
    void prepare(text, host, params.get('rule')).then((p) => {
      describe(p)
      const at = STATES.includes(state as StateName) ? p.composition.states[state as StateName] : Number(t)
      p.composition.render(at)
    })
  }
}
