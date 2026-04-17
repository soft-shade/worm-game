"""
Build a word_graph.txt-format dictionary from one or more source word lists.

Usage:
    python3 build_word_graph.py <output.txt> <source1.txt> [source2.txt ...] [--zipf N] [--extra file.txt]

- Union of all <sourceN.txt> files (one lowercase alpha word per line).
- If --zipf N is set, filters the union by wordfreq Zipf frequency >= N.
- If --extra file.txt is given, those words are added AFTER the zipf filter
  (so they bypass the threshold — useful for a curated slang supplement).

Output format (matches assets/word_graph.txt pre-shortened version):
    Words sorted by length, then alphabetically.
    Each line: word,idx1,idx2,... where indices are neighbors (words
    differing by one letter via substitution, insertion, or deletion).
    Neighbors are sorted ascending. No trailing newline on the file.
"""
import sys
import unicodedata
from collections import defaultdict


# Words that should never end up in the graph even if they pass the
# zipf filter or appear in a source file. Typically obscure abbreviations
# or loan-words that look like typos in a casual word game context.
BLOCKLIST = {
    "sinh",   # hyperbolic-sine abbreviation; reads like a typo.
}


def strip_accents(s):
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def read_wordlist(path):
    with open(path) as f:
        out = set()
        for line in f:
            w = strip_accents(line.strip().lower())
            if w and w.isalpha() and w.isascii() and w not in BLOCKLIST:
                out.add(w)
        return out


def filter_by_zipf(words, threshold):
    from wordfreq import zipf_frequency

    return {w for w in words if zipf_frequency(w, "en") >= threshold}


def build_graph(words):
    """Return (sorted_words, neighbors_list_of_sorted_lists).
    sorted_words ordered by (len, alpha)."""
    words = sorted(set(words), key=lambda w: (len(w), w))
    idx_of = {w: i for i, w in enumerate(words)}
    word_set = set(words)
    neighbors = [set() for _ in words]

    # Same-length: bucket by positional wildcard pattern.
    buckets = defaultdict(list)
    for w in words:
        for i in range(len(w)):
            buckets[(i, w[:i] + "*" + w[i + 1 :])].append(w)
    for grp in buckets.values():
        if len(grp) < 2:
            continue
        idxs = [idx_of[w] for w in grp]
        for a in idxs:
            for b in idxs:
                if a != b:
                    neighbors[a].add(b)

    # Length-differs-by-one: for each word w, each deletion variant that is
    # also a word is a neighbor.
    for w in words:
        wi = idx_of[w]
        for i in range(len(w)):
            shorter = w[:i] + w[i + 1 :]
            if shorter and shorter != w and shorter in word_set:
                si = idx_of[shorter]
                neighbors[wi].add(si)
                neighbors[si].add(wi)

    return words, [sorted(nb) for nb in neighbors]


def write_graph(path, words, neighbors):
    lines = []
    for w, nb in zip(words, neighbors):
        if nb:
            lines.append(w + "," + ",".join(str(i) for i in nb))
        else:
            lines.append(w + ",")
    with open(path, "w") as f:
        f.write("\n".join(lines))


def parse_args(argv):
    args = list(argv)
    zipf = None
    extras = []
    i = 0
    positional = []
    while i < len(args):
        a = args[i]
        if a == "--zipf":
            zipf = float(args[i + 1])
            i += 2
        elif a == "--extra":
            extras.append(args[i + 1])
            i += 2
        else:
            positional.append(a)
            i += 1
    if len(positional) < 2:
        print(__doc__)
        sys.exit(1)
    output_path = positional[0]
    source_paths = positional[1:]
    return output_path, source_paths, zipf, extras


def main():
    output_path, source_paths, zipf, extras = parse_args(sys.argv[1:])

    union = set()
    for p in source_paths:
        s = read_wordlist(p)
        print(f"  {p}: {len(s)} words")
        union |= s
    print(f"Union: {len(union)} words")

    if zipf is not None:
        union = filter_by_zipf(union, zipf)
        print(f"After zipf>={zipf} filter: {len(union)} words")

    for ep in extras:
        e = read_wordlist(ep)
        added = e - union
        print(f"  extra {ep}: {len(e)} words, {len(added)} new")
        union |= e

    sorted_words, neighbors = build_graph(union)
    total_edges = sum(len(nb) for nb in neighbors) // 2
    print(f"Built graph: {len(sorted_words)} words, {total_edges} edges")

    write_graph(output_path, sorted_words, neighbors)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
