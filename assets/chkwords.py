"""
Word Validator Script
Checks words from input.txt against a dictionary of common English words
and adds valid words to expanded_words.txt
"""

import nltk
import os
import re
from typing import Set, List

def setup_nltk():
    """Download required NLTK data if not already present"""
    try:
        nltk.data.find('corpora/words')
    except LookupError:
        print("Downloading NLTK words corpus...")
        nltk.download('words')

def load_common_words() -> Set[str]:
    """Load dictionary of common English words"""
    from nltk.corpus import words
    word_set = set(words.words())
    
    # Convert to lowercase for case-insensitive matching
    return {word.lower() for word in word_set}

def clean_word(word: str) -> str:
    """Clean a word by removing punctuation and converting to lowercase"""
    # Remove punctuation and extra whitespace
    cleaned = re.sub(r'[^\w]', '', word.strip())
    return cleaned.lower()

def is_valid_word(word: str) -> bool:
    """Check if a word is valid (not empty, contains letters, reasonable length)"""
    if not word or len(word) < 2:
        return False
    
    # Must contain at least one letter
    if not re.search(r'[a-zA-Z]', word):
        return False
    
    # Exclude very long words (likely not real words)
    if len(word) > 20:
        return False
    
    return True

def load_existing_words(filename: str) -> Set[str]:
    """Load existing words from the expanded wordlist"""
    existing_words = set()
    if os.path.exists(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                for line in f:
                    word = line.strip().lower()
                    if word:
                        existing_words.add(word)
        except Exception as e:
            print(f"Warning: Could not read {filename}: {e}")
    return existing_words

def read_input_words(filename: str) -> List[str]:
    """Read words from input file"""
    words = []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            # Split by whitespace and newlines
            raw_words = re.split(r'\s+', content)
            
            for word in raw_words:
                cleaned = clean_word(word)
                if is_valid_word(cleaned):
                    words.append(cleaned)
    except FileNotFoundError:
        print(f"Error: {filename} not found!")
        return []
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return []
    
    return words

def append_words_to_file(filename: str, words: List[str]):
    """Append new words to the expanded wordlist"""
    try:
        with open(filename, 'a', encoding='utf-8') as f:
            for word in words:
                f.write(f"{word}\n")
    except Exception as e:
        print(f"Error writing to {filename}: {e}")

def main():
    print("Word Validator Script")
    print("=" * 30)
    
    # Setup
    setup_nltk()
    
    # Load dictionary of common English words
    print("Loading English word dictionary...")
    common_words = load_common_words()
    print(f"Loaded {len(common_words):,} common English words")
    
    # Load existing words from expanded_words.txt
    print("Loading existing wordlist...")
    existing_words = load_existing_words('expanded_words.txt')
    print(f"Found {len(existing_words):,} existing words in expanded_words.txt")
    
    # Read words from input.txt
    print("Reading input words...")
    input_words = read_input_words('input.txt')
    
    if not input_words:
        print("No valid words found in input.txt")
        return
    
    print(f"Found {len(input_words):,} words in input.txt")
    
    # Filter words: must be in common dictionary and not already in expanded list
    valid_new_words = []
    stats = {
        'total': len(input_words),
        'in_dictionary': 0,
        'already_exists': 0,
        'added': 0
    }
    
    for word in input_words:
        if word in common_words:
            stats['in_dictionary'] += 1
            if word not in existing_words:
                valid_new_words.append(word)
                existing_words.add(word)  # Prevent duplicates within this run
            else:
                stats['already_exists'] += 1
    
    # Remove duplicates while preserving order
    seen = set()
    unique_new_words = []
    for word in valid_new_words:
        if word not in seen:
            unique_new_words.append(word)
            seen.add(word)
    
    stats['added'] = len(unique_new_words)
    
    # Append new words to expanded_words.txt
    if unique_new_words:
        print(f"Adding {len(unique_new_words)} new words to expanded_words.txt...")
        append_words_to_file('expanded_words.txt', unique_new_words)
        print("Words added successfully!")
        
        if len(unique_new_words) <= 20:
            print(f"New words: {', '.join(unique_new_words)}")
    else:
        print("No new valid words to add.")
    
    # Print summary
    print("\nSummary:")
    print(f"  Total words processed: {stats['total']}")
    print(f"  Words in dictionary: {stats['in_dictionary']}")
    print(f"  Words already in list: {stats['already_exists']}")
    print(f"  New words added: {stats['added']}")

if __name__ == "__main__":
    main()
