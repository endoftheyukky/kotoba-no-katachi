/**
 * DIFFICULT SET — ordinary words, and the edges of what a title can be.
 *
 * The generator has always been strongest where a title *does* something in
 * its writing: it repeats, it holds two terms, one of its characters sits inside
 * another. An ordinary two-kanji word does none of that. Its structure is plain,
 * so everything that reads structure has nothing to say, and such words risked
 * becoming the same page: the word, set down, somewhere.
 *
 * `words` are those ordinary words — chosen for meaning that a page could feel
 * (isolation, crowding, silence, severance, memory), never tuned against.
 * `edges` are the shapes of input the published site has actually been given or
 * could be: one kana, latin letters, numbers, punctuation, long sentences, a
 * reading in brackets.
 */
import type { StudyTitle as Titled } from './titles'

type StudyTitle = Omit<Titled, 'note'> & { note?: string }

export const DIFFICULT_WORDS: StudyTitle[] = [
  { text: '孤独' },
  { text: '記憶' },
  { text: '風景' },
  { text: '静寂' },
  { text: '祭り' },
  { text: '都市' },
  { text: '現実' },
  { text: '断絶' },
  { text: '温度' },
  { text: '希望' },
  { text: '秘密' },
  { text: '群衆' },
  { text: '眠り' },
  { text: '不安' },
  { text: '自由' },
  { text: '境界' },
  { text: '沈黙' },
  { text: '距離' },
  { text: '永遠' },
  { text: '喪失' },
  { text: '約束' },
  { text: '夜明け' },
  { text: '迷路' },
  { text: '余白' },
]

export const EDGE_TITLES: StudyTitle[] = [
  { text: 'の' },
  { text: '愛' },
  { text: 'ざわざわ' },
  { text: 'カタカナ語' },
  { text: 'Thank you!' },
  { text: 'aaaaaaa' },
  { text: '2026' },
  { text: '……' },
  { text: '！？' },
  { text: '僕の悲しみに名前をつけるな！' },
  { text: '今日も明日も雨が降るでしょう' },
  { text: '子供の城', reading: 'こどものしろ' },
  { text: '東京', reading: 'とうきょう' },
  { text: 'A to Z' },
]
