# Semantic axes, distilled once from chiVe v1.3 mc90 into a small table.
#
# Nothing here runs when a page is made. The page reads a table of a few
# numbers per word; this script is how that table was made, from a fixed file
# (sha256 885c7db3...22b0), with the same result every time.
#
# An axis is two small sets of anchor words (a pole and its opposite). A word's
# place on the axis is how much nearer its vector is to one pole's centroid than
# to the other's, and that difference is replaced by its rank among all kept
# words, so every axis runs evenly from -1 to +1 over the vocabulary.
#
# The anchors avoid every word of the study sets (src/study/difficult.ts), so
# that what the table says about 孤独 or 群衆 is not what it was told.
#
# usage: python tools/semantic/axes.py <chive-1.3-mc90.tar.gz> <out-dir>
import sys, tarfile, json, time, math
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
KEEP_RANK = 160000          # the most frequent words kept (plus every single kanji)
MAX_LEN = 8

# Both poles of an axis are nouns (or noun-like words): with verbs on one side and
# nouns on the other, an axis measures part of speech and abstractness, not
# meaning — the first version did, and every abstract noun stood at the same end
# of every axis.
AXES = {
    # name: (the pole at -1, the pole at +1)
    'multitude': (['孤立', '単独', '独り', '一人', '個人', '唯一', '一個'],
                  ['集団', '大勢', '群れ', '人々', '大衆', '多数', '大群']),
    'agitation': (['静けさ', '平穏', '静止', '無音', '安らぎ', '凪', '平静'],
                  ['喧騒', '騒ぎ', '騒音', '動揺', '狂乱', '混乱', '嵐']),
    'enclosure': (['広がり', '広野', '開放', '大空', '海原', '野原', '地平線'],
                  ['閉鎖', '密室', '檻', '壁', '箱', '牢獄', '囲い']),
    'severance': (['結合', '絆', '繋がり', '融合', '結束', '結び目', '連結'],
                  ['亀裂', '分裂', '決別', '隔たり', '断裂', '裂け目', '分離']),
    'vanishing': (['存在', '実在', '永続', '残存', '実体', '確信', '定着'],
                  ['消滅', '消失', '忘却', '幻影', '虚無', '霧散', '空虚']),
    'distance':  (['身近', '近所', '隣', '手元', '間近', '足元', '傍ら'],
                  ['彼方', '遠方', '果て', '地平', '遥か', '異国', '辺境']),
    'weight':    (['羽毛', '浮遊', '軽さ', '飛翔', '綿毛', '泡', '風船'],
                  ['重さ', '重圧', '鉛', '沈下', '重量', '岩盤', '鉄塊']),
    'descent':   (['上昇', '日の出', '光明', '晴天', '高揚', '頂上', '天空'],
                  ['下降', '墜落', '暗闇', '日没', '沈没', '奈落', '底']),
    'abstraction': (['石', '机', '皿', '靴', '箸', '鍋', '椅子'],
                    ['概念', '観念', '意義', '理念', '原理', '抽象', '論理']),
}

def japanese(word):
    for c in word:
        cp = ord(c)
        if not (0x3040 <= cp <= 0x30FF or 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or c in '々ー'):
            return False
    return True

def single_kanji(word):
    return len(word) == 1 and (0x4E00 <= ord(word) <= 0x9FFF or 0x3400 <= ord(word) <= 0x4DBF)

t0 = time.time()
words, vecs = [], []
with tarfile.open(SRC, 'r:gz') as tar:
    member = next(m for m in tar.getmembers() if m.name.endswith('.txt'))
    f = tar.extractfile(member)
    f.readline()
    for rank, raw in enumerate(f):
        sp = raw.find(b' ')
        word = raw[:sp].decode('utf-8', errors='replace')
        if len(word) > MAX_LEN or not japanese(word):
            continue
        if rank >= KEEP_RANK and not single_kanji(word):
            continue
        words.append(word)
        vecs.append(np.array(raw[sp + 1:].split(), dtype=np.float32))
E = np.vstack(vecs)
E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-12
# All-but-the-top (Mu & Viswanath 2018): the shared mean and the two strongest
# directions of the space carry frequency and part of speech more than meaning.
# They are removed before any axis is read. Deterministic: an exact SVD of the
# covariance of the 20,000 most frequent kept words.
mu = E.mean(axis=0)
E = E - mu
_, _, Vt = np.linalg.svd(E[:20000], full_matrices=False)
top = Vt[:2]
E = E - (E @ top.T) @ top
E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-12
index = {w: i for i, w in enumerate(words)}
print('kept', len(words), 'words in', round(time.time() - t0), 's', file=sys.stderr)

# the population an axis is measured against: ordinary compounds, two or three
# kanji, among the 60,000 most frequent words — what a title usually is
def kanji_only(w):
    return all(0x4E00 <= ord(c) <= 0x9FFF or c == '々' for c in w)
ref = np.array([i for i, w in enumerate(words) if 2 <= len(w) <= 3 and kanji_only(w) and i < 60000])
print('reference compounds', len(ref), file=sys.stderr)

missing = {}
table = np.zeros((len(words), len(AXES)), dtype=np.int8)

def direction(neg, pos):
    n = np.mean([E[index[w]] for w in neg if w in index], axis=0)
    p = np.mean([E[index[w]] for w in pos if w in index], axis=0)
    d = p - n
    return d / np.linalg.norm(d)

# Abstractness leaks into every other axis: an abstract noun is nearer to
# 消滅 than to 存在, nearer to 彼方 than to 手元, just for being abstract. Every
# other axis is made orthogonal to the abstraction axis, so that 孤独 is not
# read as vanishing and far merely because it is an idea.
ABSTRACT = direction(*AXES['abstraction'])
for j, (name, (neg, pos)) in enumerate(AXES.items()):
    miss = [w for w in neg + pos if w not in index]
    if miss:
        missing[name] = miss
    d = direction(neg, pos)
    if name != 'abstraction':
        d = d - (d @ ABSTRACT) * ABSTRACT
        d /= np.linalg.norm(d)
    raw = E @ d
    # z against ordinary compounds, then squashed: a word is placed by how
    # unusual it is among words of its own kind, not among particles and verbs
    z = (raw - raw[ref].mean()) / (raw[ref].std() + 1e-12)
    table[:, j] = np.round(np.tanh(z / 1.6) * 127).astype(np.int8)

np.save(OUT + '/axes-table.npy', table)
json.dump({'axes': list(AXES), 'anchors': AXES, 'missing': missing, 'words': words},
          open(OUT + '/axes-words.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('missing anchors:', json.dumps(missing, ensure_ascii=False), file=sys.stderr)
print('done', round(time.time() - t0), 's', file=sys.stderr)
