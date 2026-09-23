# Character vectors from Aozora Bunko (modern orthography only), by co-occurrence:
#   co-occurrence within a sentence, window ±4, weighted 1/distance
#   → PPMI (context smoothing 0.75) → randomized SVD, 300 dims, random_state 0
#   → cosine neighbours of every kanji among kanji.
# Deterministic: fixed corpus file (sha256 in aozora.sha256), fixed parameters, fixed seed.
import gzip, json, sys, time
import numpy as np
from sklearn.utils.extmath import randomized_svd

SRC = 'aozorabunko-dedupe-clean.jsonl.gz'
WINDOW = 4
VOCAB = 6000
MIN_FREQ = 30
DIM = 300
TOP = 24

def is_kanji(cp):
    return 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or cp == 0x3005
def is_kana(cp):
    return 0x3041 <= cp <= 0x3096 or 0x30A1 <= cp <= 0x30FA or cp == 0x30FC

def texts():
    with gzip.open(SRC, 'rt', encoding='utf-8') as f:
        for line in f:
            r = json.loads(line)
            if r['meta'].get('文字遣い種別') != '新字新仮名':
                continue
            yield r['text']

t0 = time.time()
# pass 1: frequencies
freq = np.zeros(0x30000, dtype=np.int64)
n_works = 0
for t in texts():
    cps = np.frombuffer(t.encode('utf-32-le'), dtype=np.uint32)
    cps = cps[cps < 0x30000]
    freq += np.bincount(cps, minlength=0x30000)
    n_works += 1
letters = [cp for cp in range(0x30000) if (is_kanji(cp) or is_kana(cp)) and freq[cp] >= MIN_FREQ]
letters.sort(key=lambda cp: (-freq[cp], cp))
letters = letters[:VOCAB]
V = len(letters)
lut = np.full(0x30000, -1, dtype=np.int64)  # -1: boundary (punctuation, space, latin…)
for cp in range(0x30000):
    if is_kanji(cp) or is_kana(cp):
        lut[cp] = -2  # a letter outside the vocabulary: keeps its place, is not counted
for i, cp in enumerate(letters):
    lut[cp] = i
print('works', n_works, 'vocab', V, 'pass1', round(time.time() - t0), 's', file=sys.stderr)

# pass 2: co-occurrence
C = np.zeros(V * V, dtype=np.float64)
buf_idx, buf_w, pending = [], [], 0
def flush():
    global C, buf_idx, buf_w, pending
    if not buf_idx:
        return
    idx = np.concatenate(buf_idx); w = np.concatenate(buf_w)
    C += np.bincount(idx, weights=w, minlength=V * V)
    buf_idx, buf_w, pending = [], [], 0
for t in texts():
    cps = np.frombuffer(t.encode('utf-32-le'), dtype=np.uint32)
    cps = np.where(cps < 0x30000, cps, 0)
    ids = lut[cps]
    seg = np.cumsum(ids == -1)
    for d in range(1, WINDOW + 1):
        a = ids[:-d]; b = ids[d:]
        m = (a >= 0) & (b >= 0) & (seg[:-d] == seg[d:])
        if m.any():
            aa = a[m]; bb = b[m]
            buf_idx.append(aa * V + bb); buf_w.append(np.full(aa.shape, 1.0 / d))
            buf_idx.append(bb * V + aa); buf_w.append(np.full(aa.shape, 1.0 / d))
            pending += 2 * aa.size
    if pending > 60_000_000:
        flush()
flush()
C = C.reshape(V, V)
print('pass2', round(time.time() - t0), 's', 'pairs', C.sum(), file=sys.stderr)

# PPMI with context-distribution smoothing
total = C.sum()
row = C.sum(1)
col = C.sum(0) ** 0.75
pw = row / total
pc = col / col.sum()
with np.errstate(divide='ignore', invalid='ignore'):
    pmi = np.log((C / total) / np.outer(pw, pc))
ppmi = np.where(np.isfinite(pmi) & (pmi > 0), pmi, 0.0).astype(np.float32)
del C, pmi
U, S, _ = randomized_svd(ppmi, n_components=DIM, n_iter=5, random_state=0)
E = U * np.sqrt(S)
E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-12
print('svd', round(time.time() - t0), 's', file=sys.stderr)

kanji = np.array([is_kanji(cp) for cp in letters])
sims = E @ E.T
out = {}
for i, cp in enumerate(letters):
    if not kanji[i]:
        continue
    s = sims[i].copy()
    s[i] = -9
    s[~kanji] = -9
    order = np.argsort(-s, kind='stable')[:TOP]
    out[chr(cp)] = [[chr(letters[j]), round(float(s[j]), 3)] for j in order]
json.dump({'vocab': V, 'works': n_works, 'freq': {chr(cp): int(freq[cp]) for cp in letters if is_kanji(cp)}, 'neighbours': out},
          open('aozora-neighbours.json', 'w', encoding='utf-8'), ensure_ascii=False)
np.save('aozora-E.npy', E.astype(np.float32))
json.dump([chr(cp) for cp in letters], open('aozora-letters.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('done', round(time.time() - t0), 's', file=sys.stderr)
