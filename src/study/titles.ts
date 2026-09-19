/**
 * Titles for the study sheet, chosen to cover different properties of
 * language and of the font's letterforms. `note` says what each one tests.
 */
export interface StudyTitle {
  text: string
  reading?: string
  note: string
}

export const STUDY_TITLES: StudyTitle[] = [
  // single characters
  { text: '嘘', note: '単漢字・読みなし' },
  { text: '嘘', reading: 'うそ', note: '単漢字・読みあり（拍数で切る回数が変わる）' },
  { text: '森', note: '単漢字・内部に同形（木）を持つ字形' },
  { text: '川', note: '単漢字・画の少ない字形' },
  { text: 'あ', note: '単かな' },

  // compounds
  { text: '言葉', note: '二字熟語' },
  { text: '空間断面', reading: 'くうかんだんめん', note: '四字熟語・読みあり・撥音' },
  { text: '東京特許許可局', note: '長い漢字列・字の反復（許）' },

  // inflected words
  { text: '触る', reading: 'さわる', note: '動詞・送り仮名' },
  { text: '美しい', note: '形容詞・無声化' },
  { text: '走れ', note: '命令形' },
  { text: '見えない', note: '否定' },

  // phrases with particles
  { text: '空をさがせ！', note: '目的語＋命令形＋記号' },
  { text: '子供の城', reading: 'こどものしろ', note: '「の」による依存・読みあり' },
  { text: '夜の位置', note: '「の」による依存・読みなし' },
  { text: '海のあと', reading: 'うみのあと', note: '「の」＋かなの名詞' },
  { text: '花が咲く', note: '主語「が」＋動詞' },
  { text: '雨の中の雨', note: '「の」×2・語の反復' },

  // coordination and glyph relations
  { text: '川または州', reading: 'かわまたはす', note: '選択の接続語・字形の包含（川⊂州）' },
  { text: '木と林と森', note: '並列×2・字形の段階' },
  { text: '大きな犬', note: '字形の包含（大⊂犬）' },
  { text: '日と白', note: '字形の包含（日⊂白）' },
  { text: '王の国', note: '字形の包含？（王と国の中の玉）' },
  { text: '人と入', note: '近い字形・包含ではない' },

  // repetition
  { text: 'ころころ', note: '畳語・拍の反復' },
  { text: 'ささやき', note: '拍の反復（さ×2）' },
  { text: '人々', note: '踊り字' },

  // scripts, marks and silences
  { text: 'コーヒー', note: 'カタカナ・長音（横書き）' },
  { text: 'カタカナ', note: 'カタカナ・字の反復（横書き）' },
  { text: 'きっと', note: '促音' },
  { text: 'ちょっと', note: '拗音＋促音' },
  { text: 'なぜ？', note: 'ひらがなのみ＋記号' },
  { text: '白い 犬', note: '空白を含む題' },
  { text: '1と2', note: '数字（後の等式・演算の候補）' },
]
