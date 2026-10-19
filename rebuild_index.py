import os
import re

target_dir = os.path.dirname(os.path.abspath(__file__))
index_path = os.path.join(target_dir, "index.html")

scratch_dir = r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152\scratch"
with open(os.path.join(scratch_dir, "head_block.txt"), 'r', encoding='utf-8') as f:
    head_content = f.read()

with open(os.path.join(scratch_dir, "waves_block.txt"), 'r', encoding='utf-8') as f:
    waves_script = f.read()

try:
    with open(os.path.join(scratch_dir, "animations_block.txt"), 'r', encoding='utf-8') as f:
        animations_script = f.read()
except FileNotFoundError:
    animations_script = ""

# I also need the FAQs HTML from the original file.
with open(index_path, 'r', encoding='utf-8') as f:
    original_html = f.read()

faq_pattern = re.search(r'(<!-- FAQs Section.*?</div>\s*</div>\s*</div>)', original_html, re.DOTALL)
faqs_html = faq_pattern.group(1) if faq_pattern else ""

# Replace the specific "md:col-span-12 mt-xl" in faqs_html to make it fit anywhere
faqs_html = faqs_html.replace('col-span-4 md:col-span-12 mt-xl', 'w-full')

new_html = f"""<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
{head_content}
<body class="bg-background antialiased text-on-surface blueprint-grid min-h-screen relative z-0">

    <!-- 1. Sticky Navigation -->
    <nav class="fixed top-0 left-0 right-0 z-[100] bg-surface/80 backdrop-blur-md border-b border-outline/20 transition-all duration-300">
        <div class="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-3 group">
                <img src="assets/images/logo.png" alt="Cube Cad Center Logo" class="h-10 w-10 object-contain rounded-full shadow-sm transition-transform group-hover:scale-105">
                <span class="font-headline-md text-lg font-bold text-on-surface tracking-tight">Cube Cad Center</span>
            </a>
            
            <!-- Desktop Menu -->
            <div class="hidden md:flex items-center gap-8">
                <a href="#hero" class="font-button text-sm font-semibold text-on-surface hover:text-primary transition-colors">Home</a>
                <a href="#courses" class="font-button text-sm font-semibold text-on-surface hover:text-primary transition-colors">Courses</a>
                <a href="#about" class="font-button text-sm font-semibold text-on-surface hover:text-primary transition-colors">About Us</a>
                <a href="#why-choose-us" class="font-button text-sm font-semibold text-on-surface hover:text-primary transition-colors">Why Choose Us</a>
                <a href="#faq" class="font-button text-sm font-semibold text-on-surface hover:text-primary transition-colors">FAQ</a>
                <a href="#courses" class="btn-primary text-sm px-6 py-2">Explore Courses →</a>
            </div>

            <!-- Mobile Hamburger -->
            <button class="md:hidden text-on-surface" id="mobile-menu-btn">
                <span class="material-symbols-outlined text-3xl">menu</span>
            </button>
        </div>
        <!-- Mobile Menu Dropdown -->
        <div id="mobile-menu" class="hidden md:hidden absolute top-20 left-0 w-full bg-surface border-b border-outline/20 flex-col items-center py-6 gap-6 shadow-xl">
            <a href="#hero" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">Home</a>
            <a href="#courses" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">Courses</a>
            <a href="#about" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">About Us</a>
            <a href="#why-choose-us" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">Why Choose Us</a>
            <a href="#faq" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">FAQ</a>
            <a href="#contact" class="font-headline-md text-lg text-on-surface hover:text-primary transition-colors mobile-link">Contact</a>
        </div>
    </nav>

    <!-- 2. Hero Section -->
    <section id="hero" class="relative min-h-[90vh] flex flex-col items-center justify-center px-6 md:px-12 lg:px-24 pt-32 pb-20 z-20 overflow-hidden bg-background">
        <!-- Interactive Waves Background (injected by script below) -->
        <canvas id="waves-canvas" class="absolute inset-0 w-full h-full z-0 opacity-40" style="pointer-events: auto;"></canvas>
        
        <!-- Abstract Glowing Orbs -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] animate-pulse"></div>
            <div class="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#ff8c42]/10 rounded-full blur-[120px] animate-pulse" style="animation-delay: 2s;"></div>
        </div>

        <div class="relative z-10 w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <!-- Left: Typography -->
            <div class="flex-1 flex flex-col items-start text-left gap-8 hero-content">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface/50 border border-outline/30 backdrop-blur-md shadow-sm hero-badge">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    <span class="text-sm font-semibold text-primary tracking-wide uppercase">Admissions Open 2026</span>
                </div>

                <h1 class="font-headline-xl text-5xl md:text-[64px] lg:text-[72px] leading-[1.1] font-extrabold tracking-tight hero-title text-on-surface">
                    Master Industry-Ready <br class="hidden md:block"/> 
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#ff8c42]">CAD & BIM</span> Skills
                </h1>
                
                <p class="font-body-lg text-lg md:text-xl text-on-surface-variant max-w-xl hero-subtitle leading-relaxed">
                    Learn industry-standard engineering, architecture, and design software through practical training designed to help you build real-world skills and advance your career.
                </p>
                
                <div class="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto">
                    <a href="#courses" class="btn-primary w-full sm:w-auto px-8 py-4 text-base flex items-center justify-center gap-2 group">
                        Explore Courses <span class="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </a>
                    <a href="#about" class="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-white/50 border border-outline/30 backdrop-blur-sm text-on-surface transition-all duration-300 hover:bg-white/80 hover:border-outline/50 w-full sm:w-auto">
                        <span class="font-button text-button font-semibold">View Our Programs</span>
                    </a>
                </div>
            </div>
            
            <!-- Right: Technical Visual -->
            <div class="flex-1 w-full relative group">
                <div class="absolute -inset-4 bg-gradient-to-r from-primary/20 to-transparent blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <img src="assets/images/architectural_render.jpg" alt="High-tech 3D Architectural Render" class="w-full h-auto object-cover rounded-2xl border border-outline/20 shadow-2xl relative z-10 transition-transform duration-700 hover:scale-[1.02]">
                
                <!-- Floating Elements -->
                <div class="absolute -top-6 -right-6 bg-surface/80 backdrop-blur-md border border-outline/20 p-3 rounded-lg shadow-lg z-20 animate-bounce" style="animation-duration: 3s;">
                    <span class="font-mono text-xs text-primary font-bold">X: 104.5 | Y: 89.2</span>
                </div>
                <div class="absolute -bottom-6 -left-6 bg-surface/80 backdrop-blur-md border border-outline/20 p-3 rounded-lg shadow-lg z-20 animate-bounce" style="animation-duration: 4s; animation-delay: 1s;">
                    <span class="font-mono text-xs text-primary font-bold">Z-AXIS ALIGNED</span>
                </div>
            </div>
        </div>
    </section>

    <!-- 3. Trust / Statistics Section -->
    <section class="relative z-30 -mt-12 max-w-6xl mx-auto px-6">
        <div class="surface-card p-8 md:p-12 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-outline/10 text-center">
            <div class="flex flex-col items-center">
                <span class="text-4xl md:text-5xl font-extrabold text-primary mb-2">5000+</span>
                <span class="font-label-caps text-sm text-on-surface-variant uppercase tracking-widest">Students Trained</span>
            </div>
            <div class="flex flex-col items-center">
                <span class="text-4xl md:text-5xl font-extrabold text-primary mb-2">10+</span>
                <span class="font-label-caps text-sm text-on-surface-variant uppercase tracking-widest">Industry Programs</span>
            </div>
            <div class="flex flex-col items-center">
                <span class="text-4xl md:text-5xl font-extrabold text-primary mb-2">10+</span>
                <span class="font-label-caps text-sm text-on-surface-variant uppercase tracking-widest">Years Experience</span>
            </div>
            <div class="flex flex-col items-center">
                <span class="text-4xl md:text-5xl font-extrabold text-primary mb-2">90%+</span>
                <span class="font-label-caps text-sm text-on-surface-variant uppercase tracking-widest">Practical Learning</span>
            </div>
        </div>
    </section>

    <!-- 4. Courses Section -->
    <section id="courses" class="py-24 md:py-32 max-w-7xl mx-auto px-6">
        <div class="text-center mb-16 max-w-3xl mx-auto">
            <div class="chip mb-4">OUR PROGRAMS</div>
            <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-6 font-bold">Industry-Focused Courses</h2>
            <p class="font-body-lg text-lg text-on-surface-variant">Build practical skills using the tools and technologies used across engineering, architecture, construction, and design industries.</p>
        </div>

        <!-- Filter -->
        <div class="flex flex-wrap justify-center gap-3 mb-12">
            <button class="px-6 py-2 rounded-full bg-on-surface text-surface font-semibold text-sm transition-all hover:scale-105">All</button>
            <button class="px-6 py-2 rounded-full bg-surface-variant text-on-surface font-semibold text-sm hover:bg-outline/20 transition-all hover:scale-105">Architecture</button>
            <button class="px-6 py-2 rounded-full bg-surface-variant text-on-surface font-semibold text-sm hover:bg-outline/20 transition-all hover:scale-105">Mechanical</button>
            <button class="px-6 py-2 rounded-full bg-surface-variant text-on-surface font-semibold text-sm hover:bg-outline/20 transition-all hover:scale-105">MEP</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <!-- Course Card 1 -->
            <div class="surface-card flex flex-col rounded-2xl overflow-hidden group cursor-pointer">
                <div class="h-48 overflow-hidden relative">
                    <img src="assets/images/architectural_render.jpg" alt="AutoCAD" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute top-4 right-4 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-primary">Beginner &rarr; Intermediate</div>
                </div>
                <div class="p-8 flex-grow flex flex-col">
                    <div class="flex items-center gap-2 mb-3 text-on-surface-variant">
                        <span class="material-symbols-outlined text-sm">schedule</span>
                        <span class="text-sm font-semibold">Duration: 2 Months</span>
                    </div>
                    <h3 class="text-2xl font-bold text-on-surface mb-2">AutoCAD</h3>
                    <p class="text-on-surface-variant mb-6 text-sm">2D Drafting & Technical Drawing</p>
                    <div class="mb-8">
                        <p class="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">You will learn:</p>
                        <ul class="text-sm text-on-surface-variant space-y-2">
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> 2D Drafting</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> Technical Drawings</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> Layer Management</li>
                        </ul>
                    </div>
                    <div class="mt-auto">
                        <a href="syllabus-architectural.html" class="w-full py-3 rounded-lg border border-primary text-primary font-semibold flex items-center justify-center gap-2 transition-all group-hover:bg-primary group-hover:text-white">Explore Course <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
                    </div>
                </div>
            </div>

            <!-- Course Card 2 -->
            <div class="surface-card flex flex-col rounded-2xl overflow-hidden group cursor-pointer">
                <div class="h-48 overflow-hidden relative">
                    <img src="assets/images/hvac_render.jpg" alt="SolidWorks" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute top-4 right-4 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-primary">Intermediate &rarr; Advanced</div>
                </div>
                <div class="p-8 flex-grow flex flex-col">
                    <div class="flex items-center gap-2 mb-3 text-on-surface-variant">
                        <span class="material-symbols-outlined text-sm">schedule</span>
                        <span class="text-sm font-semibold">Duration: 3 Months</span>
                    </div>
                    <h3 class="text-2xl font-bold text-on-surface mb-2">SolidWorks</h3>
                    <p class="text-on-surface-variant mb-6 text-sm">Advanced 3D Mechanical Design</p>
                    <div class="mb-8">
                        <p class="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">You will learn:</p>
                        <ul class="text-sm text-on-surface-variant space-y-2">
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> 3D Modeling</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> Assembly Design</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> Sheet Metal & Weldments</li>
                        </ul>
                    </div>
                    <div class="mt-auto">
                        <a href="syllabus-mechanical.html" class="w-full py-3 rounded-lg border border-primary text-primary font-semibold flex items-center justify-center gap-2 transition-all group-hover:bg-primary group-hover:text-white">Explore Course <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
                    </div>
                </div>
            </div>

            <!-- Course Card 3 -->
            <div class="surface-card flex flex-col rounded-2xl overflow-hidden group cursor-pointer">
                <div class="h-48 overflow-hidden relative">
                    <img src="assets/images/drafting_tools.jpg" alt="Revit MEP" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute top-4 right-4 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-primary">All Levels</div>
                </div>
                <div class="p-8 flex-grow flex flex-col">
                    <div class="flex items-center gap-2 mb-3 text-on-surface-variant">
                        <span class="material-symbols-outlined text-sm">schedule</span>
                        <span class="text-sm font-semibold">Duration: 2.5 Months</span>
                    </div>
                    <h3 class="text-2xl font-bold text-on-surface mb-2">Revit MEP</h3>
                    <p class="text-on-surface-variant mb-6 text-sm">Plumbing & Electrical BIM</p>
                    <div class="mb-8">
                        <p class="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">You will learn:</p>
                        <ul class="text-sm text-on-surface-variant space-y-2">
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> HVAC Systems</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> Electrical Layouts</li>
                            <li class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[16px]">check_circle</span> BIM Collaboration</li>
                        </ul>
                    </div>
                    <div class="mt-auto">
                        <a href="syllabus-mep.html" class="w-full py-3 rounded-lg border border-primary text-primary font-semibold flex items-center justify-center gap-2 transition-all group-hover:bg-primary group-hover:text-white">Explore Course <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 5. Why Choose Us -->
    <section id="why-choose-us" class="py-24 bg-surface-variant/30 border-y border-outline/10">
        <div class="max-w-7xl mx-auto px-6">
            <div class="text-center mb-16 max-w-3xl mx-auto">
                <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-6 font-bold">Why Choose Cube Cad Center</h2>
                <p class="font-body-lg text-lg text-on-surface-variant">We don't just teach software. We build industry-ready professionals through hands-on methodology.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Benefit 1 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">build</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Practical Learning</h3>
                    <p class="text-on-surface-variant leading-relaxed">Focus on real-world projects rather than only theoretical instruction. Apply commands to actual architectural and mechanical challenges.</p>
                </div>
                <!-- Benefit 2 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">precision_manufacturing</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Industry-Relevant Skills</h3>
                    <p class="text-on-surface-variant leading-relaxed">Learn the exact tools, plugins, and workflows used in professional engineering and design environments worldwide.</p>
                </div>
                <!-- Benefit 3 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">school</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Experienced Trainers</h3>
                    <p class="text-on-surface-variant leading-relaxed">Learn directly from instructors with practical industry knowledge and years of hands-on technical design experience.</p>
                </div>
                <!-- Benefit 4 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">architecture</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Project-Based Training</h3>
                    <p class="text-on-surface-variant leading-relaxed">Develop a robust portfolio through realistic projects that you can showcase to future employers during interviews.</p>
                </div>
                <!-- Benefit 5 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">work</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Career Support</h3>
                    <p class="text-on-surface-variant leading-relaxed">We help students understand how to apply their skills professionally and assist with placement opportunities.</p>
                </div>
                <!-- Benefit 6 -->
                <div class="surface-card p-8 rounded-2xl group">
                    <div class="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">verified</span>
                    </div>
                    <h3 class="text-xl font-bold text-on-surface mb-3">Certification</h3>
                    <p class="text-on-surface-variant leading-relaxed">Earn industry-recognized certificates that validate your technical software proficiency to global organizations.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- 6. How It Works Section -->
    <section class="py-24 max-w-7xl mx-auto px-6">
        <div class="text-center mb-16 max-w-3xl mx-auto">
            <div class="chip mb-4">THE PROCESS</div>
            <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-6 font-bold">Your Path to Mastery</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <!-- Connecting Line (Desktop) -->
            <div class="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-outline/20 z-0"></div>
            
            <!-- Step 1 -->
            <div class="relative z-10 flex flex-col items-center text-center group">
                <div class="w-24 h-24 rounded-full bg-surface border-4 border-surface-variant flex items-center justify-center mb-6 text-2xl font-bold text-primary group-hover:border-primary transition-colors shadow-lg">01</div>
                <h3 class="text-xl font-bold text-on-surface mb-2">Choose Your Course</h3>
                <p class="text-on-surface-variant text-sm">Select a program based on your specific career goals in engineering or design.</p>
            </div>
            <!-- Step 2 -->
            <div class="relative z-10 flex flex-col items-center text-center group">
                <div class="w-24 h-24 rounded-full bg-surface border-4 border-surface-variant flex items-center justify-center mb-6 text-2xl font-bold text-primary group-hover:border-primary transition-colors shadow-lg">02</div>
                <h3 class="text-xl font-bold text-on-surface mb-2">Learn the Software</h3>
                <p class="text-on-surface-variant text-sm">Develop practical software skills with guided, step-by-step expert instruction.</p>
            </div>
            <!-- Step 3 -->
            <div class="relative z-10 flex flex-col items-center text-center group">
                <div class="w-24 h-24 rounded-full bg-surface border-4 border-surface-variant flex items-center justify-center mb-6 text-2xl font-bold text-primary group-hover:border-primary transition-colors shadow-lg">03</div>
                <h3 class="text-xl font-bold text-on-surface mb-2">Build Real Projects</h3>
                <p class="text-on-surface-variant text-sm">Apply your newly acquired knowledge by modeling and drafting realistic scenarios.</p>
            </div>
            <!-- Step 4 -->
            <div class="relative z-10 flex flex-col items-center text-center group">
                <div class="w-24 h-24 rounded-full bg-surface border-4 border-surface-variant flex items-center justify-center mb-6 text-2xl font-bold text-primary group-hover:border-primary transition-colors shadow-lg">04</div>
                <h3 class="text-xl font-bold text-on-surface mb-2">Grow Your Career</h3>
                <p class="text-on-surface-variant text-sm">Use your skills and polished portfolio to unlock professional job opportunities.</p>
            </div>
        </div>
    </section>

    <!-- 7. Project Showcase -->
    <section class="py-24 bg-on-surface text-surface">
        <div class="max-w-7xl mx-auto px-6">
            <div class="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                <div class="max-w-2xl">
                    <h2 class="font-headline-xl text-4xl md:text-5xl mb-6 font-bold">Learn by Building Real Projects</h2>
                    <p class="text-surface-variant text-lg">Don't just memorize menus. You will create production-ready deliverables that prove your capability.</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Project 1 -->
                <div class="group relative overflow-hidden rounded-xl h-80 cursor-pointer">
                    <img src="assets/images/architectural_render.jpg" alt="Architectural Drawing" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 p-6">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-1 block">Revit Architecture</span>
                        <h3 class="text-2xl font-bold">Commercial Tower BIM</h3>
                    </div>
                </div>
                <!-- Project 2 -->
                <div class="group relative overflow-hidden rounded-xl h-80 cursor-pointer">
                    <img src="assets/images/hvac_render.jpg" alt="Mechanical Component" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 p-6">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-1 block">SolidWorks</span>
                        <h3 class="text-2xl font-bold">Industrial HVAC System</h3>
                    </div>
                </div>
                <!-- Project 3 -->
                <div class="group relative overflow-hidden rounded-xl h-80 cursor-pointer">
                    <img src="assets/images/drafting_tools.jpg" alt="Drafting" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 p-6">
                        <span class="text-primary font-bold text-xs uppercase tracking-widest mb-1 block">AutoCAD</span>
                        <h3 class="text-2xl font-bold">Structural Floorplan</h3>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 8. About Us Section -->
    <section id="about" class="py-24 max-w-7xl mx-auto px-6 overflow-hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div class="relative group">
                <div class="absolute inset-0 architectural-grid opacity-20 -z-10 translate-x-4 translate-y-4 rounded-2xl"></div>
                <img class="w-full h-auto object-cover rounded-2xl border border-outline/20 shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]" src="assets/images/architectural_render.jpg" alt="Cube Cad Center Campus">
            </div>
            <div>
                <div class="chip mb-6">OUR STORY</div>
                <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-8 font-bold leading-tight">Building the Architects, Engineers & Designers of Tomorrow.</h2>
                <div class="space-y-6 border-l-4 border-primary pl-6">
                    <p class="font-body-lg text-lg text-on-surface-variant">
                        We are Ahmedabad's leading authorized CAD training institute. Our mission is to elevate careers through precision, structure, and mastery of industry-standard software.
                    </p>
                    <p class="text-base text-on-surface-variant leading-relaxed">
                        We bridge the gap between academic theory and industry practice. We provide rigorous, hands-on training that transforms students into highly sought-after professionals capable of executing complex technical designs with absolute precision. Our modern software training and real-world projects prepare you directly for the workforce.
                    </p>
                </div>
                <a href="#contact" class="btn-primary mt-8 inline-flex items-center gap-2">Learn More About Us <span class="material-symbols-outlined text-sm">arrow_forward</span></a>
            </div>
        </div>
    </section>

    <!-- 9. Career / Skills Section -->
    <section class="py-24 bg-primary text-white">
        <div class="max-w-4xl mx-auto px-6 text-center">
            <h2 class="text-4xl md:text-5xl font-bold mb-8">Turn Software Skills Into Career-Ready Skills</h2>
            <p class="text-xl opacity-90 leading-relaxed mb-12">
                Knowing how to use a tool isn't enough. We teach you industry workflows, project portfolio development, and professional methodologies so you step into interviews with absolute confidence.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div class="bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/20">
                    <span class="material-symbols-outlined text-3xl mb-4">design_services</span>
                    <h4 class="text-xl font-bold mb-2">Practical Knowledge</h4>
                    <p class="text-sm opacity-80">Transition from basic theory to applied engineering design.</p>
                </div>
                <div class="bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/20">
                    <span class="material-symbols-outlined text-3xl mb-4">folder_special</span>
                    <h4 class="text-xl font-bold mb-2">Portfolio Building</h4>
                    <p class="text-sm opacity-80">Graduate with tangible assets to prove your software competency.</p>
                </div>
                <div class="bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/20">
                    <span class="material-symbols-outlined text-3xl mb-4">psychology</span>
                    <h4 class="text-xl font-bold mb-2">Workflow Mastery</h4>
                    <p class="text-sm opacity-80">Understand how large firms manage massive CAD assemblies.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- 10. Testimonials Placeholder -->
    <section class="py-24 max-w-7xl mx-auto px-6 bg-surface-variant/20 rounded-3xl mt-24">
        <div class="text-center mb-16">
            <h2 class="text-4xl md:text-5xl font-bold text-on-surface mb-4">Trusted by Professionals</h2>
            <p class="text-lg text-on-surface-variant">Hear what our alumni have to say about their training experience.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Testimonial 1 -->
            <div class="surface-card p-8 rounded-2xl">
                <div class="flex items-center gap-2 text-primary mb-4">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                </div>
                <p class="text-on-surface-variant mb-6 italic">"The project-based approach at Cube Cad Center completely transformed my understanding of Revit. I felt incredibly prepared for my first architectural firm interview."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">Revit Architecture</p>
                    </div>
                </div>
            </div>
            <!-- Testimonial 2 -->
            <div class="surface-card p-8 rounded-2xl">
                <div class="flex items-center gap-2 text-primary mb-4">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                </div>
                <p class="text-on-surface-variant mb-6 italic">"Excellent instructors with real industry experience. The SolidWorks training covered advanced assemblies that I now use every day in my mechanical design job."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">SolidWorks Masterclass</p>
                    </div>
                </div>
            </div>
            <!-- Testimonial 3 -->
            <div class="surface-card p-8 rounded-2xl">
                <div class="flex items-center gap-2 text-primary mb-4">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">star</span>
                </div>
                <p class="text-on-surface-variant mb-6 italic">"A highly professional environment. The placement assistance helped me land a great role immediately after completing my AutoCAD certification."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">AutoCAD 2D & 3D</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 11. FAQ Section -->
    <section id="faq" class="py-24 max-w-4xl mx-auto px-6">
        {faqs_html}
    </section>

    <!-- 12. Final CTA -->
    <section class="py-24 max-w-7xl mx-auto px-6 mb-12">
        <div class="bg-on-surface rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
            <!-- Grid overlay -->
            <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            
            <div class="relative z-10 max-w-3xl mx-auto">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">Ready to Build Your Future With CAD & BIM?</h2>
                <p class="text-xl text-surface-variant opacity-90 mb-10">Choose a course, develop practical skills, and take the next step toward your engineering or design career today.</p>
                
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="#courses" class="btn-primary text-lg px-10 py-5 flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                        Explore All Courses <span class="material-symbols-outlined">arrow_forward</span>
                    </a>
                    <a href="#contact" class="px-10 py-5 rounded-full border border-white/30 text-white font-bold hover:bg-white hover:text-black transition-colors flex items-center justify-center">
                        Contact Us
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- 13. Footer Redesign -->
    <footer id="contact" class="bg-surface-variant/50 border-t border-outline/20 pt-20 pb-10">
        <div class="max-w-7xl mx-auto px-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                
                <!-- Column 1: Brand -->
                <div>
                    <a href="#" class="flex items-center gap-3 mb-6">
                        <img src="assets/images/logo.png" alt="Cube Cad Center" class="h-12 w-12 object-contain rounded-full shadow-sm">
                        <span class="font-bold text-xl text-on-surface">Cube Cad Center</span>
                    </a>
                    <p class="text-on-surface-variant text-sm leading-relaxed">
                        Ahmedabad's premier CAD & BIM training institute. We bridge the gap between academic theory and professional industry practice.
                    </p>
                </div>

                <!-- Column 2: Courses -->
                <div>
                    <h4 class="font-bold text-on-surface mb-6 uppercase tracking-wider text-sm">Courses</h4>
                    <ul class="space-y-4 text-sm text-on-surface-variant">
                        <li><a href="#" class="hover:text-primary transition-colors">AutoCAD 2D & 3D</a></li>
                        <li><a href="#" class="hover:text-primary transition-colors">SolidWorks Masterclass</a></li>
                        <li><a href="#" class="hover:text-primary transition-colors">STAAD.Pro</a></li>
                        <li><a href="#" class="hover:text-primary transition-colors">Revit MEP / Plumbing</a></li>
                        <li><a href="#" class="hover:text-primary transition-colors">Mechanical Design</a></li>
                    </ul>
                </div>

                <!-- Column 3: Company -->
                <div>
                    <h4 class="font-bold text-on-surface mb-6 uppercase tracking-wider text-sm">Company</h4>
                    <ul class="space-y-4 text-sm text-on-surface-variant">
                        <li><a href="#about" class="hover:text-primary transition-colors">About Us</a></li>
                        <li><a href="#why-choose-us" class="hover:text-primary transition-colors">Why Choose Us</a></li>
                        <li><a href="#" class="hover:text-primary transition-colors">Student Projects</a></li>
                        <li><a href="#faq" class="hover:text-primary transition-colors">FAQ</a></li>
                        <li><a href="#contact" class="hover:text-primary transition-colors">Contact</a></li>
                    </ul>
                </div>

                <!-- Column 4: Contact -->
                <div>
                    <h4 class="font-bold text-on-surface mb-6 uppercase tracking-wider text-sm">Contact Us</h4>
                    <ul class="space-y-4 text-sm text-on-surface-variant">
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-[18px] text-primary mt-0.5">location_on</span>
                            <div>
                                <strong class="block text-on-surface">Satellite (HQ):</strong>
                                310, Iscon Emporio, Near Jodhpur Cross Road
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-[18px] text-primary mt-0.5">location_on</span>
                            <div>
                                <strong class="block text-on-surface">South Bopal:</strong>
                                C449, 4th Floor, SoBo Center
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-[18px] text-primary mt-0.5">call</span>
                            <div class="flex flex-col gap-1.5">
                                <a href="tel:+919978999694" class="hover:text-primary transition-colors font-medium">+91 9978999694</a>
                                <a href="tel:+919909996285" class="hover:text-primary transition-colors font-medium">+91 9909996285</a>
                                <a href="tel:+919909997285" class="hover:text-primary transition-colors font-medium">+91 9909997285</a>
                            </div>
                        </li>
                        <li class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-[18px] text-primary">email</span>
                            <a href="mailto:info@cubecadcenter.co" class="hover:text-primary transition-colors">info@cubecadcenter.co</a>
                        </li>
                    </ul>
                </div>

            </div>

            <div class="border-t border-outline/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <p class="text-sm text-on-surface-variant">&copy; 2026 Cube Cad Center. All rights reserved.</p>
                <div class="flex gap-4 text-on-surface-variant">
                    <a href="#" class="hover:text-primary transition-colors"><span class="material-symbols-outlined">link</span></a>
                    <a href="#" class="hover:text-primary transition-colors"><span class="material-symbols-outlined">share</span></a>
                </div>
            </div>
        </div>
    </footer>

    <!-- Scripts -->
    <script>
        // Mobile Menu Logic
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        mobileBtn.addEventListener('click', () => {{
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
        }});

        // Close menu on link click
        document.querySelectorAll('.mobile-link').forEach(link => {{
            link.addEventListener('click', () => {{
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('flex');
            }});
        }});
        
        // Setup FAQ accordion toggling
        document.addEventListener('DOMContentLoaded', () => {{
            const accordionTriggers = document.querySelectorAll('.accordion-trigger');
            accordionTriggers.forEach(trigger => {{
                trigger.addEventListener('click', () => {{
                    const content = trigger.nextElementSibling;
                    const icon = trigger.querySelector('.accordion-icon');
                    const isExpanded = content.classList.contains('h-auto');
                    
                    document.querySelectorAll('.accordion-content').forEach(c => {{
                        c.classList.remove('h-auto');
                        c.style.height = '0px';
                    }});
                    document.querySelectorAll('.accordion-icon').forEach(i => i.style.transform = 'rotate(0deg)');
                    
                    if (!isExpanded) {{
                        content.classList.add('h-auto');
                        content.style.height = content.scrollHeight + 'px';
                        if (icon) icon.style.transform = 'rotate(180deg)';
                    }}
                }});
            }});
        }});
    </script>
    <script>
{waves_script}
    </script>
    <script>
{animations_script}
    </script>
</body>
</html>
"""

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Redesign applied successfully.")
