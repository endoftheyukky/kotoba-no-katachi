# Compact neighbour tables for the work: for every kanji head, its 24 nearest
# kanji among the 3000 most frequent kanji of the Aozora modern corpus, as
# "<char><cos*100 two digits>" runs. Both sources are filtered by the same
# frequency list, so a candidate is never an obscure character.
import json, numpy as np

COMMON = 3000
TOP = 24
az = json.load(open('aozora-neighbours.json', encoding='utf-8'))
freq = az['freq']
common = [c for c, _ in sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))][:COMMON]
rank = {c: i for i, c in enumerate(common)}

def table(letters_file, E_file, name, meta):
    letters = json.load(open(letters_file, encoding='utf-8'))
    E = np.load(E_file)
    kanji = [i for i, c in enumerate(letters) if 0x3400 <= ord(c) <= 0x9FFF or c == '々']
    idx = np.array(kanji)
    K = E[idx]
    chars = [letters[i] for i in kanji]
    cand = np.array([c in rank for c in chars])
    sims = K @ K.T
    rows = {}
    for i, h in enumerate(chars):
        s = sims[i].copy()
        s[i] = -9
        s[~cand] = -9
        order = np.argsort(-s, kind='stable')[:TOP]
        rows[h] = ''.join(f'{chars[j]}{min(99, max(0, int(round(s[j] * 100)))):02d}' for j in order if s[j] > -1)
    json.dump({'meta': meta, 'n': rows}, open(name, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(name, len(rows))

table('aozora-letters.json', 'aozora-E.npy', 'aozora-v0.json', {
    'id': 'aozora-char-ppmi v0',
    'source': 'globis-university/aozorabunko-clean @42a9c9c (aozorabunko-dedupe-clean.jsonl.gz, sha256 3f41359c…d278), modern orthography only (新字新仮名), 10246 works',
    'license': 'derived statistics of a CC BY 4.0 dataset of public-domain texts (Aozora Bunko)',
    'method': 'character co-occurrence within a sentence, window ±4 weighted 1/d; PPMI (context smoothing 0.75); randomized SVD 300 dims, random_state 0; cosine; candidates among the 3000 most frequent kanji',
})
table('chive-letters.json', 'chive-E.npy', 'chive-v0.json', {
    'id': 'chive-1.3-mc90 single-kanji v0',
    'source': 'chiVe v1.3 mc90 (Works Applications, chive-1.3-mc90.tar.gz, sha256 885c7db3…22b0): the vectors of single-kanji words',
    'license': 'derived from chiVe, Apache License 2.0, Copyright (c) 2024 Works Applications Co., Ltd.',
    'method': 'cosine between word2vec vectors of single-kanji words; candidates among the 3000 most frequent kanji of the Aozora modern corpus',
})
json.dump({'common': ''.join(common)}, open('common-v0.json', 'w', encoding='utf-8'), ensure_ascii=False)
