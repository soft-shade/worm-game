import lemminflect
from lemminflect import getAllInflections

with open('expanded_words.txt') as f:
    base_words = [w.strip() for w in f if w.strip()]  # test on first 10 lines

expanded = set()

for word in base_words:
    inflections = getAllInflections(word)
    for forms in inflections.values():
        expanded.update(forms)

expanded.update(base_words)

final = sorted(w for w in expanded if w.isalpha() and w.islower())

with open('expanded_words.txt', 'w') as f:
    for word in final:
        f.write(word + '\n')
