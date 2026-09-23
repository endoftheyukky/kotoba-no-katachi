# The runtime table: the words a title is likely to be made of, and every
# single kanji (the fallback when a title's word is not in the vocabulary).
#
# Format (UTF-8 text, one line per word, frequency order):
#   <word>\t<nine characters, one per axis>
# Each axis value -127..127 is written as one character from a 64-letter
# alphabet (6 bits: round((v+127)/254*63)), so a word costs its own length
# plus ten bytes, and the whole file compresses well.
#
# usage: python tools/semantic/export.py <axes-dir> <out-file> [top]
import sys, json, numpy as np
d, out = sys.argv[1], sys.argv[2]
top = int(sys.argv[3]) if len(sys.argv) > 3 else 60000
T = np.load(d + '/axes-table.npy')
W = json.load(open(d + '/axes-words.json', encoding='utf-8'))
ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'
def single_kanji(w):
    return len(w) == 1 and (0x4E00 <= ord(w) <= 0x9FFF or 0x3400 <= ord(w) <= 0x4DBF)
lines = []
for i, w in enumerate(W['words']):
    if i >= top and not single_kanji(w):
        continue
    code = ''.join(ALPHA[int(round((int(v) + 127) / 254 * 63))] for v in T[i])
    lines.append(w + '\t' + code)
header = '#axes\t' + ','.join(W['axes'])
open(out, 'w', encoding='utf-8', newline='\n').write(header + '\n' + '\n'.join(lines) + '\n')
print(len(lines), 'words', file=sys.stderr)
