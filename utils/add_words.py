"""
Insert words into an existing word_graph.txt-format file without rebuilding
it from the source lists.

Usage:
    python3 add_words.py <graph.txt> word [word ...]

Keeps the file's ordering (by length, then alphabetically) and neighbour rule
(one substitution, insertion or deletion) exactly as build_word_graph.py
produces them, so the result matches a full rebuild with the same word set.
Indices of every word after an insertion point are shifted accordingly.
Words already present are skipped. The file keeps no trailing newline.
"""
import bisect
import sys


def load(path):
    rows = []
    with open(path) as f:
        for line in f.read().split("\n"):
            if not line:
                continue
            w, _, rest = line.partition(",")
            rows.append([w, [int(x) for x in rest.split(",") if x]])
    return rows


def neighbours(w, idx_of):
    out = set()
    letters = "abcdefghijklmnopqrstuvwxyz"
    for i in range(len(w)):
        for c in letters:
            if c != w[i]:
                s = w[:i] + c + w[i + 1:]
                if s in idx_of:
                    out.add(idx_of[s])
        d = w[:i] + w[i + 1:]
        if d in idx_of:
            out.add(idx_of[d])
    for i in range(len(w) + 1):
        for c in letters:
            s = w[:i] + c + w[i:]
            if s in idx_of:
                out.add(idx_of[s])
    return out


def add(rows, word):
    keys = [(len(r[0]), r[0]) for r in rows]
    pos = bisect.bisect_left(keys, (len(word), word))
    if pos < len(rows) and rows[pos][0] == word:
        return None
    # Shift every index at or after the insertion point.
    for r in rows:
        r[1] = [i + 1 if i >= pos else i for i in r[1]]
    rows.insert(pos, [word, []])
    idx_of = {r[0]: i for i, r in enumerate(rows)}
    nb = neighbours(word, idx_of)
    rows[pos][1] = sorted(nb)
    for i in nb:
        rows[i][1] = sorted(set(rows[i][1]) | {pos})
    return pos, [rows[i][0] for i in sorted(nb)]


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    path, words = sys.argv[1], sys.argv[2:]
    rows = load(path)
    for w in words:
        w = w.strip().lower()
        if not (w.isalpha() and w.isascii()):
            print(f"skip {w!r}: not a plain word")
            continue
        r = add(rows, w)
        if r is None:
            print(f"{w}: already present")
        else:
            print(f"{w}: inserted at {r[0]}, {len(r[1])} neighbours: {' '.join(r[1])}")
    with open(path, "w") as f:
        f.write("\n".join(r[0] + "," + ",".join(map(str, r[1])) for r in rows))


if __name__ == "__main__":
    main()
