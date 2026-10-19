import os

template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>{title} - Cube Cad Center</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
    
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    
    <script id="tailwind-config">
  tailwind.config = {{
    darkMode: "class",
    theme: {{
      extend: {{
        "colors": {{
                "on-secondary-container": "#636263",
                "secondary-fixed-dim": "#c8c6c7",
                "surface-tint": "#9a4600",
                "inverse-on-surface": "#f0f0f2",
                "primary-fixed": "#ffdbc9",
                "outline": "#8c7263",
                "on-primary-fixed-variant": "#753400",
                "surface": "#f9f9fb",
                "background": "#f9f9fb",
                "surface-container-highest": "#e2e2e4",
                "secondary": "#5f5e5f",
                "surface-dim": "#d9dadc",
                "on-tertiary-container": "#363637",
                "surface-variant": "#e2e2e4",
                "tertiary": "#5e5e5f",
                "on-tertiary-fixed": "#1b1c1c",
                "on-background": "#1a1c1d",
                "on-error-container": "#93000a",
                "on-tertiary-fixed-variant": "#474748",
                "on-error": "#ffffff",
                "on-surface-variant": "#584235",
                "tertiary-container": "#a09fa0",
                "on-surface": "#1a1c1d",
                "primary-container": "#ff7900",
                "on-primary-container": "#5c2700",
                "on-primary": "#ffffff",
                "on-primary-fixed": "#321200",
                "primary": "#9a4600",
                "on-secondary-fixed": "#1b1b1c",
                "surface-container-lowest": "#ffffff",
                "error": "#ba1a1a",
                "on-tertiary": "#ffffff",
                "surface-container-low": "#f3f3f5",
                "on-secondary": "#ffffff",
                "outline-variant": "#e0c0af",
                "surface-container": "#eeeef0",
                "inverse-primary": "#ffb68c",
                "error-container": "#ffdad6",
                "on-secondary-fixed-variant": "#474647",
                "primary-fixed-dim": "#ffb68c",
                "tertiary-fixed-dim": "#c8c6c7",
                "surface-container-high": "#e8e8ea",
                "tertiary-fixed": "#e4e2e3",
                "surface-bright": "#f9f9fb",
                "inverse-surface": "#2f3132",
                "secondary-fixed": "#e5e2e3",
                "secondary-container": "#e2dfe0"
        }},
        "borderRadius": {{
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
        }},
        "fontFamily": {{
                "headline-lg-mobile": ["Hanken Grotesk"],
                "body-sm": ["Inter"],
                "headline-md": ["Hanken Grotesk"],
                "button": ["Hanken Grotesk"],
                "headline-xl": ["Hanken Grotesk"],
                "body-lg": ["Inter"],
                "body-md": ["Inter"],
                "label-caps": ["JetBrains Mono"],
                "headline-lg": ["Hanken Grotesk"],
                "nav-label-sm": ["Inter", "sans-serif"],
                "nav-label": ["Inter", "sans-serif"],
                "body": ["Inter", "sans-serif"],
                "subtext-sm": ["Inter", "sans-serif"],
                "subtext-cta": ["Inter", "sans-serif"]
        }}
      }}
    }}
  }}
    </script>
    
    <style type="text/tailwindcss">
        @layer utilities {{
            .blueprint-grid {{
                background-image: 
                    linear-gradient(to right, theme('colors.surface-variant') 1px, transparent 1px),
                    linear-gradient(to bottom, theme('colors.surface-variant') 1px, transparent 1px);
                background-size: 24px 24px;
            }}
        }}
    </style>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        body {{
            background-color: #F5F5F7;
            color: #1a1c1d;
            font-family: 'Inter', sans-serif;
            scroll-behavior: smooth;
        }}

        .surface-card {{
            background-color: #FFFFFF;
            border: 1px solid #E2E2E5;
        }}
    </style>
</head>
<body class="bg-background antialiased text-on-surface flex flex-col min-h-screen">
    
    <!-- Top Navigation -->
    <header class="w-full bg-surface/90 backdrop-blur-md border-b border-outline/20 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-6 md:px-12 py-4 flex justify-between items-center">
            <a href="index.html" class="flex items-center gap-3">
                <div class="font-headline-md text-xl font-bold text-on-surface tracking-tight">Cube Cad Center</div>
            </a>
            <a href="explore.html" class="font-button text-sm font-semibold text-primary hover:text-primary-container transition-colors flex items-center gap-1">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span> Back to Catalog
            </a>
        </div>
    </header>

    <main class="flex-grow">
        <!-- Hero Section -->
        <section class="bg-surface-container-highest py-20 px-6 md:px-12 blueprint-grid relative border-b border-outline/20">
            <div class="max-w-7xl mx-auto relative z-10">
                <span class="inline-block bg-primary text-on-primary font-label-caps text-xs px-3 py-1 mb-4 rounded-sm tracking-widest">{badge}</span>
                <h1 class="font-headline-xl text-5xl md:text-6xl font-extrabold text-on-surface mb-6">{title}</h1>
                <p class="font-body-lg text-lg text-on-surface-variant max-w-2xl">{subtitle}</p>
            </div>
        </section>

        <!-- Course Content -->
        <section class="max-w-7xl mx-auto px-6 md:px-12 py-16">
            <div class="surface-card p-8 md:p-12 border-t-4 border-t-primary">
                {content}
            </div>
        </section>
    </main>

    <footer class="bg-surface dark:bg-surface-dim w-full py-16 bg-surface-container-low dark:bg-surface-container-lowest mt-auto border-t border-E2E2E5">
        <div class="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div class="col-span-1 md:col-span-2">
                <div class="flex items-center gap-3 mb-6">
                    <div class="font-headline-md text-xl font-bold text-on-surface tracking-tight">Cube Cad Center</div>
                </div>
                <p class="text-on-surface-variant font-body-lg max-w-sm mb-6 leading-relaxed">Gujarat's leading authorized CAD training institute.</p>
            </div>
            <div>
                <h4 class="font-label-caps text-xs font-semibold text-on-surface mb-4 tracking-widest uppercase">Quick Links</h4>
                <ul class="flex flex-col gap-3">
                    <li><a href="explore.html" class="text-on-surface-variant hover:text-primary font-body-md transition-colors">Courses &amp; Syllabus</a></li>
                    <li><a href="index.html#about" class="text-on-surface-variant hover:text-primary font-body-md transition-colors">Our Story</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-label-caps text-xs font-semibold text-on-surface mb-4 tracking-widest uppercase">Contact</h4>
                <ul class="flex flex-col gap-2">
                    <li class="text-on-surface-variant font-body-sm font-semibold text-on-surface">Satellite (HQ):</li>
                    <li class="text-on-surface-variant font-body-sm">310, Iscon Emporio, Near Jodhpur Cross Road</li>
                    <li class="text-on-surface-variant font-body-sm font-semibold text-on-surface mt-2">South Bopal:</li>
                    <li class="text-on-surface-variant font-body-sm">C449, 4th Floor, SoBo Center</li>
                    <li class="text-on-surface-variant font-body-sm mt-3"><a href="tel:+919978999694" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">call</span> +91 9978999694</a></li>
                    <li class="text-on-surface-variant font-body-sm"><a href="tel:+919909996285" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">call</span> +91 9909996285</a></li>
                    <li class="text-on-surface-variant font-body-sm"><a href="tel:+919909997285" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">call</span> +91 9909997285</a></li>
                    <li class="text-on-surface-variant font-body-sm mt-1"><a href="mailto:info@cubecadcenter.co" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">email</span> info@cubecadcenter.co</a></li>
                </ul>
            </div>
        </div>
    </footer>
</body>
</html>"""

pages = {
    "syllabus-architectural.html": {
        "title": "Architectural Design",
        "badge": "COURSE SYLLABUS",
        "subtitle": "Master the art and science of architectural drafting and 3D modeling. Learn to translate conceptual designs into precise, construction-ready blueprints and immersive BIM models.",
        "content": """
        <div class="flex items-center gap-3 mb-8">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">architecture</span>
            <h2 class="font-headline-lg text-4xl text-on-surface font-bold">AutoCAD • Revit • SketchUp</h2>
        </div>
        
        <div class="space-y-12">
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 1: 2D Drafting with AutoCAD</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Introduction to AutoCAD Interface and Navigation</li>
                    <li>Drawing and Editing Commands for Floor Plans</li>
                    <li>Layer Management and Properties</li>
                    <li>Dimensioning, Text, and Hatching</li>
                    <li>Creating and Using Blocks</li>
                    <li>Plotting and Layouts for Professional Output</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 2: 3D Conceptual Modeling with SketchUp</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Push/Pull Mechanics and 3D Forms</li>
                    <li>Groups, Components, and the Outliner</li>
                    <li>Materials and Textures</li>
                    <li>Lighting, Shadows, and Scenes</li>
                    <li>V-Ray Integration for Photorealistic Rendering</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 3: Building Information Modeling with Revit</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Understanding BIM vs. CAD</li>
                    <li>Creating Walls, Doors, Windows, and Roofs</li>
                    <li>Families and Parametric Components</li>
                    <li>Generating Sections, Elevations, and Schedules</li>
                    <li>Collaboration and Worksharing</li>
                </ul>
            </div>
        </div>
        """
    },
    "syllabus-structural.html": {
        "title": "Structural Engineering",
        "badge": "COURSE SYLLABUS",
        "subtitle": "Advanced structural analysis and design. Learn to simulate loads, optimize material usage, and ensure strict compliance with international building codes.",
        "content": """
        <div class="flex items-center gap-3 mb-8">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">engineering</span>
            <h2 class="font-headline-lg text-4xl text-on-surface font-bold">STAAD.Pro • ETABS</h2>
        </div>
        
        <div class="space-y-12">
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 1: Fundamentals of Structural Analysis</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Understanding Static and Dynamic Loads</li>
                    <li>Material Properties and Yield Strength</li>
                    <li>Reading and Interpreting Structural Blueprints</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 2: Modeling and Analysis with STAAD.Pro</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Geometry Creation and Node/Element Generation</li>
                    <li>Applying Dead, Live, Wind, and Seismic Loads</li>
                    <li>Analyzing Steel and Concrete Structures</li>
                    <li>Post-Processing and Result Interpretation</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 3: High-Rise Design with ETABS</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Modeling Multi-Story Concrete and Steel Buildings</li>
                    <li>P-Delta Analysis and Modal Analysis</li>
                    <li>Shear Wall Design and Detailing</li>
                    <li>Generating Output Reports for Construction</li>
                </ul>
            </div>
        </div>
        """
    },
    "syllabus-mechanical.html": {
        "title": "Mechanical Design",
        "badge": "COURSE SYLLABUS",
        "subtitle": "Dive into parametric modeling, complex assembly design, and simulation. Tailored for manufacturing, product development, and heavy machinery industries.",
        "content": """
        <div class="flex items-center gap-3 mb-8">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">settings</span>
            <h2 class="font-headline-lg text-4xl text-on-surface font-bold">SolidWorks • CATIA • AutoCAD Mechanical</h2>
        </div>
        
        <div class="space-y-12">
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 1: Advanced 2D & Parametric Modeling</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Sketching Fundamentals and Geometric Constraints</li>
                    <li>Extrude, Revolve, Sweep, and Loft Features</li>
                    <li>Hole Wizard and Advanced Filleting Techniques</li>
                    <li>Geometric Dimensioning & Tolerancing (GD&T)</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 2: Complex Assemblies and Motion</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Top-Down vs Bottom-Up Assembly Design</li>
                    <li>Standard and Advanced Mates (Mechanical, Gear, Cam)</li>
                    <li>Interference and Clearance Detection</li>
                    <li>Exploded Views and Animations</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 3: Specialized Features (CATIA & SolidWorks)</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Sheet Metal Design and Flat Patterns</li>
                    <li>Weldments and Structural Members</li>
                    <li>Surface Modeling for Ergonomic Products</li>
                    <li>FEA Simulation Fundamentals</li>
                </ul>
            </div>
        </div>
        """
    },
    "syllabus-mep.html": {
        "title": "HVAC / MEP",
        "badge": "COURSE SYLLABUS",
        "subtitle": "Design and coordinate complex building systems. Ensure optimal performance, energy efficiency, and master clash detection using industry-leading BIM workflows.",
        "content": """
        <div class="flex items-center gap-3 mb-8">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">hvac</span>
            <h2 class="font-headline-lg text-4xl text-on-surface font-bold">Mechanical, Electrical, and Plumbing</h2>
        </div>
        
        <div class="space-y-12">
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 1: HVAC Design</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Heating and Cooling Load Calculations</li>
                    <li>Air Terminal Placement and Sizing</li>
                    <li>Ductwork Routing and Pressure Loss Analysis</li>
                    <li>Chiller and Boiler Plant Layouts</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 2: Electrical & Plumbing Systems</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Lighting Analysis and Fixture Layout</li>
                    <li>Power Distribution and Panel Schedules</li>
                    <li>Domestic Water and Sanitary Waste Routing</li>
                    <li>Fire Protection System Design</li>
                </ul>
            </div>
            
            <div>
                <h3 class="font-headline-md text-2xl text-on-surface mb-4 border-b border-outline/20 pb-2">Module 3: MEP Coordination and Clash Detection</h3>
                <ul class="list-disc pl-6 space-y-2 font-body-md text-on-surface-variant">
                    <li>Using Revit MEP for Centralized Modeling</li>
                    <li>Exporting to Navisworks</li>
                    <li>Running Clash Detective and Generating Reports</li>
                    <li>Resolving Interferences Between Disciplines</li>
                </ul>
            </div>
        </div>
        """
    }
}

target_dir = r"c:\Users\praja\Downloads\new\website"

for filename, data in pages.items():
    filepath = os.path.join(target_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(template.format(**data))

print("Created 4 pages.")
