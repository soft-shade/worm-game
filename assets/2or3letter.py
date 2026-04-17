# Load expanded words
with open('expanded_words.txt') as f:
    expanded_words = [w.strip() for w in f if w.strip()]
expanded_set = set(expanded_words)

# Load and filter 2- or 3-letter legal words not already in expanded
with open('legal_words.txt') as f:
    short_words = [w.strip() for w in f if len(w.strip()) in (5, 7) and w.strip() not in expanded_set]

# Append new short words
with open('expanded_words.txt', 'a') as f:
    for word in short_words:
        f.write(word + '\n')
