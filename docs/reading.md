# Reading a title

What the system reads before it composes anything: the input, the language,
and the letterforms. Everything here is shared by v1, v2c and v3. The meaning
table, read by v3 only, is in [semantics.md](semantics.md).

## 1. Input

### The address and the input line

A poem is addressed by `?title=…&reading=…&v=…` (`src/main.ts`):

- `title` — the words.
- `reading` — optional, the reading of the whole title in kana.
- `v` — the generator: `1` → v1, `3` → v3, anything else or absent → v2c
  (`versionOf`, `src/poem/generators.ts`). New words typed on the site are
  written in v3 and get `&v=3`; v2c keeps the addresses it had.

On the input line a reading may follow the words in brackets:
`子供の城（こどものしろ）`. The line is split by

```
/^(.*\S)\s*[（(]\s*([\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+)\s*[）)]\s*$/u
```

Brackets holding anything other than kana, ー, ・ and spaces are part of the
words.

### Normalization (`src/title.ts`)

```
text    = NFC(title), line breaks → one space, trimmed
          empty → refused; more than 16 code points (MAX_TITLE) → refused
reading = NFC(reading), all whitespace removed, katakana → hiragana; empty → none
variant = 0            (the site never sets another)
```

The page then refuses a title containing any character outside the Unicode
ranges declared by the bundled reading face's `@font-face` rules
(`uncovered()`, `src/glyph/coverage.ts`) — see [Coverage](#coverage). The
archive server applies the same `normalizeTitle` again to what it receives.

The seed is computed from `text`, `reading` and `variant`
([reproducibility.md](reproducibility.md#the-seed)).

## 2. Language (`src/language/`)

### Graphemes and scripts

The title is split into code points (`Array.from`). Each gets a script
(`script.ts`): `hiragana` U+3041–309F, `katakana` U+30A0–30FF, `kanji`
(U+4E00–9FFF, U+3400–4DBF, U+F900–FAFF, 々), `mark` (ー), `symbol` (a fixed set
of punctuation and spaces: ！？、。「」（）…〜・／： etc.), else `other`
(Latin letters, digits). Small kana (ぁぃぅぇぉゃゅょゎっ ァィゥェォャュョヮッヵヶ) are flagged
`small`.

### Segmentation (`segment.ts`)

There is **no morphological analyser and no dictionary**. The rule segmenter
(`ruleSegmenter`, behind a `Segmenter` interface) uses only what is visible:

1. The title is cut into runs of one script (ー joins the run it lengthens;
   every symbol is a run of its own).
2. Kanji, katakana and `other` runs are nouns; a symbol run is a symbol.
3. A hiragana run after a content run:
   - starts with a function word → that word is split off
     (`あるいは もしくは ならびに または および` conjunctions,
     `から まで より` particles);
   - is a single character in `の を に へ が は で と も や か` → a particle;
   - is longer and starts with `の を へ が は` → that character is a particle;
   - a hiragana run directly after a kanji run is **okurigana**: it joins the
     kanji token (`触る`, `美しい`), which is then a verb if it ends in an
     e-row kana (imperative, `走れ`), an adjective if it ends in い, a verb if
     it ends in a u-row kana, otherwise a noun; the index where the kana
     begins is kept as `stem`.
4. Any other hiragana run is a noun (or an imperative verb by the same ending
   test).

### Readings and morae (`analysis.ts`, `morae.ts`, `kana.ts`)

- **A kanji has no sound unless a reading is given.** If `reading` is given, it
  is aligned to the writing by a regular expression in which every kana of the
  title is a literal anchor (ー matches ー or a vowel) and every run of kanji is
  `(.+?)`. If it does not match, `readingAligned` is false and the kanji stay
  unread.
- The sound sequence is the kana of the title, with each aligned kanji run
  replaced by its reading; an unaligned kanji run stays a single `unread`
  mora.
- Morae: `cv` (onset, vowel, manner of articulation), `Q` (っ), `N` (ん),
  `R` (ー, taking the previous vowel), `unread`. A small glide or vowel joins
  the preceding `cv` mora of the same token (き+ゃ is one beat; `palatal`).
  Weight 1 for every mora, **2 for an unread kanji run**.
- Devoicing: a non-palatal `cv` mora with vowel i or u and a voiceless onset
  is `devoiced` when the next mora is `Q` or has a voiceless onset, or, at the
  end, when it is す.

### Phonological features (`phonology.ts`)

- `voicing` — a kana written with a voicing mark: its canonical decomposition
  (NFD) gives the unvoiced base and the mark (ぜ = せ + ゛). Nothing is looked
  up in a table of pairs.
- `special` — every `Q`, `N`, `R` mora.
- `echo` — the same mora, vowel or onset returning, over the read morae but
  measured against all morae: a mora needs ≥ 2 members; an onset ≥ 2 members
  and ≥ 60 % of the beats; a vowel ≥ 3 members and ≥ 75 %.

### Relations (`analysis.ts`)

| relation | rule |
| --- | --- |
| `recurrence` | the same grapheme (as hiragana), mora key or vowel occurring more than once (`unit` = grapheme / mora / vowel) |
| `reduplication` | a unit of 1…⌊n/2⌋ graphemes repeated in immediate succession, longest first, without overlaps; 々 and ゝ repeat the character before them (ささ, 許許, ころころ, 人々) |
| `mirror` | the non-symbol graphemes (≥ 3, at least 2 distinct) read the same backwards (雨の中の雨) |
| `relationWord` | a particle or conjunction token |
| `coordination` | a conjunction, or と / や / か, between two content tokens |
| `dependency` | any other particle between two content tokens (dependent → head) |
| `silence` | a `Q` mora |
| `negation` | a token ending in ません / なかった / ない / なく / ぬ / ず, or a noun of ≥ 2 characters starting with 無 不 非 未 |
| `separation` | a whitespace symbol between two tokens |
| `imperative` | a verb token in the imperative form |
| `inflection` | a token with a kanji stem and a kana ending |

### Writing direction

Horizontal when the title has more katakana than hiragana and kanji together;
otherwise vertical. It sets the reading direction of every layout
(`directions()`, `src/poem/spatial/common.ts`) and turns ー 〜 … and similar
marks by 90° in vertical writing; small kana sit in a corner of their cell
(`src/glyph/layout.ts`).

## 3. Letterforms (`src/glyph/`)

Every reading of a glyph is a reading of **these particular letterforms**: the
computer measures the ink of the bundled font and compares shapes. None of it
is a fact about the characters, and another font would read differently.

### Faces

| face | font | used for |
| --- | --- | --- |
| reading face (`sans`) | Noto Sans JP 500 | every measurement and relation; marks that are readings of ink |
| writing face (`serif`) | Noto Serif JP 300 | the title written as writing (`src/poem/face.ts`) |

Both are bundled from `@fontsource/noto-sans-jp` and `@fontsource/noto-serif-jp`
(version 5.3.0, pinned by `package-lock.json`) as unicode-range subsets, and
loaded with `document.fonts.load()` before any measurement
(`GlyphLibrary.prepare`). If the fonts cannot be loaded, `prepare` throws and
no page is drawn.

### Coverage

`covers(face, char)` checks the code point against the `unicodeRange` of the
`@font-face` rules the page registered for that face and weight — not a
rendering, because a rendering would succeed in a system fallback font. A
character outside them would be measured and drawn in whatever font the
device falls back to, so the page refuses it instead. The serif face is used
for a mark only if it covers the character and has ink for it.

### Measurement (`metrics.ts`)

Each glyph is drawn once with `fillText` at 200 px on a 600 × 600 canvas.
Pixels with alpha > 8 are ink. From the ink's bounding box:

- `density` — Σ alpha / 255 over the box, divided by 200² (ink per em square).
- `half`, `pen` — half the ink box, and the pen origin relative to the ink
  centre, in em units (EM = 100). Every glyph is drawn centred on its ink.
- `rows`, `cols` — ink per band, 40 bands each way, normalised to max 1.
- `grid` — 24 × 24 coverage.
- `seam` — the thinnest place of the column and row profiles in their middle
  (28 %–72 %), smoothed over ±2 % of the length, scored as its ink against the
  mean; the axis with the lower score wins. `share` is the ink on each side.
- `islands` — 8-connected components with alpha > 64 holding ≥ 1.5 % of the ink.
- `ink` — the cropped alpha raster, kept for every later reading.

### Parts (`parts.ts`, `operations/decomposition.ts`)

`structuralParts(char)` is how the system splits a glyph:

- if the glyph has ≥ 2 islands → the islands (at most 6), each kept exactly;
- otherwise `partition(m, 5, 0.35)`: repeatedly cut the part holding the most
  ink at its thinnest line, looked for across 15–85 % of the part, only where
  the letterform is already open (closure ≤ 0.35) and each side keeps ≥ 6 % of
  the ink.

A part is a set of rectangles in em space, so it can be kept by a clip.

### Legibility (`legibility.ts`)

`readPart` asks whether a part reads as a character: its ink, scaled onto a
32 × 32 grid with its proportions kept, is compared with whole glyphs of the
inventory — 68 components and simple characters
(`木口日月目田人亻大小山川土士工王子女力刀又寸十八心火水氵米糸言金門立石耳貝車虫竹示禾犬牛手扌艹宀穴广辶冖夕止皿巾己弓欠斤方文白夫井中上下`),
five strokes (`一丨丿丶乙`), and the title's own characters. A reading needs
≥ 0.85 mutual overlap (one cell of tolerance) and aspect ratios within a
factor 1.6; a part holding ≥ 85 % of the ink is the glyph itself, not a part.

### Relations between glyphs (`relation.ts`)

`relate(inner, outer)` lays one glyph over another on a 64 × 64 grid covering
±62 em units around the ink centres:

1. Search: scale ∈ {0.94, 1, 1.06} × offsets −12…12 step 4 (em units), then
   around the best: scale ± 0.03 × offsets ± 3 step 1.
2. Score each placement by **lift above chance**: `overlap` = share of the
   inner's cells on the outer's ink; `chance` = the outer's ink share inside
   the inner's bounding box; `lift = (overlap − chance) / (1 − chance)`.
   `containment` is the best lift.
3. Residue: the outer's cells not covered by the (one-cell dilated) inner,
   split into 8-connected pieces; pieces smaller than max(3 cells, 3 % of the
   outer) are dropped. `residue.share` is the rest as a share of the outer;
   `substance` the share of it in kept pieces; `pieces` their rectangles.

Among the title's distinct characters (`readRelations`), a pair is tested
only when the ink ratio is 0.3–1.18, and read as:

- **similarity** — both directions have containment ≥ 0.65
  (`RELATION_THRESHOLD`) and both residues ≤ 15 % (人 ≈ 入, 大 ≈ 犬);
- **containment** — otherwise, in each direction where the inner has at most
  1.05 × the outer's ink (川 in 州). Relations below 0.65 are kept but most
  rules ignore them.

Against components the title does not write (`readInventory`, `origin:
'inventory'`), the conditions are stricter: the component's density ≥ 0.24
(no light skeletal forms), its ink 0.3–1.05 × the character's, a coarse lift
≥ 0.35 at offsets {−8, 0, 8}, then containment ≥ 0.8, residue 6–80 %,
substance ≥ 0.6, at most 4 pieces; strokes are never the inner glyph; one
reading per character. Because the search moves a component by at most ±12 em
units and scales it by at most ±9 %, a component drawn much smaller inside a
character (a typical 偏 or 旁) is not found.

Voicing: for each voiced kana, `relate(base, voiced)` must reach containment
≥ 0.65 for the font to show the base inside it; that relation is kept in
`analysis.voicing`.

### Interiors (`interior.ts`)

- **counters** — white the outside cannot reach: a flood fill from the ink
  box's border over pixels with alpha ≤ 60; every remaining white component
  holding ≥ 8 % of the box is a counter (口 ≈ 47 %, 日 two of ≈ 20 %, 田 four
  of ≈ 10 %). Their arrangement (single, stacked, beside, grid, nested) and
  evenness are recorded.
- **echoForm** — the same form returning inside one character: islands of
  ≥ 12 % of the ink, each normalised to a 16 × 16 grid, grouped where every
  pair has IoU ≥ 0.8 (品's three 口).
- Left–right symmetry is measured but used nowhere.

### What each generator reads from this

v3 uses: glyph `density` (ink weight of each step, which character withdraws,
material fineness), `cols` (which way a character leans), `rows`/`cols` (its
thinnest side, for wear), `seam` (where a character is cut),
`structuralParts` (wear and cut by components; forms repeated inside a
character), `readPart`, containment relations of the title's own characters
(material, the nesting motif), counters (the nesting motif), and the ink
raster (keeping material off written ink; the invariant audit). See
[composition.md](composition.md).
