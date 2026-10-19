import re
import os

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract preloader
preloader_match = re.search(r'<!-- Preloader -->.*?<div class="flex flex-col items-center gap-8 w-full max-w-xs px-6">.*?</div>\s*</div>\s*</div>', html, re.DOTALL)
preloader_html = preloader_match.group(0) if preloader_match else ""

# Extract global animation
canvas_match = re.search(r'<!-- Global Background Animation -->.*?<div class="fixed inset-0 w-full h-full pointer-events-none z-0 flex items-center justify-center" id="global-animation">.*?</div>', html, re.DOTALL)
canvas_html = canvas_match.group(0) if canvas_match else ""

# Extract GSAP tags
gsap_tags = """    <!-- GSAP for Smooth Animations -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>"""

# Extract the script block
# Since we only want to move the canvas animation part, we need to be careful.
# Wait, index.html might still need GSAP for basic scroll fade-ins?
# Yes, index.html uses gsap for `.hero-badge` and section fade ins!
# Actually, the user said "shift this animation". The GSAP basic fade-ins can stay or go.
# Let's extract the whole script block but leave a basic GSAP script for index.html.

script_match = re.search(r'<script>\s*// GSAP Animations.*?</script>', html, re.DOTALL)
full_script = script_match.group(0) if script_match else ""

# Now, we need to inject preloader_html and canvas_html into the target files right after <body>
target_files = ["explore.html", "syllabus-architectural.html", "syllabus-structural.html", "syllabus-mechanical.html", "syllabus-mep.html"]

for tf in target_files:
    tf_path = os.path.join(target_dir, tf)
    with open(tf_path, 'r', encoding='utf-8') as f:
        tf_html = f.read()
    
    # Inject GSAP Tags in <head>
    if "gsap.min.js" not in tf_html:
        tf_html = tf_html.replace('</head>', f'{gsap_tags}\n</head>')
    
    # Inject Preloader and Canvas right after <body ...>
    if 'id="preloader"' not in tf_html:
        tf_html = re.sub(r'(<body[^>]*>)', r'\1\n' + preloader_html + '\n' + canvas_html + '\n', tf_html, count=1)
        
    # Inject the script block before </body>
    if '// GSAP Animations' not in tf_html:
        # modify full_script slightly so the trigger is "body" instead of "#courses" for opacity, since these pages don't have "#courses"
        mod_script = full_script.replace('trigger: "#courses"', 'trigger: "main"')
        tf_html = tf_html.replace('</body>', f'{mod_script}\n</body>')
        
    with open(tf_path, 'w', encoding='utf-8') as f:
        f.write(tf_html)

# Now, remove them from index.html
new_index_html = html
new_index_html = new_index_html.replace(preloader_html, "")
new_index_html = new_index_html.replace(canvas_html, "")

# Remove the body overflow-hidden from index.html since preloader is gone
new_index_html = new_index_html.replace('class="bg-background antialiased text-on-surface overflow-hidden"', 'class="bg-background antialiased text-on-surface"')

# We will leave GSAP in index.html, but remove the Canvas Image Sequence Animation logic
script_to_keep = """<script>
        // GSAP Animations
        document.addEventListener('DOMContentLoaded', () => {
            const tl = gsap.timeline();
            // Hero Content Animations
            tl.from('.hero-badge', { opacity: 0, y: -20, duration: 0.6, ease: "power3.out", delay: 0.2 })
              .from('.hero-title', { opacity: 0, y: 30, duration: 0.8, ease: "power3.out" }, "-=0.4")
              .from('.hero-subtitle', { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, "-=0.6")
              .from('.hero-cta-group', { opacity: 0, scale: 0.95, duration: 0.5, ease: "back.out(1.7)" }, "-=0.4")
              .from('.hero-stats', { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, "-=0.3");

            // Scroll animations for sections
            gsap.utils.toArray('section').forEach(section => {
                gsap.from(section, {
                    scrollTrigger: {
                        trigger: section,
                        start: "top 80%"
                    },
                    opacity: 0,
                    y: 50,
                    duration: 0.8,
                    ease: "power3.out"
                });
            });
        });
    </script>"""

new_index_html = new_index_html.replace(full_script, script_to_keep)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(new_index_html)

print("Migration complete!")
