import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Fix double script tags
html = html.replace("<script>\n<script>", "<script>")
html = html.replace("</script>\n    </script>", "</script>")

# Fix the broken `blurAnim;` cutoff. Wait, let me check why it was cut off.
