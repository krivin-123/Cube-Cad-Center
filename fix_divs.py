import os

target_dir = r"c:\Users\praja\Downloads\new\website"
files = ["explore.html", "syllabus-architectural.html", "syllabus-structural.html", "syllabus-mechanical.html", "syllabus-mep.html"]

for f_name in files:
    file_path = os.path.join(target_dir, f_name)
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # We need to insert three closing divs before <!-- Global Background Animation -->
    # ONLY if they are not already there.
    # The current sequence is:
    #             </div>
    # <!-- Global Background Animation -->
    # Let's just do a string replace
    
    marker = "<!-- Global Background Animation -->"
    
    # Check if we already fixed it
    if "</div>\n</div>\n</div>\n" + marker in html or "</div>\n        </div>\n    </div>\n<!-- Global Background" in html:
        continue
        
    html = html.replace(marker, "            </div>\n        </div>\n    </div>\n" + marker)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html)

print("Fixed missing closing divs on 5 pages.")
