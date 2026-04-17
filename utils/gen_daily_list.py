"""
Generate daily puzzle list for the word game.

- Verifies each candidate pair has a path in word_graph_merged15.txt
- Culls pairs with ideal path outside [MIN_STEPS, MAX_STEPS]
- Writes assets/daily_list.txt as DD-MM-YYYY,start,end starting at START_DATE
- Difficulty staggered across the week: Mon/Tue easiest, Sun hardest.
"""
import datetime as dt
import random
import sys
from collections import deque

GRAPH_PATH = 'assets/word_graph_merged15.txt'
OUT_PATH = 'assets/daily_list.txt'
START_DATE = dt.date(2026, 4, 16)  # Thursday
MIN_STEPS = 5
MAX_STEPS = 12

# Brainstormed themed pairs — food, opposites, nature, body, objects, etc.
CANDIDATES = [
    # Food & drink
    ('fish', 'chips'), ('peanut', 'butter'), ('bread', 'butter'),
    ('salt', 'pepper'), ('milk', 'honey'), ('coffee', 'cream'),
    ('ham', 'eggs'), ('bacon', 'eggs'), ('toast', 'jam'),
    ('tea', 'cake'), ('cup', 'tea'), ('soup', 'bread'),
    ('milk', 'cookie'), ('wine', 'beer'), ('apple', 'pear'),
    ('pie', 'cake'), ('mac', 'cheese'), ('rice', 'bean'),
    ('cream', 'sugar'), ('wine', 'cheese'), ('salt', 'sugar'),
    ('beef', 'pork'), ('lemon', 'lime'), ('mint', 'tea'),
    ('beer', 'wine'), ('tea', 'milk'), ('pizza', 'pasta'),
    ('fries', 'burger'), ('cake', 'pie'), ('corn', 'bean'),
    # Opposites
    ('day', 'night'), ('hot', 'cold'), ('up', 'down'),
    ('love', 'hate'), ('rich', 'poor'), ('wet', 'dry'),
    ('fast', 'slow'), ('good', 'bad'), ('hard', 'soft'),
    ('short', 'long'), ('young', 'old'), ('big', 'small'),
    ('light', 'dark'), ('high', 'low'), ('right', 'wrong'),
    ('black', 'white'), ('happy', 'sad'), ('wide', 'thin'),
    ('near', 'far'), ('true', 'false'), ('open', 'shut'),
    ('begin', 'end'), ('first', 'last'), ('pass', 'fail'),
    ('yes', 'no'), ('win', 'lose'), ('buy', 'sell'),
    ('push', 'pull'), ('raw', 'cooked'), ('rise', 'fall'),
    # Nature
    ('sun', 'moon'), ('earth', 'sky'), ('fire', 'ice'),
    ('rain', 'snow'), ('sand', 'sea'), ('tree', 'leaf'),
    ('rose', 'thorn'), ('rain', 'sun'), ('star', 'sky'),
    ('seed', 'tree'), ('root', 'leaf'), ('wind', 'storm'),
    ('cloud', 'rain'), ('river', 'lake'), ('ocean', 'sea'),
    ('forest', 'field'), ('stone', 'dust'), ('mud', 'sand'),
    # Body
    ('hand', 'foot'), ('head', 'toe'), ('eye', 'ear'),
    ('nose', 'ear'), ('arm', 'leg'), ('hair', 'skin'),
    ('lip', 'tongue'), ('heart', 'brain'), ('bone', 'flesh'),
    # Objects/Household
    ('lock', 'key'), ('fork', 'spoon'), ('pen', 'ink'),
    ('door', 'key'), ('bow', 'arrow'), ('knife', 'fork'),
    ('broom', 'mop'), ('soap', 'water'), ('lamp', 'shade'),
    ('bed', 'pillow'), ('chair', 'table'), ('pot', 'pan'),
    ('oven', 'stove'), ('rope', 'chain'), ('nail', 'screw'),
    # Animals
    ('cat', 'dog'), ('cat', 'mouse'), ('bird', 'nest'),
    ('bee', 'hive'), ('fish', 'hook'), ('bear', 'cub'),
    ('lion', 'tiger'), ('mouse', 'cheese'), ('dog', 'bone'),
    ('wolf', 'pack'), ('fox', 'hound'), ('owl', 'nest'),
    ('duck', 'pond'), ('pig', 'mud'),
    # Weather/Seasons
    ('spring', 'summer'), ('summer', 'fall'), ('fall', 'winter'),
    ('winter', 'spring'),
    # Actions
    ('sleep', 'wake'), ('walk', 'run'), ('jump', 'run'),
    ('sing', 'dance'), ('read', 'write'), ('cook', 'eat'),
    ('live', 'die'), ('grow', 'die'), ('fight', 'peace'),
    ('laugh', 'cry'), ('smile', 'frown'), ('talk', 'whisper'),
    # Class/Royalty
    ('king', 'queen'), ('bride', 'groom'), ('hero', 'villain'),
    ('gold', 'dust'), ('rich', 'gold'), ('duke', 'lord'),
    # Compass
    ('north', 'south'), ('east', 'west'), ('left', 'right'),
    # Colors
    ('red', 'blue'), ('pink', 'rose'), ('gold', 'silver'),
    # Cards/Games
    ('heads', 'tails'), ('jack', 'queen'),
    # Sports
    ('ball', 'bat'), ('puck', 'stick'),
    # Music
    ('drum', 'beat'), ('note', 'song'), ('song', 'tune'),
    # Religion
    ('heaven', 'hell'), ('angel', 'devil'), ('saint', 'sinner'),
    # Writing
    ('ink', 'paper'), ('pen', 'paper'), ('book', 'page'),
    # Relationships
    ('mama', 'papa'), ('boy', 'girl'), ('son', 'dad'),
    ('wife', 'husband'),
    # Space
    ('earth', 'mars'), ('star', 'moon'),
    # Plants
    ('rose', 'weed'),
    # Cars/Travel
    ('car', 'gas'), ('gas', 'oil'), ('ship', 'port'),
    ('road', 'path'), ('plane', 'train'),
    # Liquids
    ('salt', 'water'), ('wine', 'water'), ('milk', 'water'),
    # Stones
    ('rock', 'roll'), ('stone', 'gem'),
    # Time
    ('past', 'future'), ('dawn', 'dusk'),
    # Art/Tools
    ('paint', 'brush'), ('saw', 'hammer'),
    # Fire theme
    ('fire', 'water'), ('fire', 'smoke'),
    # Sharp
    ('knife', 'blade'), ('sharp', 'blunt'),
    # Emotions
    ('love', 'life'), ('birth', 'death'), ('pride', 'shame'),
    ('hope', 'fear'), ('joy', 'pain'),
    # Movement
    ('land', 'water'), ('earth', 'mars'), ('east', 'dawn'),
    # Clothes
    ('hat', 'sock'), ('shirt', 'pants'), ('shoe', 'sock'),
    ('coat', 'scarf'), ('boots', 'socks'),
    # School
    ('book', 'read'), ('class', 'break'), ('math', 'test'),
    ('pen', 'test'), ('write', 'read'),
    # Kitchen actions
    ('bake', 'roast'), ('boil', 'fry'), ('chop', 'slice'),
    # Computing / modern
    ('mouse', 'click'), ('game', 'quest'), ('blog', 'post'),
    # Animals (more)
    ('rat', 'mouse'), ('hen', 'egg'), ('chick', 'chicken'),
    # Magic / fantasy
    ('wand', 'magic'), ('witch', 'ghost'),
    # Adventure
    ('pirate', 'gold'), ('map', 'gold'),
    # Home
    ('roof', 'floor'), ('door', 'wall'), ('wall', 'floor'),
    # Water activities
    ('swim', 'dive'), ('boat', 'dock'),
    # Seasons short
    ('snow', 'rain'), ('heat', 'cold'),
    # Parts of face
    ('lip', 'chin'), ('chin', 'nose'),
    # Feelings
    ('calm', 'storm'), ('peace', 'chaos'),
    # Playing
    ('hide', 'seek'), ('cops', 'robber'),
    # School subjects
    ('math', 'art'),
    # Fairy tale pairs
    ('frog', 'prince'), ('glass', 'slipper'),
    # Classic
    ('cake', 'fork'), ('fork', 'plate'), ('bowl', 'spoon'),
    # Days/parts
    ('morn', 'night'), ('dawn', 'dark'),
    # Holidays
    ('bells', 'holly'), ('pumpkin', 'candy'),
    # Time
    ('clock', 'hour'), ('hour', 'minute'),
    # Art
    ('music', 'dance'), ('paint', 'draw'),
    # Fishing
    ('hook', 'worm'), ('net', 'fish'),
    # Fun misc
    ('happy', 'merry'), ('joy', 'tears'),
    # Classic lit / phrases
    ('pride', 'fall'), ('black', 'crow'),
    # Bread/dough
    ('dough', 'bread'), ('bread', 'loaf'),
    # Drinks
    ('juice', 'water'), ('soda', 'juice'),
    # Garden
    ('bush', 'tree'), ('weed', 'flower'),
    # Weather
    ('sun', 'storm'), ('wind', 'calm'),
    # Big finishes
    ('start', 'end'), ('open', 'close'),
    # Classic story
    ('quest', 'hero'),
    # Adjectives
    ('brave', 'scare'), ('mean', 'kind'),
    # Sky
    ('cloud', 'star'), ('bird', 'sky'),
    # Ocean
    ('shark', 'whale'), ('reef', 'fish'),
    # Office
    ('boss', 'staff'), ('desk', 'chair'),
    # Summer/fun
    ('beach', 'shore'), ('park', 'tree'),
    # Adjectives
    ('new', 'old'), ('cold', 'warm'),
    # Others
    ('truth', 'lie'), ('hell', 'fire'),
    ('gold', 'silver'), ('tiger', 'lion'),
    # Wordy themes
    ('speak', 'whine'), ('shout', 'scream'),
    # Misc food
    ('sushi', 'ramen'), ('bread', 'rolls'),
    # More
    ('moon', 'star'), ('star', 'sun'),
    # Simple connecting
    ('cat', 'hat'), ('hat', 'bat'),
    # Longer
    ('castle', 'palace'), ('swan', 'duck'),
    # Feelings + actions
    ('sleep', 'dream'), ('dream', 'wake'),
]


def load_graph(path):
    with open(path) as f:
        raw = f.read()
    lines = raw.split('\n')
    words = [ln.split(',')[0] for ln in lines]
    graph = []
    for ln in lines:
        parts = ln.split(',')[1:]
        graph.append([int(x) for x in parts if x != ''])
    idx_of = {w: i for i, w in enumerate(words)}
    return words, graph, idx_of


def bfs_length(start, end, words, graph, idx_of):
    if start not in idx_of or end not in idx_of:
        return None
    s, t = idx_of[start], idx_of[end]
    if s == t:
        return 0
    parent = {s: None}
    q = deque([s])
    while q:
        c = q.popleft()
        for nb in graph[c]:
            if nb in parent:
                continue
            parent[nb] = c
            if nb == t:
                # reconstruct to get length
                length = 0
                cur = nb
                while cur is not None:
                    cur = parent[cur]
                    if cur is not None:
                        length += 1
                return length
            q.append(nb)
    return None  # no path


def main():
    words, graph, idx_of = load_graph(GRAPH_PATH)
    print(f"graph loaded: {len(words)} words")

    results = []
    rejected = []
    for a, b in CANDIDATES:
        a, b = a.lower(), b.lower()
        # Dedupe reversed pairs
        length = bfs_length(a, b, words, graph, idx_of)
        if length is None:
            reason = "no path"
            if a not in idx_of:
                reason = f"'{a}' not in dict"
            elif b not in idx_of:
                reason = f"'{b}' not in dict"
            rejected.append((a, b, reason))
        else:
            results.append((a, b, length))

    print(f"\nvalid pairs: {len(results)}, rejected: {len(rejected)}")

    print("\nRejected pairs:")
    for a, b, r in rejected:
        print(f"  {a} -> {b}: {r}")

    print("\nValid pairs with path length:")
    for a, b, L in sorted(results, key=lambda x: x[2]):
        print(f"  {L:>2}  {a} -> {b}")

    # Filter by step range
    kept = [(a, b, L) for (a, b, L) in results if MIN_STEPS <= L <= MAX_STEPS]
    # Dedupe in case both (x,y) and (y,x) are candidates (same length)
    seen = set()
    deduped = []
    for a, b, L in kept:
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        deduped.append((a, b, L))
    kept = deduped
    print(f"\nafter culling <4 or >12: {len(kept)} pairs")

    # Difficulty distribution target per weekday (0=Mon .. 6=Sun).
    # Lower weekdays take easier puzzles, Sunday the hardest.
    DAY_DIFF_PREF = {
        0: (5, 5),    # Mon
        1: (5, 6),    # Tue
        2: (6, 7),    # Wed
        3: (7, 8),    # Thu
        4: (8, 9),    # Fri
        5: (9, 10),   # Sat
        6: (10, 12),  # Sun
    }

    # Shuffle within-length groups so picks aren't alphabetical.
    random.seed(42)
    by_len = {}
    for a, b, L in kept:
        by_len.setdefault(L, []).append((a, b))
    for L in by_len:
        random.shuffle(by_len[L])

    # For each date starting at START_DATE, pick the best-fit pair for
    # that weekday, preferring lengths inside the weekday's target range
    # and otherwise falling back to the closest length available.
    def pick_for(dow):
        lo, hi = DAY_DIFF_PREF[dow]
        # Try lengths inside [lo,hi] first
        for L in range(lo, hi + 1):
            if by_len.get(L):
                return by_len[L].pop(), L
        # Fall back: closest length
        remaining_lengths = sorted([L for L in by_len if by_len[L]])
        if not remaining_lengths:
            return None, None
        mid = (lo + hi) / 2
        closest = min(remaining_lengths, key=lambda L: abs(L - mid))
        return by_len[closest].pop(), closest

    # Build date->pair list until we run out.
    output = []
    d = START_DATE
    while True:
        pick, L = pick_for(d.weekday())
        if pick is None:
            break
        a, b = pick
        output.append((d, a, b, L))
        d += dt.timedelta(days=1)

    print(f"\ndaily list entries: {len(output)}")
    print("\nfirst 21 entries (3 weeks):")
    for d, a, b, L in output[:21]:
        print(f"  {d.strftime('%a %d-%m-%Y')}  {a:>10} -> {b:<10}  ({L} steps)")

    # Write the file: DD-MM-YYYY,start,end
    with open(OUT_PATH, 'w') as f:
        for d, a, b, L in output:
            f.write(f"{d.strftime('%d-%m-%Y')},{a},{b}\n")
    print(f"\nwrote {OUT_PATH}")


if __name__ == '__main__':
    main()
