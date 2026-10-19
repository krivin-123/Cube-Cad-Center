import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Remove `cursor: none;` CSS block
cursor_css_pattern = re.compile(r'/\* Hide default cursor only if on desktop \*/\s*@media \(pointer: fine\) \{\s*body \{\s*cursor: none;\s*\}\s*a, button, input, textarea \{\s*cursor: none;\s*\}\s*\}', re.DOTALL)
html = cursor_css_pattern.sub('', html)

# 2. Fix the broken script tags at the bottom
html = html.replace("<script>\n<script>", "<script>")
html = html.replace("</script>\n    </script>", "</script>")

# 3. Inject the custom cursor JS logic before the closing body tag
custom_cursor_js = """
    <!-- Custom Cursor Animation -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (window.matchMedia("(pointer: fine)").matches) {
                // Ensure there is only one custom cursor
                if (!document.querySelector('.custom-cursor')) {
                    const cursor = document.createElement('div');
                    cursor.classList.add('custom-cursor');
                    document.body.appendChild(cursor);
                    
                    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
                    
                    let mouseX = window.innerWidth / 2;
                    let mouseY = window.innerHeight / 2;
                    
                    window.addEventListener('mousemove', (e) => {
                        mouseX = e.clientX;
                        mouseY = e.clientY;
                        gsap.to(cursor, { 
                            x: mouseX, 
                            y: mouseY, 
                            duration: 0.15, 
                            ease: "power2.out",
                            overwrite: "auto"
                        });
                    });
                    
                    const interactives = document.querySelectorAll('a, button, input, textarea, .accordion-trigger, .surface-card');
                    interactives.forEach(el => {
                        el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
                        el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
                    });
                }
            }
        });
    </script>
</body>"""

html = html.replace("</body>", custom_cursor_js)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Fixed cursor visibility and animations.")
