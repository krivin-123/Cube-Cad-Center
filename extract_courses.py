import json
import re

html_path = r'C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\.system_generated\steps\1035\content.md'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Instead of parsing the massive JSON which is injected as javascript, let's just use regex to find course names.
# Common courses: AutoCAD, SolidWorks, Revit, SketchUp, Lumion, 3ds Max, Creo, CATIA, NX CAD, Ansys, Mastercam, Primavera, STAAD.Pro
courses = [
    "AutoCAD", "SolidWorks", "Revit", "SketchUp", "Lumion", "3ds Max", "Creo", "CATIA", 
    "NX CAD", "Ansys", "Mastercam", "Primavera", "STAAD.Pro", "Etabs", "Tekla", 
    "Rhino", "V-Ray", "Enscape", "Navisworks", "Fusion 360", "Inventor"
]

found_courses = set()
for course in courses:
    if re.search(r'\b' + re.escape(course) + r'\b', html, re.IGNORECASE):
        found_courses.add(course)

print("Courses explicitly mentioned in the website source:")
for c in sorted(found_courses):
    print(f"- {c}")

# Let's also extract any text block that looks like a course name. 
# Wix often stores text in objects like {"text":"AutoCAD 2D & 3D"}
text_blocks = re.findall(r'"text"\s*:\s*"([^"]+)"', html)
potential_courses = set()
for tb in text_blocks:
    if "course" in tb.lower() or "training" in tb.lower() or any(c.lower() in tb.lower() for c in courses):
        # clean html if any
        clean_tb = re.sub(r'<[^>]+>', '', tb)
        if len(clean_tb) < 50 and clean_tb.strip():
            potential_courses.add(clean_tb.strip())

print("\nPotential courses from JSON text blocks:")
for pc in sorted(potential_courses):
    print(f"- {pc}")
