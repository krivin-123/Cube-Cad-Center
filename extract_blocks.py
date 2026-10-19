import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

head_match = re.search(r'(<head>.*?</head>)', html, re.DOTALL)
if head_match:
    with open(r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\scratch\head_block.txt", 'w', encoding='utf-8') as f:
        f.write(head_match.group(1))

script_match = re.search(r'(<script>.*? Interactive Waves Canvas Implementation.*?</script>)', html, re.DOTALL)
if script_match:
    with open(r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\scratch\waves_block.txt", 'w', encoding='utf-8') as f:
        f.write(script_match.group(1))

animations_match = re.search(r'(<script>\s*// --- Premium UI Redesign Animations ---.*?</script>)', html, re.DOTALL)
if animations_match:
    with open(r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\scratch\animations_block.txt", 'w', encoding='utf-8') as f:
        f.write(animations_match.group(1))
