# Single-character words of chiVe v1.3 mc90 (word2vec, 300 dims, Apache-2.0):
# their vectors as they are, and the cosine neighbours of every kanji among kanji.
import tarfile, json, sys, time
import numpy as np

SRC = 'chive-1.3-mc90.tar.gz'
TOP = 24

def is_kanji(c):
    cp = ord(c)
    return 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or cp == 0x3005

t0 = time.time()
chars, vecs = [], []
with tarfile.open(SRC, 'r:gz') as tar:
    member = next(m for m in tar.getmembers() if m.name.endswith('.txt'))
    f = tar.extractfile(member)
    head = f.readline()
    for raw in f:
        sp = raw.find(b' ')
        word = raw[:sp].decode('utf-8', errors='replace')
        if len(word) != 1 or not is_kanji(word):
            continue
        chars.append(word)
        vecs.append(np.array(raw[sp + 1:].split(), dtype=np.float32))
print('header', head.strip(), 'single kanji', len(chars), round(time.time() - t0), 's', file=sys.stderr)
E = np.vstack(vecs)
E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-12
sims = E @ E.T
out = {}
for i, c in enumerate(chars):
    s = sims[i].copy()
    s[i] = -9
    order = np.argsort(-s, kind='stable')[:TOP]
    out[c] = [[chars[j], round(float(s[j]), 3)] for j in order]
json.dump({'vocab': len(chars), 'neighbours': out}, open('chive-neighbours.json', 'w', encoding='utf-8'), ensure_ascii=False)
np.save('chive-E.npy', E.astype(np.float32))
json.dump(chars, open('chive-letters.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('done', round(time.time() - t0), 's', file=sys.stderr)
