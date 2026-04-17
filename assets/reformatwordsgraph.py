import re

with open('wordmap2.txt', 'r') as f:
    lines = f.readlines()

with open('wordmap3.txt', 'w') as f:
    for line in lines:
        line = line.strip()
        if line:
            match = re.match(r'^([^:]+):\[([^\]]*)\]$', line)
            key = match.group(1)
            values = match.group(2)
            if values:
                f.write(key + ',' + values.replace(' ', '') + '\n')
            else:
                f.write(key + ',\n')
