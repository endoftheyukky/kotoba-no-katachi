/**
 * Review sheet: the study titles as works, to be looked at without their
 * reasons. The page, its title, and one quiet line saying which composition
 * held it and how well it fitted — nothing about relations, operations or
 * salience. Generation is exactly that of the work.
 *
 *   /review.html
 *   /review.html?set=probe
 */
import './review.css'
import '../glyph/font-face'
import { analyze, compose, SPACES } from '../poem/compose'
import { renderSVG } from '../render/svg'
import { PROBE_TITLES } from '../study/probes'
import { STUDY_TITLES } from '../study/titles'
import { normalizeTitle } from '../title'

async function main(): Promise<void> {
  const list = document.createElement('main')
  document.body.append(list)

  // lay out every place first, so the sheet does not jump while pages are drawn
  const set = new URLSearchParams(location.search).get('set') === 'probe' ? PROBE_TITLES : STUDY_TITLES
  const slots = set.map((t) => {
    const figure = document.createElement('figure')
    const page = document.createElement('div')
    page.className = 'page'
    const caption = document.createElement('figcaption')
    caption.textContent = t.text
    if (t.reading) {
      const reading = document.createElement('span')
      reading.className = 'reading'
      reading.textContent = `（${t.reading}）`
      caption.append(reading)
    }
    // filled in once the page is composed, so the line never precedes its page
    const held = document.createElement('div')
    held.className = 'held'
    figure.append(page, caption, held)
    list.append(figure)
    return { t, page, held }
  })

  for (const { t, page, held } of slots) {
    const input = normalizeTitle({ text: t.text, reading: t.reading })
    if (typeof input === 'string') continue
    const a = await analyze(input)
    const c = compose(a)
    renderSVG(page, c.draft, a.glyphs)
    const space = SPACES.find((s) => s.id === c.spatial.id)
    held.textContent = `${space?.title ?? c.spatial.id} / ${c.spatial.mode} · ${c.spatial.fitness.toFixed(2)}`
  }
}

void main()
