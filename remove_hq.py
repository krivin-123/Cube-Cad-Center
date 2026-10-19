import os

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the HQ chip from the Satellite branch
old_text = """<h4 class="font-body-lg text-body-lg font-semibold text-on-surface">Satellite</h4>
<span class="chip">HQ</span>"""

new_text = """<h4 class="font-body-lg text-body-lg font-semibold text-on-surface">Satellite</h4>"""

html = html.replace(old_text, new_text)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Removed HQ chip.")
