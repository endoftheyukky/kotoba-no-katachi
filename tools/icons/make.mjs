// The site's icons, all drawn from public/favicon.svg (the only source):
//   public/favicon.ico           16, 32 and 48 px, for browsers that ask for /favicon.ico
//   public/apple-touch-icon.png  180 px, the sheet without its hairline edge (iOS rounds
//                                and frames the tile itself), for the home screen
// Drawn by the browser from the SVG, as a tab would draw it.
//
// usage (with a dev server running, e.g. `npx vite --port 5175`):
//   node tools/form/cdp.mjs http://127.0.0.1:5175 <shots-dir> tools/icons/make.mjs
import { writeFileSync } from 'node:fs'

const ICO = [16, 32, 48]
const TOUCH = 180

/** an .ico holding PNG images (supported by every current browser) */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e)
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt8(0, e + 2)
    head.writeUInt8(0, e + 3)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.data)])
}

export default async function ({ evaluate, load }) {
  await load('/index.html', 400, 400)
  const drawn = await evaluate(`(async () => {
    const svg = await (await fetch('/favicon.svg', { cache: 'no-store' })).text()
    const draw = async (text, size) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
      const img = new Image(); img.src = url; await img.decode()
      const c = document.createElement('canvas'); c.width = c.height = size
      c.getContext('2d').drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(url)
      return c.toDataURL('image/png')
    }
    const ico = []
    for (const s of ${JSON.stringify(ICO)}) ico.push([s, await draw(svg, s)])
    const touch = await draw(svg.replace(/<rect id="edge"[^>]*\\/>/, ''), ${TOUCH})
    return { ico, touch }
  })()`)
  const png = (u) => Buffer.from(u.split(',')[1], 'base64')
  writeFileSync('public/favicon.ico', ico(drawn.ico.map(([size, u]) => ({ size, data: png(u) }))))
  writeFileSync('public/apple-touch-icon.png', png(drawn.touch))
  return { ico: ICO, touch: TOUCH }
}
