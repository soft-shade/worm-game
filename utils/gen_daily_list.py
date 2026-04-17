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
END_DATE = dt.date(2027, 12, 31)
MIN_STEPS = 5
MAX_STEPS = 12

# Fixed-date overrides, applied after the automatically-generated
# sequence. Each entry replaces (or adds) the pair for that date even
# if its ideal chain length is outside [MIN_STEPS, MAX_STEPS].
OVERRIDES = {
    # April Fools 2027 — the diameter of the whole word graph (38
    # steps: spluttered -> ... -> begetting). Meant to be unsolvable
    # at a glance; a joke puzzle for the day.
    dt.date(2027, 4, 1): ('spluttered', 'begetting'),
}

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

    # ---- expanded batch ----
    # More food
    ('bread', 'toast'), ('meat', 'fish'), ('egg', 'nest'),
    ('cookie', 'crumb'), ('cake', 'crumb'), ('crust', 'slice'),
    ('soup', 'stew'), ('stew', 'beef'), ('fries', 'chips'),
    ('cone', 'scoop'), ('scoop', 'cream'), ('wafer', 'cookie'),
    ('bagel', 'donut'), ('donut', 'hole'), ('honey', 'bee'),
    ('butter', 'cream'), ('flour', 'dough'), ('yeast', 'beer'),
    ('syrup', 'honey'), ('spice', 'herb'), ('pepper', 'mint'),
    ('plum', 'pear'), ('grape', 'wine'), ('tart', 'pie'),
    ('cherry', 'berry'), ('lemon', 'tart'),
    # More opposites
    ('sweet', 'sour'), ('loud', 'quiet'), ('empty', 'full'),
    ('dirty', 'clean'), ('smooth', 'rough'), ('thick', 'thin'),
    ('heavy', 'light'), ('tall', 'short'), ('deep', 'shallow'),
    ('dull', 'sharp'), ('strong', 'weak'), ('kind', 'cruel'),
    ('north', 'east'), ('east', 'south'), ('south', 'west'),
    # More actions
    ('swim', 'float'), ('drive', 'park'), ('fly', 'land'),
    ('climb', 'fall'), ('crawl', 'walk'), ('skip', 'hop'),
    ('slip', 'trip'), ('eat', 'drink'), ('bite', 'chew'),
    ('chew', 'swallow'), ('smell', 'taste'), ('hear', 'see'),
    ('hug', 'kiss'), ('touch', 'feel'), ('build', 'break'),
    ('break', 'fix'), ('catch', 'throw'), ('throw', 'catch'),
    ('give', 'take'), ('take', 'give'), ('lift', 'drop'),
    ('shake', 'stir'),
    # More emotions
    ('angry', 'calm'), ('bored', 'excited'), ('scared', 'brave'),
    ('proud', 'ashamed'), ('hungry', 'full'), ('tired', 'awake'),
    ('awake', 'asleep'), ('nervous', 'calm'), ('merry', 'glum'),
    # More nature
    ('flower', 'petal'), ('grass', 'blade'), ('dirt', 'mud'),
    ('wave', 'shore'), ('tide', 'wave'), ('leaf', 'branch'),
    ('branch', 'trunk'), ('root', 'stem'), ('bud', 'bloom'),
    ('seed', 'sprout'), ('ice', 'fire'), ('fog', 'mist'),
    ('breeze', 'wind'), ('hail', 'snow'), ('dew', 'frost'),
    # More household / objects
    ('book', 'cover'), ('page', 'word'), ('clock', 'watch'),
    ('watch', 'wrist'), ('purse', 'wallet'), ('bag', 'tote'),
    ('box', 'crate'), ('bottle', 'cap'), ('sink', 'drain'),
    ('tub', 'soap'), ('mirror', 'wall'), ('lamp', 'bulb'),
    ('shelf', 'book'), ('couch', 'bed'), ('bed', 'sheet'),
    ('sheet', 'pillow'), ('rug', 'floor'), ('pan', 'lid'),
    # More places
    ('city', 'town'), ('town', 'village'), ('house', 'home'),
    ('shop', 'store'), ('park', 'yard'), ('yard', 'lawn'),
    ('room', 'hall'), ('stage', 'show'), ('bank', 'coin'),
    ('farm', 'barn'), ('barn', 'hay'),
    # More body
    ('teeth', 'tongue'), ('jaw', 'chin'), ('cheek', 'chin'),
    ('neck', 'nape'), ('wrist', 'ankle'), ('knee', 'foot'),
    ('elbow', 'wrist'), ('palm', 'wrist'),
    # More animals
    ('cow', 'calf'), ('hen', 'chick'), ('pup', 'dog'),
    ('lamb', 'sheep'), ('kitten', 'cat'), ('cat', 'kitten'),
    ('duck', 'duckling'), ('dog', 'puppy'), ('foal', 'horse'),
    ('hog', 'pig'), ('goat', 'sheep'), ('horse', 'pony'),
    # More transport
    ('car', 'truck'), ('plane', 'jet'), ('bus', 'train'),
    ('bike', 'car'), ('boat', 'yacht'), ('canoe', 'kayak'),
    ('ship', 'dock'), ('sea', 'ship'), ('train', 'track'),
    # Sports
    ('goal', 'net'), ('bat', 'ball'), ('club', 'golf'),
    ('net', 'point'), ('game', 'score'), ('hoop', 'ball'),
    # Jobs
    ('cook', 'chef'), ('nurse', 'doctor'), ('farmer', 'field'),
    ('pilot', 'plane'), ('baker', 'bread'),
    # More music
    ('drum', 'horn'), ('piano', 'key'), ('note', 'chord'),
    ('song', 'verse'), ('flute', 'horn'), ('bass', 'drum'),
    # Literature
    ('novel', 'poem'), ('story', 'tale'), ('fact', 'myth'),
    ('chapter', 'page'),
    # Time
    ('noon', 'night'), ('dawn', 'day'), ('minute', 'hour'),
    ('week', 'month'), ('year', 'day'), ('today', 'tomorrow'),
    # Kids / play
    ('hide', 'find'), ('play', 'rest'), ('toy', 'child'),
    # Fantasy
    ('sword', 'shield'), ('dragon', 'knight'), ('magic', 'spell'),
    ('spell', 'curse'), ('elf', 'fairy'), ('wand', 'spell'),
    # Random
    ('match', 'flame'), ('flame', 'spark'), ('spark', 'fire'),
    ('thunder', 'storm'), ('echo', 'sound'), ('ring', 'bell'),
    ('bell', 'chime'), ('chime', 'bell'),
    # Rooms
    ('kitchen', 'pantry'), ('bath', 'shower'), ('shower', 'bath'),
    # Office
    ('paper', 'file'), ('file', 'folder'), ('folder', 'stack'),
    # Office actions
    ('screen', 'key'), ('phone', 'call'), ('mouse', 'pad'),
    # Classic phrases
    ('trick', 'treat'), ('cup', 'saucer'), ('cake', 'candle'),
    ('bread', 'crumb'), ('salt', 'wound'), ('bird', 'feather'),
    ('lion', 'mane'), ('horse', 'mane'), ('cat', 'whisker'),
    # Adjectives
    ('calm', 'wild'), ('tame', 'wild'), ('brave', 'meek'),
    ('gentle', 'harsh'), ('plain', 'fancy'),
    # More nature pairs
    ('vine', 'grape'), ('moss', 'fern'), ('fern', 'leaf'),
    ('beach', 'sand'), ('cliff', 'ocean'), ('hill', 'dale'),
    ('dale', 'glen'), ('pond', 'lake'),
    # More food/drink
    ('milk', 'tea'), ('tea', 'cup'), ('cup', 'mug'),
    ('mug', 'jug'), ('jug', 'pot'), ('oil', 'fat'),
    ('fat', 'thin'), ('nut', 'bolt'),
    # Action pairs
    ('rest', 'work'), ('play', 'work'), ('work', 'play'),
    ('move', 'stop'), ('start', 'stop'), ('rise', 'set'),
    # Colors
    ('red', 'rose'), ('blue', 'sky'), ('green', 'leaf'),
    ('brown', 'mud'), ('yellow', 'sun'),
    # Musical instruments
    ('harp', 'lyre'), ('piano', 'harp'),
    # More modern
    ('blog', 'vlog'), ('post', 'tweet'),
    # Misc
    ('wheat', 'bread'), ('bean', 'pea'), ('pea', 'bean'),
    ('nut', 'seed'), ('seed', 'fruit'), ('fruit', 'core'),
    # Weather
    ('cloud', 'fog'), ('fog', 'smog'), ('heat', 'haze'),
    # Feelings short
    ('glad', 'sad'), ('mad', 'glad'),
    # Relationship
    ('host', 'guest'), ('kin', 'friend'),
    # Dance
    ('waltz', 'tango'), ('dance', 'step'),
    # Mapping / direction
    ('start', 'finish'), ('line', 'curve'),
    # Games
    ('rook', 'pawn'), ('pawn', 'king'), ('chess', 'piece'),
    # Fashion
    ('belt', 'buckle'), ('button', 'zipper'), ('tie', 'knot'),
    ('knot', 'bow'),
    # Body actions
    ('grip', 'clasp'), ('wink', 'blink'), ('blink', 'stare'),
    # More classic
    ('heart', 'soul'), ('soul', 'mind'), ('mind', 'brain'),
    # Kitchen items
    ('stove', 'oven'), ('plate', 'dish'), ('dish', 'bowl'),
    # Reverse / repeat pairs (different paths)
    ('bone', 'marrow'), ('vein', 'artery'),
    # Math
    ('plus', 'minus'), ('odd', 'even'), ('add', 'take'),
    # More
    ('snow', 'flake'), ('rain', 'drop'), ('sun', 'beam'),
    ('wind', 'gust'), ('storm', 'rain'),
    # Light / dark
    ('ray', 'beam'), ('dark', 'gloom'), ('glow', 'shine'),
    # Tools / handy
    ('tool', 'nail'), ('screw', 'bolt'), ('bolt', 'nut'),
    ('hammer', 'nail'), ('saw', 'axe'), ('axe', 'chop'),
    # Language
    ('word', 'verse'), ('line', 'verse'), ('verse', 'rhyme'),
    # Adventure
    ('map', 'key'), ('hero', 'quest'), ('cave', 'dark'),
    # Farm / country
    ('field', 'crop'), ('crop', 'grain'), ('grain', 'seed'),
    # Ocean life
    ('fish', 'scale'), ('shell', 'pearl'), ('crab', 'shell'),
    # Time of year
    ('rose', 'bloom'), ('snow', 'flake'),
    # Short opposites
    ('sit', 'stand'), ('hold', 'drop'),

    # ---- 2027 extension batch ----
    # Classic riddle / pop phrase pair
    ('escape', 'room'),
    # Holidays / seasons
    ('trick', 'treat'), ('valentine', 'heart'), ('easter', 'egg'),
    ('candy', 'cane'), ('sled', 'snow'), ('carol', 'song'),
    # More food
    ('pepper', 'salt'), ('olive', 'oil'), ('steak', 'chop'),
    ('pasta', 'sauce'), ('muffin', 'crumb'), ('lamb', 'stew'),
    ('jam', 'toast'), ('wheat', 'grain'), ('flour', 'bread'),
    ('salsa', 'chip'), ('curry', 'rice'),
    # More drinks
    ('tea', 'brew'), ('wine', 'cork'), ('beer', 'foam'),
    ('whine', 'beer'),
    # More animals
    ('crow', 'raven'), ('mole', 'rat'), ('ant', 'bee'),
    ('hawk', 'owl'), ('dove', 'crow'), ('frog', 'toad'),
    ('wasp', 'bee'), ('moth', 'butterfly'), ('fly', 'gnat'),
    ('calf', 'cow'), ('piglet', 'pig'), ('kitten', 'cat'),
    ('puppy', 'dog'), ('bunny', 'rabbit'),
    # More actions
    ('grow', 'shrink'), ('gain', 'lose'), ('rise', 'drop'),
    ('stand', 'kneel'), ('yell', 'shout'),
    # More nature
    ('hail', 'sleet'), ('mist', 'fog'), ('tide', 'wave'),
    ('leaf', 'fall'), ('stem', 'root'), ('bloom', 'fade'),
    # More household
    ('fan', 'cool'), ('heat', 'fire'), ('vent', 'air'),
    ('drip', 'drop'), ('leak', 'flood'),
    # Office + tech
    ('keys', 'lock'), ('card', 'chip'), ('phone', 'ring'),
    ('mouse', 'track'), ('key', 'code'),
    # Geology
    ('sand', 'stone'), ('stone', 'rock'),
    # Fish / sea
    ('trout', 'salmon'), ('whale', 'dolphin'), ('shell', 'reef'),
    # Birds
    ('nest', 'twig'), ('feather', 'wing'), ('wing', 'flight'),
    # Plants
    ('oak', 'elm'), ('pine', 'cone'), ('leaf', 'stem'),
    ('vine', 'leaf'),
    # Metal / craft
    ('iron', 'steel'), ('bronze', 'tin'), ('lead', 'gold'),
    # More clothes
    ('cap', 'hat'), ('scarf', 'tie'), ('glove', 'mitt'),
    ('skirt', 'pants'), ('dress', 'robe'),
    # Music / sound
    ('note', 'beat'), ('song', 'verse'), ('bass', 'drum'),
    ('chord', 'note'),
    # Money
    ('coin', 'bill'), ('cash', 'gold'), ('gold', 'silver'),
    ('bank', 'vault'),
    # More sports
    ('tennis', 'serve'), ('golf', 'club'), ('bat', 'glove'),
    ('puck', 'rink'), ('pitch', 'catch'),
    # Misc new
    ('queen', 'bee'), ('king', 'crown'), ('crown', 'throne'),
    ('pearl', 'shell'), ('rose', 'petal'),
    ('blade', 'grass'),
    # Short connectors
    ('bar', 'pub'), ('pub', 'bar'),
    ('sad', 'merry'), ('dim', 'bright'),
    # Transport more
    ('train', 'tracks'), ('taxi', 'cab'), ('ferry', 'boat'),
    # Misc themed
    ('bride', 'veil'), ('groom', 'vow'),
    # Work
    ('boss', 'worker'), ('nurse', 'patient'),
    # Holiday feelings
    ('gift', 'wrap'), ('wrap', 'ribbon'),
    # Party
    ('cake', 'icing'), ('balloon', 'string'),
    # Communication
    ('call', 'text'), ('mail', 'letter'), ('letter', 'stamp'),
    ('talk', 'speak'),
    # Shapes
    ('round', 'oval'), ('square', 'box'), ('ring', 'band'),
    # Colors more
    ('gray', 'white'), ('brown', 'tan'),
    # Rooms
    ('porch', 'door'), ('stairs', 'landing'),
    # Entertainment
    ('stage', 'show'), ('movie', 'film'), ('film', 'reel'),
    ('show', 'act'),
    # School more
    ('desk', 'pen'), ('test', 'pass'), ('grade', 'score'),
    # Medical
    ('wound', 'scar'), ('heal', 'cure'), ('pill', 'dose'),
    # Garden
    ('spade', 'shovel'), ('pot', 'plant'), ('seed', 'sprout'),
    # Books
    ('poet', 'rhyme'), ('story', 'chapter'),
    # Miscellaneous
    ('loud', 'soft'), ('late', 'early'), ('old', 'new'),
    ('neat', 'messy'),
    # Humans / life
    ('birth', 'cry'), ('live', 'learn'),
    # Extra themed pairs
    ('morning', 'evening'), ('noon', 'dusk'),
    ('puzzle', 'clue'), ('code', 'key'),
    ('haze', 'fog'), ('blaze', 'fire'),
    ('craft', 'art'), ('paint', 'color'),
    ('tree', 'wood'), ('wood', 'chair'),
    ('gasp', 'wheeze'), ('yawn', 'nap'),
    ('curse', 'bless'), ('sin', 'virtue'),
    ('coin', 'toss'), ('dice', 'roll'),
    ('cat', 'rat'), ('ant', 'fly'),
    ('box', 'lid'), ('lid', 'cap'),
    ('ice', 'snow'), ('sun', 'ray'),
    ('ball', 'cup'), ('cup', 'bowl'),
    ('pile', 'heap'), ('heap', 'stack'),
    ('mud', 'bog'), ('bog', 'swamp'),
    ('jewel', 'gem'), ('gem', 'ruby'),
    ('ruby', 'red'), ('blue', 'cyan'),
    ('wise', 'smart'), ('bright', 'smart'),
    ('dumb', 'mute'), ('silent', 'still'),
    ('rough', 'harsh'), ('gentle', 'kind'),
    ('hedge', 'bush'), ('grass', 'turf'),
    ('bank', 'slope'), ('slope', 'hill'),
    ('hill', 'mound'), ('mound', 'pile'),
    ('track', 'path'), ('trail', 'path'),
    ('ride', 'drive'), ('drive', 'race'),
    ('race', 'run'), ('run', 'sprint'),
    ('jumper', 'shirt'),
    ('tall', 'big'), ('small', 'tiny'),
    ('pop', 'fizz'), ('fizz', 'bubble'),
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

    # Build date->pair list until we reach END_DATE or run out of pairs.
    output = []
    d = START_DATE
    while d <= END_DATE:
        pick, L = pick_for(d.weekday())
        if pick is None:
            break
        a, b = pick
        output.append((d, a, b, L))
        d += dt.timedelta(days=1)

    print(f"\ngenerated entries: {len(output)}")

    # Apply fixed-date overrides: replace any generated entry for an
    # overridden date, and add standalone entries for dates outside the
    # generated range. Sort by date before writing.
    by_date = {d: (a, b) for (d, a, b, _L) in output}
    for ov_date, (a, b) in OVERRIDES.items():
        by_date[ov_date] = (a, b)
    ordered = sorted(by_date.items(), key=lambda kv: kv[0])
    print(f"\ndaily list entries: {len(ordered)}")
    print("\nfirst 21 entries (3 weeks):")
    for d, (a, b) in ordered[:21]:
        print(f"  {d.strftime('%a %d-%m-%Y')}  {a:>10} -> {b}")

    # Write the file: DD-MM-YYYY,start,end
    with open(OUT_PATH, 'w') as f:
        for d, (a, b) in ordered:
            f.write(f"{d.strftime('%d-%m-%Y')},{a},{b}\n")
    print(f"\nwrote {OUT_PATH}")


if __name__ == '__main__':
    main()
