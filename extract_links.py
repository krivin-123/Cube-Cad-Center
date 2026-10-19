import re

html_path = r'C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\.system_generated\steps\1035\content.md'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract all links that might point to a course page
links = set(re.findall(r'href=[\'"]([^\'"]+)[\'"]', html))
for link in sorted(links):
    if "cubecadcenter.co" in link or "course" in link.lower() or link.startswith('/'):
        print(link)

# Alternatively, extract text from Wix data object if it exists
import json
try:
    match = re.search(r'window\.viewerModel = JSON\.parse\((.*?)\)', html)
    if match:
        print("Found viewer model!")
except Exception as e:
    pass
