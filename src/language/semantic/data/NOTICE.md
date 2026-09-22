# Distributional neighbour tables (review only)

Two small tables of the nearest kanji to each kanji, distilled once from
fixed resources and bundled; nothing is fetched when a page is composed.
Rebuild with `tools/semantic/` (Python: numpy, scikit-learn), from the same
files, with the same result.

## aozora-v0.json — aozora-char-ppmi v0

- Source: `globis-university/aozorabunko-clean` at revision `42a9c9c0f1d67e6a5554d9bea4201973dc9b049c`,
  file `aozorabunko-dedupe-clean.jsonl.gz` (sha256 `3f41359c59b4bb1bf2d5692131463afc3f34a8208b987a563c1d60f9ab90d278`),
  modern orthography only (新字新仮名), 10,246 works.
- The texts are Aozora Bunko's public-domain works; the dataset is published
  under CC BY 4.0. This table is derived statistics of it.
- Method: character co-occurrence within a sentence, window ±4 weighted 1/d;
  PPMI with context smoothing 0.75; randomized SVD to 300 dimensions
  (random_state 0); cosine. Candidates are restricted to the 3,000 most
  frequent kanji of the same corpus.

## chive-v0.json — chive-1.3-mc90 single-kanji v0

- Source: chiVe v1.3 mc90, `chive-1.3-mc90.tar.gz`
  (sha256 `885c7db3b8cd8ad1311ac32eafc874007f45010791b3c1f1e934a2aa0c7d22b0`),
  Works Applications Co., Ltd.
- License: Apache License 2.0. Copyright (c) 2024 Works Applications Co., Ltd.
  This table is derived from the vectors of its single-kanji words.
- Method: cosine between the word2vec vectors (300 dimensions) of
  single-kanji words; candidates restricted to the 3,000 most frequent kanji
  of the Aozora corpus above.

Format: `n[head]` is a run of `<kanji><cos×100, two digits>`, nearest first,
at most 24.
