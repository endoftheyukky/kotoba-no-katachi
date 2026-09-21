/**
 * HOLDOUT SET — titles never used to design or tune the generator.
 *
 * Written down before the generator was frozen and not looked at until after:
 * a result here is the closest thing this work has to evidence that its rules
 * are general. Nothing in the generator may be changed to improve one of these
 * pages. Only a failure that recurs across several of them — a crash, an
 * overlap, a lost character, a broken order, a pathological scale, a
 * convergence, a rendering fault — is a reason to change a rule.
 *
 * None of these words appears in the development or the probe set.
 */
import type { StudyTitle } from './titles'

export const HOLDOUT_TITLES: StudyTitle[] = [
  // one character
  { text: '月', note: '単漢字・画が少ない' },
  { text: '糸', note: '単漢字・部品が縦に積まれる' },
  { text: '鳥', note: '単漢字・画が多い' },
  { text: '光', note: '単漢字' },
  { text: 'ん', note: '単かな・撥音' },

  // compounds
  { text: '音楽', note: '二字熟語' },
  { text: '朝日', note: '二字熟語・字形の包含が起こりうる（日）' },
  { text: '砂時計', note: '三字熟語' },
  { text: '国際空港', note: '四字熟語' },

  // kana, repetition and sound
  { text: 'ひかり', note: 'ひらがな三字' },
  { text: 'しずかに', note: 'ひらがな・濁音' },
  { text: 'さらさら', note: '畳語' },
  { text: 'ぽつぽつ', note: '畳語・半濁音・促音を含まない' },
  { text: 'ことことこと', note: '三回の反復' },
  { text: 'あいうえお', note: '母音の列' },

  // katakana
  { text: 'パン', note: 'カタカナ二字' },
  { text: 'ガラス', note: 'カタカナ・濁音' },
  { text: 'メトロノーム', note: 'カタカナ・長音' },
  { text: 'ロロロ', note: 'カタカナの反復' },

  // inflection, negation
  { text: '眠る', note: '動詞' },
  { text: '書け', note: '命令形' },
  { text: '遠くない', note: '形容詞の否定' },
  { text: '忘れない', note: '動詞の否定' },
  { text: '歩きながら', note: '連用形＋接続助詞' },
  { text: 'ない', note: '否定だけ' },
  { text: '見ない', note: '短い否定' },

  // phrases
  { text: '窓の外', note: '「の」による依存' },
  { text: '鳥の声', note: '「の」による依存' },
  { text: '風が吹く', note: '主語＋動詞' },
  { text: '水を飲む', note: '目的語＋動詞' },
  { text: '今日は晴れ', note: '主題の「は」' },
  { text: '春はあけぼの', note: '古い言い回し' },

  // coordination and glyph relations
  { text: '手と足', note: '並列' },
  { text: '雪または霧', note: '選択の接続語' },
  { text: '大と太', note: '近い字形' },
  { text: '木と本', note: '近い字形' },
  { text: '土と士', note: '近い字形' },
  { text: '王と玉', note: '字形の包含が起こりうる' },

  // marks, spaces, numbers
  { text: 'え？', note: 'かな一字＋記号' },
  { text: '待って！', note: '促音＋記号' },
  { text: '「声」', note: '括弧' },
  { text: '一、二、三', note: '読点と数' },
  { text: '青い 空', note: '空白を含む' },
  { text: '風 と 光', note: '空白が二つ' },
  { text: '3月', note: '数字＋漢字' },
  { text: '100年', note: '桁のある数' },
  { text: '1 2 3', note: '空白で区切った数' },
]
