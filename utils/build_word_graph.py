"""
Build a word_graph.txt-format dictionary from a source word list.

Usage:
    python3 build_word_graph.py <input_words.txt> <output_graph.txt> [--zipf 2.6]

If --zipf is set, filters input words by wordfreq Zipf frequency >= threshold.

Output format (matches assets/word_graph.txt):
    Words sorted by length, then alphabetically.
    Each line: word,idx1,idx2,... where indices are neighbors (words
    differing by one letter: substitution, insertion, or deletion).
    Neighbors are sorted ascending. No trailing newline.
"""
import sys
from collections import defaultdict


def filter_by_zipf(words, threshold):
    from wordfreq import zipf_frequency
    return [w for w in words if zipf_frequency(w, "en") >= threshold]


def build_graph(words):
    """Return (sorted_words, neighbors_list_of_sets) where sorted_words is
    ordered by (len, alpha) and neighbors[i] is a sorted list of indices."""
    words = sorted(set(words), key=lambda w: (len(w), w))
    idx_of = {w: i for i, w in enumerate(words)}
    word_set = set(words)
    neighbors = [set() for _ in words]

    # Same-length neighbors: bucket by positional wildcard pattern
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

    # Length-differs-by-one neighbors: for each word w, each deletion variant
    # that is also a word is a neighbor.
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
    with open(path, "w") as f:
        out = []
        for w, nb in zip(words, neighbors):
            if nb:
                out.append(w + "," + ",".join(str(i) for i in nb))
            else:
                out.append(w + ",")
        # No trailing newline, to match the pre-shortened file.
        f.write("\n".join(out))


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    zipf = None
    if "--zipf" in args:
        i = args.index("--zipf")
        zipf = float(args[i + 1])
        args = args[:i] + args[i + 2 :]

    input_path, output_path = args[0], args[1]

    with open(input_path) as f:
        words = [w.strip().lower() for w in f if w.strip()]
    words = [w for w in words if w.isalpha()]
    print(f"Loaded {len(words)} words from {input_path}")

    if zipf is not None:
        words = filter_by_zipf(words, zipf)
        print(f"After zipf>={zipf} filter: {len(words)} words")

    sorted_words, neighbors = build_graph(words)
    total_edges = sum(len(nb) for nb in neighbors)
    print(f"Built graph: {len(sorted_words)} words, {total_edges//2} edges")

    write_graph(output_path, sorted_words, neighbors)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
