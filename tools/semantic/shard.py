# The semantic table as the published site reads it: split into small files by
# the first character of each word, so that a title fetches only the files its
# own characters need (a few kilobytes), never the whole table.
#
#   <out>/<NN>.tsv     words whose first character's code point mod 64 is NN
#                      one per line: <word>\t<nine letters, one per axis>
#   <out>/meta.json    the table's id, axes, source, method, and the sha256 of
#                      every shard — the published generator is pinned to these
#
# A table, once published, is never changed: a different table is a new id and
# a new directory, and a new public generator version with it.
#
# usage: python tools/semantic/shard.py <axes-dir> <out-dir> <id> [top]
import sys, json, hashlib, os
import numpy as np

d, out, table_id = sys.argv[1], sys.argv[2], sys.argv[3]
top = int(sys.argv[4]) if len(sys.argv) > 4 else 60000
SHARDS = 64
ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

T = np.load(os.path.join(d, 'axes-table.npy'))
W = json.load(open(os.path.join(d, 'axes-words.json'), encoding='utf-8'))

def single_kanji(w):
    return len(w) == 1 and (0x4E00 <= ord(w) <= 0x9FFF or 0x3400 <= ord(w) <= 0x4DBF)

shards = [[] for _ in range(SHARDS)]
kept = 0
for i, w in enumerate(W['words']):
    if i >= top and not single_kanji(w):
        continue
    code = ''.join(ALPHA[int(round((int(v) + 127) / 254 * 63))] for v in T[i])
    shards[ord(w[0]) % SHARDS].append(w + '\t' + code)
    kept += 1

os.makedirs(out, exist_ok=True)
hashes = {}
for n, lines in enumerate(shards):
    body = ('\n'.join(lines) + '\n').encode('utf-8')
    name = '%02d.tsv' % n
    open(os.path.join(out, name), 'wb').write(body)
    hashes[name] = hashlib.sha256(body).hexdigest()

meta = {
    'id': table_id,
    'axes': W['axes'],
    'shards': SHARDS,
    'words': kept,
    'shard_of': 'code point of the first character, mod 64',
    'encoding': 'one letter per axis from ' + ALPHA + ': value = index / 63 * 2 - 1',
    'source': 'chiVe v1.3 mc90 (Works Applications, Apache License 2.0), chive-1.3-mc90.tar.gz sha256 885c7db3b8cd8ad1311ac32eafc874007f45010791b3c1f1e934a2aa0c7d22b0',
    'method': 'tools/semantic/axes.py: noun anchors per pole (no study word), all-but-the-top (mean and 2 components removed), axes orthogonal to abstraction, z against 2-3 kanji compounds among the 60,000 most frequent words, tanh(z/1.6); tools/semantic/shard.py: the ' + str(top) + ' most frequent words and every single kanji',
    'sha256': hashes,
}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sizes = [len(s) for s in shards]
print(kept, 'words in', SHARDS, 'shards; words per shard min', min(sizes), 'max', max(sizes), file=sys.stderr)
