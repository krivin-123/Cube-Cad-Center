import os

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

waves_html = """
        <!-- Interactive Waves Background -->
        <canvas id="waves-canvas" class="absolute inset-0 w-full h-full z-0 opacity-50" style="pointer-events: auto;"></canvas>
"""

waves_js = """
        // --- Interactive Waves Canvas Implementation ---
        (function() {
            const canvas = document.getElementById('waves-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            let width, height;
            let points = [];
            
            // Parameters from prompt
            const lineColor = "#F97316";
            const waveSpeedX = 0.02;
            const waveSpeedY = 0.01;
            const waveAmpX = 40;
            const waveAmpY = 20;
            const friction = 0.9;
            const tension = 0.01;
            const maxCursorMove = 120;
            const xGap = 12;
            const yGap = 36;
            
            let mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
            let lastMouse = { x: -1000, y: -1000 };
            
            function resize() {
                // To support high DPI displays
                const dpr = window.devicePixelRatio || 1;
                width = canvas.parentElement.clientWidth;
                height = canvas.parentElement.clientHeight;
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                ctx.scale(dpr, dpr);
                initPoints();
            }
            
            function initPoints() {
                points = [];
                const cols = Math.ceil(width / xGap) + 2;
                const rows = Math.ceil(height / yGap) + 2;
                
                for (let i = 0; i < rows; i++) {
                    let row = [];
                    for (let j = 0; j < cols; j++) {
                        let x = (j - 1) * xGap;
                        let y = (i - 1) * yGap;
                        row.push({
                            baseX: x,
                            baseY: y,
                            x: x,
                            y: y,
                            vx: 0,
                            vy: 0
                        });
                    }
                    points.push(row);
                }
            }
            
            window.addEventListener('resize', resize);
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                lastMouse.x = mouse.x;
                lastMouse.y = mouse.y;
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
                mouse.vx = mouse.x - lastMouse.x;
                mouse.vy = mouse.y - lastMouse.y;
            });
            canvas.addEventListener('mouseleave', () => {
                mouse.x = -1000;
                mouse.y = -1000;
            });
            
            let time = 0;
            function animate() {
                ctx.clearRect(0, 0, width, height);
                time += 1;
                
                // Update physics
                for (let i = 0; i < points.length; i++) {
                    for (let j = 0; j < points[i].length; j++) {
                        let p = points[i][j];
                        
                        // Calculate target based on wave sine function
                        let targetX = p.baseX + Math.sin(time * waveSpeedX + p.baseY * 0.05) * waveAmpX;
                        let targetY = p.baseY + Math.sin(time * waveSpeedY + p.baseX * 0.05) * waveAmpY;
                        
                        // Mouse interaction
                        let dx = mouse.x - p.x;
                        let dy = mouse.y - p.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist < maxCursorMove) {
                            // Repel force based on distance
                            let force = (maxCursorMove - dist) / maxCursorMove;
                            p.vx -= (dx / dist) * force * 2;
                            p.vy -= (dy / dist) * force * 2;
                        }
                        
                        // Spring towards target
                        p.vx += (targetX - p.x) * tension;
                        p.vy += (targetY - p.y) * tension;
                        
                        // Apply friction
                        p.vx *= friction;
                        p.vy *= friction;
                        
                        // Update position
                        p.x += p.vx;
                        p.y += p.vy;
                    }
                }
                
                // Draw lines
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 1;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                for (let i = 0; i < points.length; i++) {
                    ctx.beginPath();
                    for (let j = 0; j < points[i].length; j++) {
                        let p = points[i][j];
                        if (j === 0) {
                            ctx.moveTo(p.x, p.y);
                        } else {
                            // Use smooth curve connecting points
                            let prev = points[i][j-1];
                            let cx = (p.x + prev.x) / 2;
                            let cy = (p.y + prev.y) / 2;
                            ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
                            if (j === points[i].length - 1) {
                                ctx.lineTo(p.x, p.y);
                            }
                        }
                    }
                    ctx.stroke();
                }
                
                requestAnimationFrame(animate);
            }
            
            // Initialization
            resize();
            animate();
        })();
"""

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Insert the canvas inside the Hero section
if 'id="waves-canvas"' not in html:
    # Find <main id="hero" ...>
    hero_pattern = '<main id="hero" class="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-16 lg:px-24 pt-32 pb-20 z-20 overflow-hidden bg-background">'
    if hero_pattern in html:
        html = html.replace(hero_pattern, hero_pattern + '\n' + waves_html)

# Insert the JS before the closing </body> tag
if 'Interactive Waves Canvas Implementation' not in html:
    html = html.replace('</body>', '    <script>\n' + waves_js + '\n    </script>\n</body>')

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Injected Waves successfully.")
