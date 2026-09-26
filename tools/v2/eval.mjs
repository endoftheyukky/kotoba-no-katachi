// Development only: the v2 evaluation pages (spec-1 §16 stage 9: look at the pages, not only the tests).
//   node tools/v2/eval.mjs [out-dir]     default node_modules/.cache/v2-eval
// Serves the repository with Vite, composes the evaluation set in headless Chrome, writes each page, contact
// sheets with what decided each, and a summary. The benchmark lists here are for looking only; nothing in src/
// reads them.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import { STUDY_TITLES } from '../../src/study/titles.ts'
import { HOLDOUT_TITLES } from '../../src/study/holdout.ts'
import { PROBE_TITLES } from '../../src/study/probes.ts'
import { DIFFICULT_WORDS, EDGE_TITLES } from '../../src/study/difficult.ts'

const out = resolve(process.argv[2] ?? 'node_modules/.cache/v2-eval')
mkdirSync(out, { recursive: true })
const sets = {
  benchmark: [...'雨闇淋林州血囚辻悲'].map((text) => ({ text })),
  controls: [...'海問品森玉晶轟好男国閣日'].map((text) => ({ text })),
  boundary: [...'琳田回魁噴虜看'].map((text) => ({ text })),
  // the flows of a line, at their edges (Stage 10): a mirror, a mora heard again after another, a mora doubled
  // in place, a reduplication, a long line; for looking only
  sequence: [
    { text: 'たけやぶやけた' }, { text: 'しんぶんし' }, { text: 'とまと' }, { text: 'かなしいかな' },
    { text: '東京特許許可局', reading: 'とうきょうとっきょきょかきょく' }, { text: 'すもももももももものうち' },
    { text: 'かえるぴょこぴょこ' }, { text: 'ささやき' }, { text: 'コーヒー' }, { text: 'きのうのきょうのあした' },
  ],
  // any input (Stage 11): every kind of text a person may type, including what the site refuses before it
  // composes (a character the face lacks, an empty or too long title); for looking only
  robustness: [
    '図書館', '経済', 'ありがとう', 'あ', 'ラジオ', 'ヴァイオリン', 'hello', 'WORLD', 'a', '12345', '0', '3.14',
    '「」', '！？', '、。', '……', '・', 'Tシャツ', '3月の雨', 'iPhoneの画面', 'A4用紙', '空 と 海', 'a b c',
    ['生', 'なま'], '生', ['今日', 'こんにち'], ['雨', 'かぜ'], 'ぬるぴか', '森雨林', '雨囚', '薔薇', '龘', '々', '𠮟る',
    '🌧', '雨🌧', '한글', '𪚥', '葛\u{E0100}', '辻\u{E0100}城', 'か\u309A', 'e\u0301', '一', 'A', '1', '。',
    'あいうえおかきくけこさしすせそた', '東西南北春夏秋冬朝昼夕夜天地人心', '雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨',
    ['寿限無', 'じゅげむじゅげむごこうのすりきれかいじゃりすいぎょのすいぎょうまつうんらいまつふうらいまつくうねるところにすむところ'],
    'ー', 'っ', '〜', 'ｱｲｳ', 'ＡＢＣ', '①②', '∞', '♪',
    '', '   ', 'あいうえおかきくけこさしすせそたち', ['雨', 'あ'.repeat(65)],
  ].map((t) => (Array.isArray(t) ? { text: t[0], reading: t[1] } : { text: t })),
  // two characters of the same or of different scripts that may hold each other's form (Stage 11: the
  // relations between a title's own glyphs, read by v1, across scripts); for looking only
  scripts: [
    '大太', '木本', '日白', 'へヘ', 'ぬめ', 'シツ', 'ソン', 'はほ', 'OQ', 'EF', 'PR', 'bd', 'ce', 'il', '18', '38', '69',
    '1年', '一1', '十+', '工エ', '口ロ', '力カ', '夕タ', '八ハ', '二ニ', '千チ', 'T字', 'I工', 'H日', 'X文', 'Good',
    'ロO', 'レL', 'へA', '一ー', '口。', '大、', '・丶', '!1', 'rG', '1年目', 'Go', 'Lと', 'Iと工',
  ].map((text) => ({ text })),
  public: [...STUDY_TITLES, ...HOLDOUT_TITLES, ...PROBE_TITLES, ...DIFFICULT_WORDS, ...EDGE_TITLES].map((t) => ({ text: t.text, ...(t.reading ? { reading: t.reading } : {}) })),
}
const work = mkdtempSync(join(tmpdir(), 'kotoba-v2-eval-'))
writeFileSync(join(work, 'titles.json'), JSON.stringify(sets))
const port = Number(process.env.PORT ?? 5197)
const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1', watch: null }, logLevel: 'error' })
await server.listen()
const child = spawn(process.execPath, ['tools/verify/cdp.mjs', `http://127.0.0.1:${port}`, work, 'tools/v2/eval/render.mjs'], { stdio: 'inherit', env: { ...process.env, EVAL_TITLES: join(work, 'titles.json'), EVAL_OUT: out } })
const code = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)))
await server.close()
try { rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }) } catch {}
process.exit(code)
