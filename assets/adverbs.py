with open('expanded_words.txt') as f:
    original_words = [w.strip() for w in f if w.strip()]

with open('legal_words.txt') as f:
    legal_words = set(w.strip() for w in f if w.strip())

# Build new candidates
additional_words = set()
for word in original_words:
    for suffix in ['ly', 'ally']:
        candidate = word + suffix
        if candidate in legal_words:
            additional_words.add(candidate)

# Combine, deduplicate, sort
all_words = sorted(set(original_words).union(additional_words))

# Save back to file
with open('expanded_words.txt', 'w') as f:
    for word in all_words:
        f.write(word + '\n')
