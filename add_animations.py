import re
import os

target_dir = os.path.dirname(os.path.abspath(__file__))
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add CSS for Glassmorphism and Custom Cursor
css_to_add = """
        /* --- Premium UI Redesign Styles --- */
        .custom-cursor {
            position: fixed;
            top: 0;
            left: 0;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid #ff7900;
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            transition: width 0.3s, height 0.3s, background-color 0.3s, border-color 0.3s;
        }
        .custom-cursor.hover {
            width: 60px;
            height: 60px;
            background-color: rgba(255, 121, 0, 0.1);
            border-color: rgba(255, 121, 0, 0.3);
            backdrop-filter: blur(2px);
        }
        
        /* Enhance Glassmorphism on Cards */
        .surface-card {
            background: rgba(255, 255, 255, 0.6) !important;
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.8) !important;
            box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.05) !important;
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .surface-card:hover {
            transform: translateY(-8px) scale(1.01);
            box-shadow: 0 20px 40px -5px rgba(255, 121, 0, 0.15) !important;
            border: 1px solid rgba(255, 121, 0, 0.3) !important;
        }
        .dark .surface-card {
            background: rgba(30, 30, 32, 0.6) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        
        /* Hide default cursor only if on desktop */
        @media (pointer: fine) {
            body {
                cursor: none;
            }
            a, button, input, textarea {
                cursor: none;
            }
        }
        /* ---------------------------------- */
"""

# Inject CSS right before </style>
if "Premium UI Redesign Styles" not in html:
    # Find the last </style> tag before </head>
    style_end_idx = html.rfind('</style>')
    if style_end_idx != -1:
        html = html[:style_end_idx] + css_to_add + html[style_end_idx:]


# 2. Add GSAP animations and JS Logic
js_to_add = """
        // --- Premium UI Redesign Animations ---
        // 1. Custom Interactive Cursor
        if (window.matchMedia("(pointer: fine)").matches) {
            const cursor = document.createElement('div');
            cursor.classList.add('custom-cursor');
            document.body.appendChild(cursor);
            
            // Need to set initial x and y so it doesn't default to 0,0
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

        // 2. Magnetic Buttons
        const magneticElements = document.querySelectorAll('.btn-primary, .btn-secondary, a.group');
        if (window.matchMedia("(pointer: fine)").matches) {
            magneticElements.forEach(btn => {
                btn.addEventListener('mousemove', (e) => {
                    const rect = btn.getBoundingClientRect();
                    const h = rect.width / 2;
                    const v = rect.height / 2;
                    const x = e.clientX - rect.left - h;
                    const y = e.clientY - rect.top - v;
                    
                    // Move button slightly
                    gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.4, ease: "power2.out" });
                    // Optional: Move text inside button slightly more for parallax
                    const text = btn.querySelector('span');
                    if(text) gsap.to(text, { x: x * 0.1, y: y * 0.1, duration: 0.4, ease: "power2.out" });
                });
                
                btn.addEventListener('mouseleave', () => {
                    // Snap back
                    gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1.2, 0.4)" });
                    const text = btn.querySelector('span');
                    if(text) gsap.to(text, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1.2, 0.4)" });
                });
            });
        }

        // 3. GSAP Scroll Animations
        // Animate all Surface Cards (Bento Grid)
        gsap.utils.toArray('.surface-card').forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: "top 85%", // Trigger when top of card hits 85% of viewport
                    toggleActions: "play none none reverse"
                },
                y: 60,
                opacity: 0,
                duration: 0.8,
                ease: "power3.out",
                delay: i % 3 * 0.1 // Slight stagger based on column position
            });
        });

        // Animate Headlines
        gsap.utils.toArray('h1, h2, h3').forEach(heading => {
            gsap.from(heading, {
                scrollTrigger: {
                    trigger: heading,
                    start: "top 90%",
                    toggleActions: "play none none reverse"
                },
                y: 40,
                opacity: 0,
                duration: 1,
                ease: "power2.out"
            });
        });
        
        // Animate Section dividers (border-t)
        gsap.utils.toArray('.border-t').forEach(border => {
            gsap.from(border, {
                scrollTrigger: {
                    trigger: border,
                    start: "top 90%"
                },
                scaleX: 0,
                transformOrigin: "left center",
                duration: 1.5,
                ease: "power3.inOut"
            });
        });
        // ----------------------------------------
"""

# Inject JS before the closing script tag
if "Premium UI Redesign Animations" not in html:
    # Find the last </script> tag
    script_end_idx = html.rfind('</script>')
    
    # Inject right before </body>, wrapping in a new <script> block
    if "</body>" in html:
        wrapped_js = "\n<script>\n    document.addEventListener('DOMContentLoaded', () => {\n" + js_to_add + "\n    });\n</script>\n"
        html = html.replace("</body>", wrapped_js + "</body>")
    else:
        # Fallback
        html += "\n<script>\n    document.addEventListener('DOMContentLoaded', () => {\n" + js_to_add + "\n    });\n</script>\n"

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Injected Premium UI Animations successfully.")
