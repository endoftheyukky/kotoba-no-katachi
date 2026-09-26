# resonance-1: the fixed table of semantic evidence for generator v2 (spec-1 §5, §11.3, §16 Stage 5).
#
#   python tools/v2/resonance.py --wordnet <wnjpn.db.gz> --chive <chive-1.3-mc90.tar.gz>           write public/v2/resonance-1
#   python tools/v2/resonance.py --wordnet <wnjpn.db.gz> --chive <chive-1.3-mc90.tar.gz> --check   regenerate and compare, byte for byte
#
# Nothing here runs when a page is made: the page reads the shards written here. Only fixed
# resources are read, each pinned by sha256 — another file is another table:
#   Japanese WordNet 1.1 (NICT; its licence asks that the copyright notice be kept: NOTICE.txt)
#   chiVe v1.3 mc90 (Works Applications, Apache-2.0), the vectors axes-1 was made from, cleaned the same way
# No model, no network, no LLM. Character-origin data (TODO-11) is not chosen yet, so no origin,
# component-whole or lexical-candidate row is written (the manifest says so).
#
# What a row holds (per character of scope-1):
#   partReferent    L0 A: WordNet has-part / has-member, one link from the character's own word (雨 has-part 雨滴)
#   radicalMeaning  L0: a variant component's character (氵 → 水) reached from the character's word by a typed
#                   path of one or two links (is-a, made-of, has-part): 海 is-a 水体 made-of 水
#   schemaDirect    L0 E: a typed path of one or two links from the character's word to a schema's concept word
#                   (辻 part-of 道: PATH)
#   schema          L1 E: the character's percentile, among every single kanji of chiVe, by nearness to the
#                   centroid of each ACTIVE schema's anchors (only CONTAINER and MULTITUDE are paired in v2.0)
import sys, os, io, re, json, gzip, hashlib, tarfile, sqlite3, tempfile, argparse
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
TOOL_VERSION = '1'
SHARDS = 16
PINNED = {
    'wordnet': '64a14dcfe3ba296566e91a70a2fc0616e85cf2ee7b7fd8cdcbc66c8b12a505a5',
    'chive': '885c7db3b8cd8ad1311ac32eafc874007f45010791b3c1f1e934a2aa0c7d22b0',
}

# the image schemas (pre-v2, fixed before this stage): anchors that avoid every benchmark character.
# centroid: every anchor, as pre-v2 read them in chiVe; concept: the nouns among them and the schema's
# own head noun, the words a typed WordNet path may reach (L0).
SCHEMAS = {
    'UNIT':      {'anchors': ['粒', '一粒', '滴', '断片', '粒子', '小片'], 'head': ['単位']},
    'MULTITUDE': {'anchors': ['群れ', '集まり', '多数', '無数', '群生', '密集'], 'head': []},
    'CONTAINER': {'anchors': ['箱', '容器', '檻', '内部', '閉じ込める', '包む'], 'head': ['入れ物']},
    'CENTER':    {'anchors': ['中央', '真ん中', '中核', '核', '焦点', '中枢'], 'head': ['中心']},
    'PATH':      {'anchors': ['通路', '経路', '交差', '分岐', '街路', '往来'], 'head': ['道']},
    'SURFACE':   {'anchors': ['地面', '表面', '平面', '床', '地表', '敷く'], 'head': []},
    'DOWN':      {'anchors': ['落下', '降下', '下方', '滴る', '落ちる', '沈む'], 'head': ['下']},
    'BOUNDARY':  {'anchors': ['境界', '入口', '仕切り', '扉', '敷居', '出入り'], 'head': []},
    'LIQUID':    {'anchors': ['液体', '水分', '濡れる', '流れる', '湿る', '浸す'], 'head': []},
    'VOICE':     {'anchors': ['響き', '声', '鳴る', '聴く', '響く', '叫び'], 'head': []},
    'SORROW':    {'anchors': ['涙', '寂しさ', '嘆き', '孤独', '哀しみ', '泣く'], 'head': ['悲しみ']},
}
# a verb or an adjective is not a concept a noun's typed path reaches
NOT_NOUNS = {'閉じ込める', '包む', '敷く', '滴る', '落ちる', '沈む', '濡れる', '流れる', '湿る', '浸す', '鳴る', '聴く', '響く', '泣く'}
ACTIVE = ['CONTAINER', 'MULTITUDE']          # spec-1 §5.2: the L1 pairs of v2.0 (enclosure × CONTAINER, internal_repetition × MULTITUDE)
L1_MIN = 90                                  # appendix A: L1_MIN_PERCENTILE
LINKS = {'hype': 'is-a', 'hprt': 'part-of', 'mprt': 'has-part', 'mmem': 'has-member', 'hmem': 'member-of', 'msub': 'made-of', 'hsub': 'substance-of'}
RADICAL_LINKS = {'hype', 'msub', 'mprt'}     # the relations RadicalMeaning names: is-a, made-of, has-part


def sha(b):
    return hashlib.sha256(b).hexdigest()


def number(v):
    """a float as JavaScript writes it (90.0 → 90)"""
    v = round(float(v), 1)
    return int(v) if v.is_integer() else v


def canonical(v):
    """the TypeScript canonical(): keys sorted, no whitespace, strings as JSON.stringify writes them"""
    if isinstance(v, dict):
        return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + canonical(v[k]) for k in sorted(v, key=utf16_key) if v[k] is not None) + '}'
    if isinstance(v, (list, tuple)):
        return '[' + ','.join(canonical(x) for x in v) + ']'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, float):
        return json.dumps(number(v))
    return json.dumps(v, ensure_ascii=False)


def utf16_key(s):
    """JavaScript's default sort: by UTF-16 code unit"""
    b = s.encode('utf-16-be')
    return [int.from_bytes(b[i:i + 2], 'big') for i in range(0, len(b), 2)]


def by_code_point(s):
    return [ord(c) for c in s]


# ------------------------------------------------------------------ sources

def read_scope():
    p = os.path.join(ROOT, 'src/v2/structure/scope-1.json')
    b = open(p, 'rb').read()
    d = json.loads(b.decode('utf-8'))
    return [c for c, _ in d['chars']], d['meta'], sha(b)


def read_structure():
    d = os.path.join(ROOT, 'public/v2/structure-1')
    man = json.loads(open(os.path.join(d, 'manifest.json'), encoding='utf-8').read())
    entries = {}
    for f in man['shards']['files']:
        entries.update(json.loads(open(os.path.join(d, f['name']), encoding='utf-8').read())['entries'])
    return man, entries


def variant_leaves(tree):
    out = []
    def walk(n):
        if n['kind'] == 'op':
            for c in n['children']:
                walk(c)
        elif n['tier'] == 'variant':
            out.append(n['char'])
    walk(tree)
    return out


def leaves(tree):
    out = []
    def walk(n):
        if n['kind'] == 'op':
            for c in n['children']:
                walk(c)
        else:
            out.append(n['char'])
    walk(tree)
    return out


class WordNet:
    def __init__(self, path):
        raw = open(path, 'rb').read()
        self.sha = sha(raw)
        if self.sha != PINNED['wordnet']:
            raise SystemExit(f'wnjpn.db.gz sha256 {self.sha} is not the pinned {PINNED["wordnet"]}')
        self.tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        self.tmp.write(gzip.decompress(raw))
        self.tmp.close()
        self.db = sqlite3.connect(self.tmp.name)
        self.names = dict(self.db.execute('select synset, name from synset'))
        self.lemmas = {}
        for s, l in self.db.execute("select s.synset, w.lemma from sense s join word w on s.wordid = w.wordid where w.lang = 'jpn' order by s.synset, w.lemma"):
            self.lemmas.setdefault(s, []).append(l)
        self.of = {}
        for l, s in self.db.execute("select w.lemma, s.synset from word w join sense s on s.wordid = w.wordid where w.lang = 'jpn' order by w.lemma, s.synset"):
            self.of.setdefault(l, []).append(s)
        self.links = {}
        for a, b, k in self.db.execute('select synset1, synset2, link from synlink where link in (%s) order by synset1, link, synset2' % ','.join("'%s'" % k for k in LINKS)):
            self.links.setdefault(a, []).append((k, b))
        meta = dict(self.db.execute('select * from meta')) if self.db.execute("select name from sqlite_master where name='meta'").fetchone() else {}
        self.version = {k: str(v) for k, v in meta.items()}

    def close(self):
        self.db.close()
        os.unlink(self.tmp.name)

    def synsets(self, lemma):
        return self.of.get(lemma, [])

    def paths(self, lemma, targets, allowed, hops=2):
        """typed paths of 1..hops links from any synset of lemma to any synset whose lemmas meet targets"""
        out = []
        frontier = [(s, []) for s in self.synsets(lemma)]
        seen = set(s for s, _ in frontier)
        for _ in range(hops):
            nxt = []
            for s, path in frontier:
                for k, t in self.links.get(s, []):
                    if k not in allowed:
                        continue
                    p = path + [(s, LINKS[k], t)]
                    hit = [l for l in self.lemmas.get(t, []) if l in targets]
                    if hit:
                        out.append((p, hit))
                    if t not in seen:
                        seen.add(t)
                        nxt.append((t, p))
            frontier = nxt
        return out


def chive_vectors(path):
    """the vocabulary and cleaning of tools/semantic/axes.py (axes-1): top 160,000 words of ≤ 8 characters and
    every single kanji; normalised; the mean and the two strongest directions removed"""
    raw = open(path, 'rb').read()
    h = sha(raw)
    if h != PINNED['chive']:
        raise SystemExit(f'chiVe sha256 {h} is not the pinned {PINNED["chive"]}')

    def japanese(w):
        return all(0x3040 <= ord(c) <= 0x30FF or 0x4E00 <= ord(c) <= 0x9FFF or 0x3400 <= ord(c) <= 0x4DBF or c in '々ー' for c in w)

    def single(w):
        return len(w) == 1 and (0x4E00 <= ord(w) <= 0x9FFF or 0x3400 <= ord(w) <= 0x4DBF)

    words, vecs = [], []
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
        m = next(x for x in tar.getmembers() if x.name.endswith('.txt'))
        f = tar.extractfile(m)
        f.readline()
        for rank, line in enumerate(f):
            sp = line.find(b' ')
            w = line[:sp].decode('utf-8', errors='replace')
            if len(w) > 8 or not japanese(w):
                continue
            if rank >= 160000 and not single(w):
                continue
            words.append(w)
            vecs.append(np.array(line[sp + 1:].split(), dtype=np.float32))
    E = np.vstack(vecs)
    E /= np.linalg.norm(E, axis=1, keepdims=True) + 1e-12
    C = E - E.mean(axis=0)
    _, _, Vt = np.linalg.svd(C[:20000], full_matrices=False)
    top = Vt[:2]
    C = C - (C @ top.T) @ top
    C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-12
    return words, C, h


# ------------------------------------------------------------------ the table

def generate(wordnet_path, chive_path):
    scope, scope_meta, scope_sha = read_scope()
    sman, sentries = read_structure()
    forms = {f['form']: f['chars'] for f in sman['forms'] if f['kind'] == 'variant-of'}
    wn = WordNet(wordnet_path)
    words, E, chive_sha = chive_vectors(chive_path)
    idx = {w: i for i, w in enumerate(words)}
    kanji = [i for i, w in enumerate(words) if len(w) == 1 and 0x4E00 <= ord(w) <= 0x9FFF]
    Ek = E[kanji]
    centroid = {}
    for k in ACTIVE:
        v = np.mean([E[idx[w]] for w in SCHEMAS[k]['anchors'] if w in idx], axis=0)
        centroid[k] = v / np.linalg.norm(v)
    concepts = {k: [w for w in s['anchors'] + s['head'] if w not in NOT_NOUNS] for k, s in SCHEMAS.items()}
    concept_of = {}
    for k, ws in concepts.items():
        for w in ws:
            concept_of.setdefault(w, []).append(k)

    def path_text(p):
        return [[wn.names.get(a, a), rel, wn.names.get(b, b)] for a, rel, b in p]

    entries = {}
    for c in scope:
        e = sentries.get(c)
        tree = e['structure']['tree'] if e and e.get('structure') else None
        parts = set(leaves(tree)) if tree else set()
        row = {'char': c}
        # A: has-part / has-member, one link
        pr = []
        for s in wn.synsets(c):
            for k, t in wn.links.get(s, []):
                if k not in ('mprt', 'mmem'):
                    continue
                ls = wn.lemmas.get(t, [])
                if not ls:
                    continue
                # the unit: a component of the character, else the shortest word holding the character, else the shortest word
                comp = sorted([l for l in ls if l in parts], key=by_code_point)
                holding = sorted([l for l in ls if c in l], key=lambda l: (len(l), by_code_point(l)))
                unit = comp[0] if comp else holding[0] if holding else sorted(ls, key=lambda l: (len(l), by_code_point(l)))[0]
                pr.append({'relation': LINKS[k], 'unit': unit, 'lemmas': sorted(ls, key=by_code_point), 'path': path_text([(s, LINKS[k], t)])})
        # radical-meaning: a variant component's character, by a typed path of one or two links
        rm = []
        for v in sorted(set(variant_leaves(tree)) if tree else [], key=by_code_point):
            for meaning in forms.get(v, []):
                ps = wn.paths(c, {meaning}, RADICAL_LINKS)
                if ps:
                    p, _ = sorted(ps, key=lambda x: (len(x[0]), json.dumps(path_text(x[0]), ensure_ascii=False)))[0]
                    rm.append({'radical': v, 'meaning': meaning, 'relation': p[-1][1], 'path': path_text(p)})
        # E at L0: a typed path to a schema's concept word
        sd = []
        for p, hit in sorted(wn.paths(c, set(concept_of), set(LINKS)), key=lambda x: (len(x[0]), json.dumps(path_text(x[0]), ensure_ascii=False))):
            for w in sorted(hit, key=by_code_point):
                for k in concept_of[w]:
                    if not any(x['schema'] == k and x['concept'] == w for x in sd):
                        sd.append({'schema': k, 'concept': w, 'path': path_text(p)})
        # E at L1: the percentile on each active schema, among every single kanji chiVe keeps
        sc = None
        if c in idx:
            sc = {}
            for k in ACTIVE:
                s = Ek @ centroid[k]
                t = float(E[idx[c]] @ centroid[k])
                sc[k] = number(100 * float((s < t).mean()))
        if pr:
            row['partReferent'] = pr
        if rm:
            row['radicalMeaning'] = rm
        if sd:
            row['schemaDirect'] = sd
        if sc is not None:
            row['schema'] = sc
        entries[c] = row
    wn_version = wn.version
    wn.close()

    shards = []
    for i in range(SHARDS):
        keys = sorted([c for c in entries if ord(c) % SHARDS == i], key=by_code_point)
        text = '{"entries":{\n' + ',\n'.join(json.dumps(k, ensure_ascii=False) + ':' + canonical(entries[k]) for k in keys) + '\n}}\n'
        shards.append((f'{i:02d}.json', text))
    files = [{'name': n, 'entries': len(re.findall(r'^"', t, re.M)), 'bytes': len(t.encode('utf-8')), 'sha256': sha(t.encode('utf-8'))} for n, t in shards]
    counts = {
        'entries': len(entries),
        'partReferent': sum(1 for r in entries.values() if 'partReferent' in r),
        'radicalMeaning': sum(1 for r in entries.values() if 'radicalMeaning' in r),
        'schemaDirect': sum(1 for r in entries.values() if 'schemaDirect' in r),
        'schema': sum(1 for r in entries.values() if 'schema' in r),
        **{f'schema≥{L1_MIN}:{k}': sum(1 for r in entries.values() if r.get('schema', {}).get(k, 0) >= L1_MIN) for k in ACTIVE},
    }
    manifest = {
        'id': 'resonance-1',
        'spec': 'spec-1',
        'generator': {'tool': 'tools/v2/resonance.py', 'version': TOOL_VERSION},
        'sources': [
            {'name': 'Japanese WordNet', 'url': 'https://bond-lab.github.io/wnja/', 'version': {'file': 'wnjpn.db.gz', **wn_version}, 'sha256': PINNED['wordnet'], 'use': 'L0: typed relations of a character\'s own word (has-part, has-member, is-a, made-of, part-of …)', 'license': 'Japanese WordNet licence (NICT): keep the copyright notice'},
            {'name': 'chiVe', 'url': 'https://github.com/WorksApplications/chiVe', 'version': {'version': '1.3', 'model': 'mc90'}, 'sha256': chive_sha, 'use': 'L1: a character\'s percentile on the active schemas', 'license': 'Apache-2.0'},
            {'name': 'scope-1', 'url': 'src/v2/structure/scope-1.json', 'version': {'version': scope_meta['version'], 'charactersSha256': scope_meta['sha256']}, 'sha256': scope_sha, 'use': 'which characters the table holds'},
            {'name': 'structure-1', 'url': 'public/v2/structure-1', 'version': {'id': 'structure-1'}, 'sha256': sman['sha256'], 'use': 'the variant components whose characters a radical meaning names (forms: variant-of)'},
        ],
        'distances': {'L0': 'a resource states the relation: one or two typed WordNet links', 'L1': f'a fixed schema, percentile ≥ {L1_MIN}, paired at run time with the structure type it agrees with'},
        'excluded': 'L2 (association) and L3 (metaphor) are never written; no embedding similarity between a part and its whole; no schema maximum alone; no model at run time',
        'pending': {'todo': 'TODO-11', 'types': ['origin', 'component-whole', 'lexical-candidate'], 'why': 'the character-origin source is not chosen: no row of these types is written'},
        'schemas': {k: {'anchors': s['anchors'], 'concepts': concepts[k]} for k, s in SCHEMAS.items()},
        'active': ACTIVE,
        'l1': {'min': L1_MIN, 'population': 'every single kanji (U+4E00–9FFF) chiVe keeps', 'vectors': 'as axes-1: top 160,000 words ≤ 8 characters and every single kanji; normalised; mean and top two directions removed', 'percentile': '100 × share of the population nearer-than-not to the schema centroid (cosine)'},
        'rules': {
            'partReferent': 'WordNet has-part / has-member from a synset of the character\'s own word, one link; the unit: a component of the character, else the shortest word holding the character, else the shortest word (then code point)',
            'radicalMeaning': 'a variant component (氵) and the character it is a form of (水, structure-1 forms), reached from the character\'s word by one or two links among is-a, made-of, has-part; relation: the last link',
            'schemaDirect': 'one or two typed links from the character\'s word to a concept word of a schema (its nouns, and its head noun)',
            'schema': 'percentiles on the active schemas only (CONTAINER, MULTITUDE); others are not written (TODO-8)',
        },
        'shards': {'count': SHARDS, 'of': 'code point mod 16', 'files': files},
        'counts': counts,
        'sha256': sha(''.join(f['sha256'] for f in files).encode('utf-8')),
    }
    out = dict(shards)
    out['manifest.json'] = canonical(manifest) + '\n'
    out['NOTICE.txt'] = '\n'.join([
        'resonance-1 — typed semantic evidence (L0 / L1) for generator v2 of ことばのかたち.',
        '',
        'Made by tools/v2/resonance.py from:',
        f'  Japanese WordNet (wnjpn.db.gz, sha256 {PINNED["wordnet"]}).',
        '    Japanese WordNet (c) 2009-2011 NICT, 2012-2015 Francis Bond and 2016-2024 Francis Bond, Takayuki Kuribayashi.',
        '    Used under the Japanese WordNet licence; this notice is kept as it requires.',
        f'  chiVe v1.3 mc90 (Works Applications), Apache License 2.0 (sha256 {chive_sha}).',
        '    The table holds percentiles computed from the vectors, not the vectors.',
        '  scope-1 and structure-1 (this repository).',
        '',
    ])
    return out, manifest


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--wordnet', required=True)
    ap.add_argument('--chive', required=True)
    ap.add_argument('--out', default=os.path.join(ROOT, 'public/v2/resonance-1'))
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    files, manifest = generate(a.wordnet, a.chive)
    if a.check:
        differ = [n for n, t in files.items() if not os.path.exists(os.path.join(a.out, n)) or open(os.path.join(a.out, n), 'rb').read() != t.encode('utf-8')]
        print(json.dumps({'check': os.path.relpath(a.out, ROOT).replace(os.sep, '/'), 'files': len(files), 'differ': differ, 'sha256': manifest['sha256']}))
        sys.exit(1 if differ else 0)
    os.makedirs(a.out, exist_ok=True)
    for n, t in files.items():
        with open(os.path.join(a.out, n), 'wb') as f:
            f.write(t.encode('utf-8'))
    print(json.dumps({'wrote': os.path.relpath(a.out, ROOT).replace(os.sep, '/'), 'counts': manifest['counts'], 'sha256': manifest['sha256']}, ensure_ascii=False))
