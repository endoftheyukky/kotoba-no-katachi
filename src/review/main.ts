/**
 * Review sheet: the study titles as works, to be looked at without their
 * reasons. Only the page and its title are shown; nothing about relations,
 * operations or salience. Generation is exactly that of the work.
 *
 *   /review.html
 *   /review.html?set=probe
 */
import './review.css'
import '../glyph/font-face'
import { analyze, compose } from '../poem/compose'
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
    figure.append(page, caption)
    list.append(figure)
    return { t, page }
  })

  for (const { t, page } of slots) {
    const input = normalizeTitle({ text: t.text, reading: t.reading })
    if (typeof input === 'string') continue
    const a = await analyze(input)
    renderSVG(page, compose(a).draft, a.glyphs)
  }
}

void main()
