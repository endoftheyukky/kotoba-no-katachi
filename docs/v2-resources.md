# v2 が使う外部の資源（出典・ライセンス・帰属）

generator v2（spec-1）が使う、または作るときに使った外部の資源の一覧です。どれも固定したファイルで、版と sha256 を記録しています。実行時にネットワークや LLM は使いません。

「公開物」は、ビルドした公開ページ（`dist/`。`public/` の中身がそのまま入る）を指します。v2 はまだ公開していません（`CURRENT = 1`、`VERSIONS = [1]`）。公開するとき（spec-1 §16 段階12）の条件は、最後の「公開前に必要なこと」にまとめています。

## 一覧

| 資源 | 版・固定 | 用途 | 使う時点 | ライセンス | 帰属表示 | repo に含む | 公開物に含む |
|---|---|---|---|---|---|---|---|
| BabelStone IDS（Andrew West） | File Date 2025-06-27、sha256 `cc2a0a97…d78b1` | 字の構成の木（structure-1） | 表の作成時のみ | ファイル自身が「事実の集合として著作権の対象外」と記載 | 必須ではない。structure-1 の NOTICE に出典を記載 | 導いた表のみ（`public/v2/structure-1`）。原本は含まない | 導いた表のみ |
| KANJIDIC2（EDRDG） | database_version 2026-268、sha256 `aef74d1c…811c99` | 独立した字の集合（学年1–10）。字の階層 `character` を決める | 表の作成時のみ | EDRDG licence（CC BY-SA 4.0） | **必須**（EDRDG の名、ライセンス、出典の URL）。導いた情報は同じライセンス（継承） | 導いた情報のみ（structure-1 の階層、`src/v2/structure/scope-1.json` の `grade`）。原本は含まない | 導いた情報のみ（structure-1） |
| Noto Sans JP 500 | @fontsource/noto-sans-jp 5.3.0、Chrome 153 で測定 | 部品の位置・インクの測定（align-1）。紙面の字体 | 表の作成時（測定）と実行時（描画） | SIL OFL 1.1 | 字体の同梱物に含まれる（v1 と同じ） | 含まない（npm）。align-1 は測った数値だけで、字形は含まない | 字体ファイル（v1 と同じ）と align-1 |
| 日本語 WordNet（NICT） | wnjpn.db.gz、sha256 `64a14dcf…a505a5` | L0 の型つきの関係（resonance-1） | 表の作成時のみ | Japanese WordNet licence | **必須**：著作権表示、許諾の文、免責の文をすべての複製に残す | 導いた表のみ（`public/v2/resonance-1`） | 導いた表のみ |
| Princeton WordNet 3.0 | wnjpn.db に含まれる英語 WordNet の synset と関係（含まれることは wnjpn の構成からの推定。配布物で要確認） | 同上（has-part、is-a などの関係は英語 WordNet の関係） | 表の作成時のみ | WordNet 3.0 licence | 著作権表示と許諾の文を残す | 導いた表のみ | 導いた表のみ |
| chiVe v1.3 mc90（Works Applications） | sha256 `885c7db3…22b0` | L1 のパーセンタイル（resonance-1）。v1 の axes-1 | 表の作成時のみ | Apache License 2.0 | ライセンス文と NOTICE（`public/semantic/axes-1/LICENSE-chiVe.txt`、`NOTICE.txt`） | 導いた表のみ | 導いた表のみ |
| axes-1（v1 の表） | sha256 `f74cadff…f0ee5`（断片の sha256 を連結した値。Stage 11） | 補助の9意味軸 | 実行時 | chiVe から導いた表（Apache 2.0） | v1 と同じ | 含む | 含む（v1 と同じ） |
| KanjiVG（Ulrich Apel） | ローカルのファイル。repo には含まない | align-1 の外部評価（`tools/v2/align-eval.mjs`）のみ | 評価時のみ | CC BY-SA 3.0 | 配布しないので不要 | 含まない | 含まない |
| JMdict | — | 使っていない（src/v2・tools/v2 のどこからも参照なし） | — | — | — | — | — |
| Unihan | — | 使っていない | — | — | — | — | — |
| 字源のデータ（TODO-11） | — | **使っていない**（v2.0 の既知の制限。下を参照） | — | — | — | — | — |

## TODO-11：字源のデータ（Stage 11 の判断）

**v2.0 では字源のデータを使わない。TODO-11 は v2.0 の known limitation として残す。**

Stage 11 で、固定できる候補を次の条件で調べました（2026-09-26）。条件は、決定的であること、版を固定できること、由来を記録できること、実行時の LLM がいらないこと、再配布と帰属が明確であること、ベンチマーク以外の字にも一般化できることです。

| 候補 | 分類の欄 | 日本の字体 | ライセンス | 判断 |
|---|---|---|---|---|
| Kanjium（kanjidict.txt） | あり（象形・指事・会意・形声の4種） | あり（常用2136字すべてに分類。人名用は67%） | CC BY-SA 4.0 | 分類の**出典が記録されていない**。由来を記録できず、他の辞書から写した可能性を否定できない |
| makemeahanzi（dictionary.txt） | あり（指事がない3種） | 中国の簡体・繁体（常用の83%） | LGPL-3.0 | 字体が違う。指事がない。表への混在が難しいライセンス |
| 説文解字の電子化（shuowenjiezi/shuowen） | 本文の規則的な読み（「象形」「从X Y聲」） | 旧字体（異体字の対応表が別に要る）。国字は扱えない | Apache 2.0（本文は公有） | 由来とライセンスは最も明確。ただし後漢の篆書の分析で、現代の研究と食い違う字がある（困 など）。規則による読み取りと異体字の対応は新しい作業になる |
| Wiktionary | 一部は構造化されたテンプレート、ほかは自由記述 | 旧字体の頁を指すことが多い | CC BY-SA 4.0 | 抽出の手間が大きく、書式が一定でない。この環境からは取得も確認もできなかった |
| Unihan・KANJIDIC2・KanjiVG・cjkvi-ids | 分類の欄がない | — | — | 字源の出典にならない |

- 三つの表（Kanjium、makemeahanzi、説文）が同じ分類を付けた常用漢字は51%でした（1559字で比較）。二つずつでも63〜74%です。字源の分類は、一つの表を真とできるほど定まった事実ではありません。
- F による格下げは、Discovery を主から外すという強い効果を持ちます（§4.2）。その根拠が表によって変わる状態では、どれか一つを選ぶと、その表の癖がそのまま紙面の規則になります。
- 田・回 だけを直すための導入は、しません。

### v2.0 で何が起きるか（release note 用）

字源の型（origin、component-whole、lexical-candidate）は記録しません。そのため、次のことが起きます。

- **F の格下げは効かない**：象形の字の分解から来る enclosure や composition も、主な発見になります。
  - 田：囗 ⊃ 十 の enclosure。裏づけ（容器の L1）がないので GlyphItself（字そのものを大きく一つ）。spec では「発見なし」（Absent）。
  - 回：囗 ⊃ 口 の enclosure。同じく GlyphItself。spec では Absent。
  - 日：内容が画なので、関門で主にならない（spec どおり Absent）。字源とは関係なく、構造だけで決まる。
- **component-whole（B）がない**：囚・間・困 の範囲を紙面の規模にする根拠は、容器の schema（L1）だけです。
  - 囚：CONTAINER の L1 がある → NestedRegions（spec どおり）
  - 間：schema の L1 がある → NestedRegions
  - 困：L1 がない → GlyphItself（spec では component-whole L0 により範囲が紙面の規模になるはずの字）
- **lexical-candidate（音符が単独の語）**：もともと紙面には効かない型なので、紙面は変わりません（記録されないだけ）。

## 公開前に必要なこと（spec-1 §16 段階12 の条件）

1. **KANJIDIC2 の帰属表示**：EDRDG licence は、使っているアプリケーションやサイトの文書または頁で、EDRDG・ライセンス・出典を示すことを求めています。v2 を公開するとき、サイトの About（`index.html`）か、そこから辿れる頁に帰属を載せる必要があります。
   - v1 の About の本文は作品の文章です（`LICENSE-ASSETS.md`）。どこに置くかは制作者が決めます。
   - structure-1 と scope-1 の KANJIDIC2 から導いた部分（学年1–10の字の集合）は、CC BY-SA 4.0 を継承します。このことは `LICENSE-ASSETS.md` の第三者の素材に記載しました。
2. **日本語 WordNet と WordNet 3.0 のライセンス文**：resonance-1 の NOTICE には著作権表示だけがあり、ライセンスの文と免責の文がありません。どちらのライセンスも「すべての複製に」それらを残すことを求めています。
   - ライセンスの本文は、この環境からは取得できませんでした（外部への接続が制限されている）。
   - 手元の wnjpn の配布物にある文をそのまま `public/v2/resonance-1/` に置いてください。表そのもの（断片と manifest）は変えずに済みます。
3. **字体と chiVe**：v1 と同じ扱いで足ります。

## 変えていないもの

- structure-1・align-1・resonance-1 の断片、manifest、NOTICE は Stage 11 で変えていません。NOTICE も作成ツールの出力で、再生成の検査がバイト単位で比べるためです。
- 帰属の追記は、このファイル、`README.md`、`LICENSE-ASSETS.md` だけで行っています。
