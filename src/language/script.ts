import type { Script } from './types'

const SYMBOLS = new Set(Array.from('！？!?、。，．・「」『』（）()〈〉《》…‥〜～＝＋－−×÷／/：:；;,.　 '))

export function scriptOf(c: string): Script {
  const cp = c.codePointAt(0)!
  if (c === 'ー') return 'mark'
  if (SYMBOLS.has(c)) return 'symbol'
  if (cp >= 0x3041 && cp <= 0x309f) return 'hiragana'
  if (cp >= 0x30a0 && cp <= 0x30ff) return 'katakana'
  if (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    cp === 0x3005 // 々
  )
    return 'kanji'
  return 'other'
}
