# v3 — notes for after the first public release

Nothing here is implemented. The first public release is v2c (`v2c-rc1`,
branch `release/v2c`); these notes must not delay it.

## What the v2d experiment settled

`v2d-semantic-experiment` (`fa48586`): related characters taken from a space
of meaning — seed-lexicon v0, Aozora Bunko character co-occurrence
(PPMI + SVD), chiVe single-kanji word vectors — and added to a finished page
as grain, satellite, orbit mark or counterpoint read as a misprint, a gloss
or an explanation (雨 → 降 reads 降雨), and one or two of them never became
structure. The conclusion is not to stop using meaning, but not to use it by
adding related words as small characters to an existing page.

## semantic space → composition

Map the words or the phrase into a vector space (word embedding, sentence
embedding, distributional space) and let its properties act on the
composition as invisible forces — never shown as characters:

| in the semantic space | on the paper |
| --- | --- |
| semantic distance | distance on the paper |
| semantic density | density of marks |
| dispersion | spatial spread |
| cluster structure | group structure |
| ambiguity, several neighbourhoods | branching |
| direction of a relation | spatial direction |
| internal distance between the words | spacing |

Meaning is not explained in characters: it sets positions, distances,
densities, groups and directions.

## From looking at Niikuni's work again

- several words of different kinds living as main elements on one page
- the distance between words as the poem itself
- the relation as visual material
- the transformation of a relation unfolded across the whole page
- instead of one grammar per page: one main operation and a few dependent
  ones
- semantic space → paper space
- Feature → Poetic Program → Execution → Trace
