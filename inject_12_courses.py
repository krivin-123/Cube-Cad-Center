import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

courses_data = [
    {
        "title": "AutoCAD 2D & 3D",
        "category": "Drafting & Foundation",
        "level": "Beginner Friendly",
        "duration": "1.5 Months",
        "features": ["UI & Core Commands", "Advanced 2D Drafting", "3D Isometric Views", "Plotting & Layouts"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "SolidWorks",
        "category": "Mechanical & 3D CAD",
        "level": "Intermediate",
        "duration": "2 Months",
        "features": ["Parametric Modeling", "Complex Assemblies", "Sheet Metal Design", "Motion Simulation"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Revit (Arch/MEP)",
        "category": "BIM & Structural",
        "level": "Advanced",
        "duration": "3 Months",
        "features": ["BIM Fundamentals", "Parametric Families", "Clash Detection", "Scheduling & BOQ"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "SketchUp",
        "category": "Architecture & Vis",
        "level": "Beginner Friendly",
        "duration": "1 Month",
        "features": ["Rapid 3D Prototyping", "Interior Modeling", "V-Ray Integration", "Walkthroughs"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Lumion",
        "category": "Architecture & Vis",
        "level": "Intermediate",
        "duration": "1 Month",
        "features": ["Photorealistic Renders", "Material Environments", "Cinematic Animations", "LiveSync Workflows"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "3ds Max",
        "category": "Architecture & Vis",
        "level": "Advanced",
        "duration": "2 Months",
        "features": ["High-Poly Modeling", "Advanced Texturing", "Lighting Simulations", "Exterior Rendering"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Creo",
        "category": "Mechanical & 3D CAD",
        "level": "Advanced",
        "duration": "2 Months",
        "features": ["Direct & Parametric", "Surfacing Tools", "Manufacturing Prep", "Structural Analysis"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "CATIA",
        "category": "Mechanical & 3D CAD",
        "level": "Advanced",
        "duration": "2.5 Months",
        "features": ["Aerospace Standard", "Complex Surfacing", "Kinematics", "Generative Shape Design"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Ansys",
        "category": "Simulation & Analysis",
        "level": "Advanced",
        "duration": "2 Months",
        "features": ["Finite Element Analysis", "Computational Fluid", "Thermal Simulations", "Structural Integrity"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "STAAD.Pro",
        "category": "Structural Analysis",
        "level": "Advanced",
        "duration": "1.5 Months",
        "features": ["Concrete Design", "Steel Frame Analysis", "Wind & Seismic Loads", "Foundation Design"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Etabs",
        "category": "Structural Analysis",
        "level": "Advanced",
        "duration": "1.5 Months",
        "features": ["Multi-Story Modeling", "Non-linear Analysis", "Shear Wall Design", "Dynamic Analysis"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    },
    {
        "title": "Inventor",
        "category": "Mechanical & 3D CAD",
        "level": "Intermediate",
        "duration": "2 Months",
        "features": ["Digital Prototyping", "Frame Generator", "Tube & Pipe Routing", "Dynamic Simulation"],
        "img": "architectural_cad_render_no_text_1787140409434.jpg"
    }
]

cards_html = ""
for course in courses_data:
    cards_html += f"""
            <!-- Course Card: {course['title']} -->
            <div class="surface-card flex flex-col rounded-2xl overflow-hidden group cursor-pointer border border-outline/20 hover:border-primary transition-colors duration-300">
                <div class="relative h-48 overflow-hidden bg-surface-variant">
                    <img src="{course['img']}" alt="{course['title']}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent opacity-80"></div>
                    <div class="absolute bottom-4 left-4">
                        <span class="chip bg-primary/20 text-primary border-primary/30 backdrop-blur-md">{course['category']}</span>
                    </div>
                </div>
                
                <div class="p-6 md:p-8 flex-grow flex flex-col">
                    <h3 class="font-headline-md text-2xl text-on-surface font-bold mb-2 group-hover:text-primary transition-colors">{course['title']}</h3>
                    
                    <div class="flex items-center gap-4 text-sm text-on-surface-variant mb-6 font-medium">
                        <div class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">signal_cellular_alt</span>
                            <span>{course['level']}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">schedule</span>
                            <span>{course['duration']}</span>
                        </div>
                    </div>
                    
                    <ul class="space-y-3 mb-8 flex-grow">
                        {''.join([f'<li class="flex items-start gap-3"><span class="material-symbols-outlined text-primary text-[20px] shrink-0">check_circle</span><span class="text-on-surface-variant">{feat}</span></li>' for feat in course['features']])}
                    </ul>
                    
                    <div class="mt-auto">
                        <a href="#" class="inline-flex items-center gap-2 text-primary font-bold hover:underline group/link">
                            Explore Syllabus
                            <span class="material-symbols-outlined transition-transform group-hover/link:translate-x-1">arrow_right_alt</span>
                        </a>
                    </div>
                </div>
            </div>"""

# Replace the inner grid of #courses
courses_pattern = re.compile(r'(<section id="courses".*?<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">)(.*?)(</div>\s*</div>\s*</section>)', re.DOTALL)
html = courses_pattern.sub(r'\1' + cards_html + r'\3', html)

# Update Footer Links
footer_courses = """
                    <ul class="space-y-3">
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">AutoCAD 2D & 3D</a></li>
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">SolidWorks</a></li>
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">Revit (BIM)</a></li>
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">SketchUp & Lumion</a></li>
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">Creo & CATIA</a></li>
                        <li><a href="#" class="text-on-surface-variant hover:text-primary transition-colors">STAAD.Pro & Etabs</a></li>
                    </ul>"""

footer_pattern = re.compile(r'(<h4 class="font-headline-md font-bold text-on-surface text-lg mb-6">Courses</h4>).*?(</ul>)', re.DOTALL)
html = footer_pattern.sub(r'\1\n' + footer_courses, html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Injected 12 courses.")
