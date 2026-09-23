/**
 * PROBE SET — titles chosen to make one feature fire, so that its behaviour
 * can be seen at all.
 *
 * This is not a holdout set and not a development set. Results here say
 * whether a rule does what it was designed to do; they are no evidence that
 * the generator is good in general, and the thresholds of a rule are never
 * tuned to make a particular probe look better. A holdout set, untouched by
 * any design decision, stays reserved for that question.
 *
 * These probe the fourth level of the descent: the inside of a letterform.
 * The single characters ask whether the feature is detected at all; the
 * compounds ask whether it stays in its place when the title has other
 * characters to carry (coverage), instead of taking the whole page for one
 * character's ink.
 */
import type { StudyTitle } from './titles'

export const PROBE_TITLES: StudyTitle[] = [
  // counters — white the strokes close in
  { text: '口', note: 'counter: 一つの巨大な白（インク箱の47%）。題は一字きりで、白に置くものがない' },
  { text: '回', note: 'counter: 白の中の白（入れ子）' },
  { text: '日', note: 'counter: 等しい白が二つ、積み重なる（各20%）' },
  { text: '目', note: 'counter: 等しい白が三つ（各11%）' },
  { text: '田', note: 'counter: 等しい白が四つ、格子（各10%）' },

  // echoForm — the same form returning inside one character
  { text: '品', note: 'echoForm: 同じ口が三つ（類似0.96）＋小さな白' },
  { text: '羽', note: 'echoForm: 同じ形が二つ（類似0.94）・白はない' },

  // the same features with other characters present: does coverage hold them back?
  { text: '入口', reading: 'いりぐち', note: 'counter + 他の字：白の中に「入」が入るか' },
  { text: '休日', reading: 'きゅうじつ', note: 'counter が二つ：どちらに「休」が入るか' },
  { text: '田園', reading: 'でんえん', note: 'counter が四つ・格子。二字とも白を持つ' },
  { text: '商品', reading: 'しょうひん', note: 'echoForm（品）が二字の題の中でどう扱われるか' },
  { text: '羽音', reading: 'はおと', note: 'echoForm（羽）が二字の題の中でどう扱われるか' },
]
