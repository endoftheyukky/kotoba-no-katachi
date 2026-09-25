# 構成：生成器

生成器が、`Analysis`（[reading.md](reading.md)）と `Meaning`（[semantics.md](semantics.md)）から `Draft` を作る手順を書く。以下の定数はすべてコードの値そのままで、ファイルの場所は `src/poem/` からの相対パスで示す。`clip(x, lo, hi)` は値を範囲に収める関数（範囲を省くと 0…1）、`lean(key, x)` は [§3](#3-モチーフと韻) で説明するモチーフの引き寄せである。

```
compose(a, meaning)
  ├─ §1  操作の層 → Material（units, primary, modifiers）
  └─ parametricPage(a, material, rng.fork('parametric'), meaning)       parametric/index.ts
       ├─ §3  motifs = readMotifs(a, material)
       ├─ §4–6 traceParams()：図、行、紙面、行為                          parametric/params.ts, acts.ts
       ├─ §7  traceMarks()：図を紙面に置く                                parametric/trace.ts, paper.ts
       ├─ §8  materialParams() → 行為との配分 → materialMarks()           parametric/params.ts, material.ts, frame.ts
       └─ marks = [...図の印, ...素材の印]
  └─ §9  withFaces(a, material, marks)                                    face.ts
```

## 1. 操作の層

`compose()` の前半を、操作の層（operation layer）と呼ぶ（`compose.ts`、`operations/*`、`salience.ts`、`potential.ts`）。この層が出力する `Material` を、生成器の残りの部分が描く。

**提案。** 四つの操作が、それぞれ題の読み方を提案する（`propose(a)`）。提案は次の値をもつ。

- `focus`：何に注目した読みか
- `level`：1 = 語と字のあいだ、2 = 字の内側、3 = 音、4 = 字形の内側の白
- `origin`：`endogenous`（題そのものの構造）、`intrinsic`（一字の形）、`exogenous`（題が書かない部品）
- `roles`：主操作になれるか、修飾になれるか

| 操作 | focus の種類 | 読むもの |
| --- | --- | --- |
| proliferation（増やす） | `repetition`、`plain` | 反復、字・モーラ・音のくり返し、ひとつの字の中でくり返される形（`echoForm`） |
| decomposition（分ける） | `parts`、`joint` | `structuralParts`（島、または開いた継ぎ目）、読みがあるときの拍による切れ目、漢字の語幹＋かなの語尾 |
| transformation（変える） | `pair` | 題の字どうし（または部品の一覧の部品と）の字形の包含・類似、清濁（ぜ = せ + ゛） |
| absence（欠けさせる） | `absence`、`counter` | 否定、っ（沈黙）、関係を表す語。counter（画に囲まれた白） |

各提案がどの値を割り当てるかは、各操作のファイルの先頭にある `rules` 配列に、規則ごとに書いてある。

**点数。**

```
linguisticSalience = relationStrength^0.4 · distinctiveness^0.4 · coverage^0.2     （どれかが 0 なら 0）
visualPotential    = legibility · structure                                        （focus の種類ごと。potential.ts）
poeticPotential    = √(linguisticSalience · visualPotential)
```

**特徴の降下**（`compose.ts`）。主操作になれる候補を、次の五つの層に分けて `poeticPotential` で順位を付ける。

1. 題そのものの提案のうち、level 2 以下
2. 1 に、level 2 以下の exogenous な提案を加える
3. 2 に level 3 を加える
4. 3 に level 4 を加える
5. すべて

層 1 から始め、今の層の最高点を `upper`、最後の層の最高点を `deepest` として、次のように決める。

```
upper ≥ SETTLED (0.6)                                   → この層に決める
upper < DESCENT_FLOOR (0.32)                            → 一つ下の層へ
deepest ≥ DECISIVE (1.5) · upper かつ deepest ≥ 0.6    → 下へ。ただし下の候補が同じ観察を読んでいる
                                                          （根拠が共通する）なら、この層に決める
それ以外                                                → この層に決める
```

主操作は、決めた層の先頭の候補である（variant 0。サイトは別の variant を使わない）。

**修飾。** ほかの提案は、次の条件をすべて満たせば、修飾として素材に働きかけられる。

- 主操作と同じ操作ではない
- `roles.modifier` をもつ
- salience が 0.4（`MODIFIER_SALIENCE`）以上
- 空いている枠がある。枠は、*素材*の修飾（decomposition か transformation。主操作がどちらかなら埋まっている）と、*引き算*の修飾（absence）が一つずつ

修飾は `apply()` で units を書き換える。

| 操作 | 主操作のとき | 修飾のとき |
| --- | --- | --- |
| absence | その字を `absent` にする（書かれる字が何も残らなくなる場合を除く） | 同じ |
| decomposition | units は変えない | `parts`：字を部品に分け、少し離して書く |
| transformation | units は変えない | `minus`：外側の字形が出てくるたびに、内側の字形の墨を取り除いて書く |

**紙面がここから受け取るもの：**

- `units`：素材の units を読む順に並べたもの。`absent`、`parts`、`minus` は操作の層が設定したまま
- `primary.poeticPotential`（紙面の `potential`、§5）
- `primary.focus`：`pair` で包含なら `operation = relation.score`、`parts` なら `operation = 0.55 + 0.45 · echo.similarity`。focus は紙面の主題（§5）も決め、`nesting` モチーフ（§3）に渡り、どの印を読み取り用の字体で書くか（§9）も決める

## 2. 字ごとに読むもの

`n` を空白以外の字の数として、次の値を求める。

```
weight_i  = clip(unit i を含むモーラの重みの平均, 0.6, 2.2)   （該当なしなら 1）   「拍」
ink_i     = unit i の字形の density（読み取り用の字体）
contrast  = clip(std(ink) / mean(ink) / 0.45)
size_i    = clip((ink_i / mean(ink))^(0.5 · contrast), 0.8, 1.25) · 0.92^run_i
            run_i = 直前の 3 つの unit のうち、同じ字の数
breaks    = トークンが変わる unit の位置
```

## 3. モチーフと韻

`readMotifs(a, material)`（`parametric/motif.ts`）は、次の六つを [0, 1] の値で読む。

```
repetition   = clip(covered / n · (0.45 + 0.55 · clip((occurrences − 1) / 2)))
               covered：反復か字のくり返しに含まれる字の数。occurrences：そのどちらかの最多回数
pairing      = clip(terms · (0.6 + 0.4 · clip((tokens − 1) / 3)))       terms = 並列なら 1、係りなら 0.65、それ以外 0
nesting      = clip(max(read, focus が parts なら 0.75, focus が counter なら 0.5) + 0.1 · clip(counters / 3))
               read = 題の漢字どうし（部品の一覧は除く）で最も強い 0.65 以上の包含の点数から clip((score − 0.5) / 0.45)
               counters：題のすべての字について数える
absence      = clip(absent な units / units + 否定があれば 0.45)
articulation = clip((tokens − 1) / max(1, n − 1) / 0.5)
echo         = clip(0.7 · ends + 0.5 · special / morae)
               ends：鏡像なら 1、最初と最後の字が同じなら 0.9、同じモーラなら 0.7、同じ母音なら 0.45、
                     同じ文字の種類なら 0.15、それ以外 0
               special：N / Q / R / 無声化したモーラ
```

多くのパラメータは、題がもつモチーフごとに、その強さに応じて**和音**（chord）の値へ引き寄せる（`drawn`、`RHYME = 0.6`）。

```
for motif in [repetition, pairing, nesting, absence, articulation, echo]:
  if CHORDS[motif][key] exists:  v ← v + 0.6 · motifs[motif] · (CHORDS[motif][key] − v)
```

| モチーフ | 和音の目標値 |
| --- | --- |
| repetition | rows 3.2, closure 0.45, corners 0.25, scale 0.12, offset 0.25, density 0.8, onPage 0.5, fineness 0.75 |
| pairing | eccentricity 0.35, opening 0.18, corners 0.45, offset 0.55, scale 0.2 |
| nesting | scale 0.5, hierarchy 3.2, closure 0.25, tangency 0.25, onForm 0.7, cut 0.4, density 0.75, fineness 0.6 |
| absence | offset 0.75, scale 0.09, decay 0.15, corners 0.35, onPage 0.6, spread 0.7, density 0.6 |
| articulation | corners 0.8, shear 0.6, closure 0.3, offset 0.45, spread 0.4 |
| echo | closure 0.7, corners 0.15, tangency 0.6, fineness 0.8, density 0.5, onForm 0.35 |

構造が共通する題は、その構造が関わるパラメータでは同じ値に引き寄せられ、それ以外では離れたままになる。これを韻と呼んでいる。

## 4. 図（`parametric/params.ts`）

題を一本の曲線としてたどり、それを `rows` 回書く。

```
repeatShare  = covered / n                       （repetition モチーフと同じ）
loops        = clip((occurrences − 1) / 2)
endEcho      = 上の ends と同じ。ただし同じモーラは 0.75、同じ文字の種類は 0.2
headFinality = 係りがあれば clip((head − dependent) / max(1, tokens − 1))、なければ 0
turnDensity  = clip((tokens − 1) / max(1, n − 1))

closure      = lean(clip(0.55 · repeatShare · (0.45 + 0.55 · loops) + 0.4 · endEcho
                         + 0.3 · headFinality + 0.25 · turnDensity))          回転の総量（周回数）
corners      = lean(clip(turnDensity / 0.5))                                  回転のうち語の切れ目で曲がる割合
asymmetry    = clip(|ln(w(A) / w(B))| / ln 4)     A, B：係りまたは並列の二つの項、
                                                   w(token) = Σ ink · (1 + length / 4)
eccentricity = lean(clip(0.4 · asymmetry))
opening      = directed ? lean(clip(directed · clip((closure − 0.35) / 0.5) · (0.12 + 0.3 · asymmetry), 0, 0.4)) : 0
               directed = 係りなら 1、inflection なら 0.6、それ以外 0
tangency     = lean(clip(1.4 · closure − 0.2))                                印が曲線に沿ってどれだけ回るか
branch       = 並列があるとき、項ごとに units をまとめる（接続の語は前の項につく）。
               最初の項の最初の unit で枝分かれし、開き fan = clip(0.08 + 0.03 · groups, 0, 0.25) 周
side         = rng.next() < 0.5 ? +1 : −1                                     紙面で唯一の乱数

strength     = repeatShare · (0.4 + 0.6 · loops)
rows         = clip(lean(1 + 7 · strength + 4.2 · kept.crowd), 1, 8)          丸めない。2.4 = 二回と 40 %
spacing      = 1 + 0.35 · (1 − repeatShare)
shear        = clip(lean(clip(1 / units + 0.6 · turnDensity, 0, 1.2)), 0, 1.2)
decay        = clip(lean(clip(0.3 · runs / units + 0.2 · absent / units, 0, 0.4)), 0, 0.4)
               runs：直前の unit と同じ unit の数
```

`kept.crowd` は、行為が競い合ったあとの crowd の強さである（§6）。

## 5. 紙面（`parametric/params.ts`、`paper.ts`）

```
leaning   = coverage · max_axis |axis|                    （意味がなければ 0）
potential = max(clip(primary.poeticPotential), clip(0.3 + 0.45 · leaning))
operation = 主操作の focus：pair で包含 → relation.score、parts → 0.55 + 0.45 · echo.similarity、それ以外 0
press     = clip(1 − 0.15·still − 0.12·alone − 0.1·fading − 0.12·open + 0.4·heavy + 0.45·closed + 0.25·stirred, 0.72, 1.5)
result    = (書かれる units ≤ 1 ? 0.9 : 0.25) · operation
scale     = clip(lean(clip((0.04 + 0.22 · potential) · press + result, 0.035, 1.15)), 0.035, 1.15)
            一字の em の大きさ（紙面に対する割合）
occupancy = clip(scale · max(1, units) / 0.86, 0.05, 1.3)
offset    = clip(lean(max(clip(1.05 − occupancy), clip(3 · (occupancy − 1))))
                 + 0.3·alone + 0.2·far + 0.15·open − 0.3·closed)             0 は中央 … 1 は端に寄る
toward    = atan2(−along.y + 0.8 · side · across.y + 1.4 · (falling − rising),
                  −along.x + 0.8 · side · across.x)
            along / across：書字方向と、次の行へ進む方向
hierarchy = clip(lean(clip(1 + 3.2 · operation + 1.4 · clip((potential − 0.5) / 0.5), 1, 5)), 1, 5)
```

`hierarchy > 1.02` のとき、**主題**を `√hierarchy` 倍大きく、それ以外の unit を `√hierarchy` 倍小さく書く。主題とは、主操作の反復に含まれる units、主操作が部品や counter を読んだ字、または主操作の組の外側の字（出てくるたびすべて）である。

## 6. 行為：字に加えること（`parametric/acts.ts`）

**配分。** 意味の極（[semantics.md](semantics.md#4-軸から極へ)）とモチーフから、行為ごとの素の強さを求める。

```
split    = clip(severed + 0.55 · pairing)
spread   = clip((0.8·far + 0.6·open + 0.35·still) / 1.2 + 0.25 · articulation)
gather   = clip(0.5 · (many + joined))
withdraw = clip(0.8·alone + 0.35·fading + 0.3·far − 0.5·many)
erode    = clip(0.85·fading + 0.25·falling + 0.3 · absence)
lean     = clip(stirred)
crowd    = clip(0.9·many + 0.3·stirred)

lead     = max(raw)
kept_k   = raw_k · (raw_k / lead)²                  最も強い行為はそのまま。半分の強さなら 1/8 になる
leader   = argmax raw（lead > 0.05 のとき）
```

行為は競い合うので、一枚の紙面には主な身振りがひとつあり、ほかの身振りはなめらかに弱まる。各行為の**形**は、つねに字形、音、語の切れ目から決まり、意味は強さだけを決める。

| 行為 | 規則（`e` は競い合ったあとの強さ） |
| --- | --- |
| **gaps**（間） | unit のあいだごとに、平均の重みを単位として `1.6 · e.spread · (0.6 + 0.4 · boundary) − 0.35 · e.gather` だけあける。継ぎ目（最初の語の切れ目、なければ中央）には `2.6 · e.split` を足す |
| **withdraw**（退く） | `e.withdraw > 0.03` かつ n > 1 のとき、書かれる unit のうち `ink · weight` が最小のものが、`toward + π` の方向（紙面の空いた側）へ `1.2 + 5 · e.withdraw` 歩離れ、`0.3 · e.withdraw` だけ小さくなる。最後の行でだけ起こる |
| **erode**（すり減る） | `e.erode > 0.03` かつ二字以上書かれるとき、unit i は `amount = clip(0.75 · e.erode · (i / (n−1))^1.3, 0, 0.6)` だけ失う（最初の字は完全に残り、最後の字が最もすり減る）。構造上の部品が 2 つ以上ある漢字は、読む順で遠い部品から丸ごと失う。`gone + next ≤ amount + 0.12` で、35 % 以上が残る範囲に限り、最後の部品は残す。それ以外の字（かな、部品に分かれない漢字）は `amount ≥ 0.3` のときだけ、いちばん薄い側から大きさの `min(0.34, amount / 2)` を削る。書かれる字が一字だけの題はすり減らない |
| **lean**（傾く） | 書かれる unit はそれぞれ `(26 · e.lean + held) · inkLean` 度傾く。`held` は N / Q / R / 無声化したモーラで 7。`inkLean = clip(6 · (列の重心 − ½), −1, 1)` なので、墨が中央にある字形は傾かない |
| **cut**（割る） | `e.split > 0.12` のとき、退かずすり減らなかった漢字のうち、構造上の部品が島か開いた継ぎ目（closure ≤ 0.35）で、継ぎ目が墨を最も均等に分ける字（`1 − |share₀ − share₁| > 0.35`）を継ぎ目で割る。二つの半分は、継ぎ目を横切る方向に大きさの `0.12 + 0.45 · e.split` だけ離れ、継ぎ目に沿ってその 0.7 倍ずれる（割った 束 が閉じて 東 に見えないように） |
| **crowd**（群がる） | §4 で読む。`rows` を増やす |

出力を見てから足した規則がある。かなと一字だけの題は、部品単位ではすり減らさない（別の字になってしまう。愛 → 受）。詰まった画を通る割り方はしない（土、大、本 は壊れて見えるだけになる）。行為は一字につきひとつまでとする。

## 7. 図を紙面に置く（`parametric/trace.ts`、`paper.ts`）

**曲線。** タートルが units をたどる。一歩ごとに重みの分だけ進み、次の分だけ曲がる。

```
closing = closure · (1 − opening);  total = 2π · closing · side
切れ目ごとに：+ total · corners / (breaks + closing)
一歩ごとに：  + (total − total·corners [切れ目があるとき]) / (n − 1 + closing)
```

すき間の数より一か所多く分けるのは、閉じる曲線が最後の字を最初の字の上に書かないようにするためである。`eccentricity ≥ 0.02`、`closure ≥ 0.45`、units が 4 つ以上のとき、曲線を重心のまわりに `1 + eccentricity · cos(θ − θ_heaviest)` 倍ふくらませる。枝分かれは、幹をたどったあと、各項を分岐点からの腕としてたどり、そこでの向きを中心に扇状に開く。最初の向きは 0（横書き）か π/2（縦書き）。

**行。** たどる動きを `⌈rows⌉` 回くり返し、最後の行には `round(frac · n)` 個の units を置く。行 r は `(across · gap + along · shear · step) · r` だけ動かし、`max(0.4, (1 − decay)^r)` 倍に縮める。`gap = max(spacing · step, sweep + 0.95 · 最小の重み)` なので、行どうしは交差しない。行為による間は書く向きに沿って足すが、`scale` が求める大きさのまま紙面に収まる範囲までに抑える。

**収め方**（`fit`、`measure`、`stand`）：

```
want      = scale · PAGE / (0.86 · 最小の重み)                            図の単位 → 紙面の単位
most      = (1 − 2 · 0.04) · PAGE / max(外接矩形の幅, 高さ)                紙面のどこでも収まる倍率
k         = min(want, most)
centre    = PAGE/2 + (cos toward, sin toward) · offset · |PAGE − span| / 2
em        = min(1.15 · PAGE / 最大の size, 0.86 · 最小の重み · k) · min(1, room)
room      = 書かれる units のすべての組についての  距離 · k / (want_pair · em₀)  の最小値
            want_pair = ½ (size_u + size_v) · (tangency > 0.2 ? 1.45 : 0.92 + 0.53 · min(1, (|lean_u| + |lean_v|) / 24))
```

退いた字は、収め方の計算に加えない。そのあと、書かれる字の中心が紙面の端から少なくとも `edgeKeep(size) · size` 離れるように、中心を軸ごとに動かす。

```
edgeKeep(size) = 0.62 + (0.26 − 0.62) · clip((size / PAGE − 0.12) / 0.28)
```

紙面の 12 % までの字は余白をとって紙面に収まり、40 % 以上の字は最大で半分ほど端で切れてよい。すべての字を満たす中心がなければ、図を 0.85 倍にして試し直す（6 % まで）。字が `0.035 · PAGE` より小さくなるなら、縮める代わりに行を半行ずつ減らす。印の大きさは `max(0.035 · PAGE, em · size_i)` である。

**印ひとつずつ。** 回転は `(その位置の向き − 最初の向き) · tangency`（度）`+ lean`。退いた字は、行為が送った場所、元の場所、最も近い紙面の角のうち、ほかの書かれる字に重ならない最初の場所に置く。すり減りと割りは字形を切り取る（`keep`。操作の層が設定した parts があれば、その共通部分をとる）。切り取るとすべての部品が消える場合は、字形を丸ごと描く。最後に、部品に分けて描く字は、描かれる部分が端の規則を満たすよう、まとめて少し動かす。

## 8. 素材（`parametric/params.ts`、`material.ts`、`frame.ts`）

素材は、題そのものの字で作る小さな印である。図そのものの幾何の上に置く。

**パラメータ**（`materialParams`）。**核**（nucleus）は、書かれる印のうち最も大きいものとする。

```
repeat    = 最も多くくり返される字：clip((count − 1) / 3 + 0.3)、なければ 0
inner     = max(核の中にある、題の漢字どうしの最も強い 0.65 以上の包含の点数,
                核が自分の部品の中で 2 回以上くり返す形（森 の三つの 木）を readPart で読んだ点数)
rest      = clip(ほかの字の数 / n)
erasure   = clip(absent / units + 否定があれば 0.3)
onForm    = lean(clip(inner))                                          核の墨の上
onRing    = lean(clip(max(並列 1, 係り 0.6) · (0.35 + 0.5 · repeat)))    読みの流れのまわり
onPage    = lean(clip(0.7·erasure + 0.25·clip(repeat − inner) + 0.6·many + 0.45·fading + 0.3·stirred))   塵
offered   = 0.55·repeat + 0.4·inner + 0.3·erasure + 0.15·rest + 0.45·many + 0.35·fading + 0.2·stirred
density   = (offered < 0.18 または onForm + onRing + onPage < 0.15) ? 0 : lean(clip(offered))
fineness  = lean(clip(0.3 + 0.4·repeat + 0.25·erasure + 0.3·clip((ink(nucleus) − 0.12) / 0.16)))
regularity= clip(1 − 0.5 · special / morae)
cut       = 核の中に包含があれば lean(containment)、なければ 0             このときは残りの部分から標本をとる
radius    = clip(0.12 + 0.14·repeat + 0.06·rest, 0.1, 0.32)
spread    = lean(clip(0.8·erasure + 0.35·rest − 0.2·repeat))
sources   = { repeat, inner, rest: 0.5·rest, self: repeat + inner + 0.5·rest < 0.2 なら 0.3 }
```

**行為との配分：** `lead > density` なら `density ← density · (density / lead)²` とする。

**配置**（`materialMarks`）。乱数は使わない。格子点のどれを落とすかは固定の 4 × 4 の Bayer ディザで決め、ずらしは固定の `hash2` で決める。

- 三つの重み（form、ring、dust）を正規化する。`density ≤ 0.02` なら何も置かない。
- **frame**：書かれる units の位置を読む順に並べ、間隔が max(中央値の 2.2 倍, 大きさの 1.2 倍) を超えるところで筋に分ける。`s` は読みに沿った位置（0–1）、`d` は読みからの距離。
- **form**：核を `max(1.12 · size, PAGE · (0.32 + 0.38 · clip((takes − 0.45) / 0.55)))` まで大きくし（`takes = onForm · (0.4 + 0.9 · density)`、拡大は 4 倍まで）、紙面の中央へ寄せる。核と一緒に回した格子で墨を標本にとる。格子の間隔は `size / (11 + 13 · fineness)`、粒の大きさは `max(step · (0.62 + 0.25 · (1 − fineness)), 0.014 · PAGE)`。`ink · onForm · (0.4 + 0.9 · density) > dither` の点を残す。墨のマスが 45 以上、粒が 32 以上、マスの半分以上が残ったときだけ、form は**成り立つ**。成り立てば粒が核の代わりになる（粒は核の字を `represent` する）。成り立たなければ、form の重みを ring と dust に回す。
- **ring**：筋ごとに、そのまわり `max(radius · PAGE, 0.7 · nucleus)` の輪に粒を並べる（一字だけなら円）。粒の大きさは `clip(nucleus · (0.2 + 0.16 · (1 − fineness)), 0.02, 0.09) · PAGE`、数は `max(5, round(min(48, loop / (1.35 · size)) · (0.35 + 0.65 · density) · w_ring))`。`w_ring` は ring の正規化した重み（読めなかった form から回った分も含む）。
- **dust**：筋ごとに、それに沿った方向と横切る方向の格子を張る。間隔は `max((0.075 − 0.05 · fineness) · PAGE, 1.3 · size)`、届く範囲は `PAGE · (0.09 + 0.62 · spread)`。読みからの距離が格子の列と合わない点（曲線の別の部分に属する点）は落とす。`dither(i+2, j+1) < 0.15 + 0.5 · density` の点だけを候補にし、`thinning · fade · clear · w_dust · (0.35 + 0.9 · density) > dither(i, j)` なら残す。`thinning = clip(1.15 − s)`、`fade = clip(1 − (d / reach)^1.6)`、`clear` は書かれた印の上に置かないための値。
- 粒の字は、決まった順序（`(7i + 13j) mod 100`）で sources の割合どおりに割り当てる。粒どうしは重ねない。書かれた墨の上にも置かない（中心と、大きさの ±0.3 の四点で確かめる）。どの粒も紙面の 2–98 % の範囲に収める。

## 9. 字体（`face.ts`）

墨の読み取りから生まれる印は、読み取り用の字体（Noto Sans JP 500）で書く。切り取った字、ずらした字、墨を引いた字、主操作の字形の組の二つの字、主操作が counter を読んだ字がこれにあたる。それ以外は書き用の字体（Noto Serif JP 300）で書く。`0.035 · PAGE` より小さい派生の印（粒）は、その大きさでも画がつぶれない読み取り用の字体で書く。明朝体は、その字を含み、墨があるときだけ使う。

## 10. 切り取りのまとめ

- **紙面の端**はすべてを切り取る（SVG の紙面のクリップ）。字がどこまで切れてよいかは `edgeKeep(size)`（§7）で決まる。小さな字は切れず、とても大きな字は最大で半分ほど切れる。
- **行為**は em 空間で字形を切り取る。すり減りは部品を丸ごと残す（または、いちばん薄い側の帯を除いて残す）。割りは二つの半分をそれぞれ残す。
- **操作の層の修飾**：decomposition は字を部品ごとに描き（部品ごとにクリップ）、transformation は別の字形の墨を取り除く（マスク）。

## 11. 構造上つねに成り立つこと

次の規則は、紙面を作る途中で守らせている。あとから検査して直すわけではない。

- 行為によって字が失われることはない。退いた字は紙面に残し、すり減った字は部品をひとつ残し、すべてを消す切り取りは取り消す。
- 書かれる二つの字が重なることはない（大きさは最も近い組に合わせて決める）。
- どの字も `edgeKeep` の分は紙面に残る。
- 粒は、書かれた墨の上にも、ほかの粒の上にも置かない。
- 乱数による選択は `side` だけである。

出力についてこれらを確かめる不変条件の監査は、オフラインで行う（[reproducibility.md](reproducibility.md#検証)）。
