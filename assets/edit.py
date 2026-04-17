with open('input.txt', 'r') as infile:
    words = [line.strip() for line in infile if line.strip().isalpha() and line.strip().islower()]

with open('output.txt', 'w') as outfile:
    for word in sorted(words):
        outfile.write(word + '\n')
