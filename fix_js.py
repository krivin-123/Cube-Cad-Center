import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
files = ["explore.html", "syllabus-architectural.html", "syllabus-structural.html", "syllabus-mechanical.html", "syllabus-mep.html"]

script_template = """<script>
        // GSAP Animations
        document.addEventListener('DOMContentLoaded', () => {
              
            // Canvas Image Sequence Animation
            const canvas = document.getElementById("hero-canvas");
            if (!canvas) return;
            const context = canvas.getContext("2d");
            
            // Mobile Optimization: Load fewer frames to save memory and bandwidth
            const isMobile = window.innerWidth < 768;
            const frameStep = isMobile ? 5 : 1; // Load every 5th frame on mobile for extreme performance
            const totalOriginalFrames = 300;
            const frameCount = Math.floor(totalOriginalFrames / frameStep);
            
            const currentFrame = index => {
                const actualIndex = Math.min((index * frameStep) + 1, totalOriginalFrames);
                return `../cube.cad/ezgif-frame-${actualIndex.toString().padStart(3, '0')}.jpg`;
            };

            const images = [];
            const imageSequence = { frame: 0 };
            
            let loadedCount = 0;
            const loadingState = { visual: 0 };
            
            const preloader = document.getElementById('preloader');
            const loaderPercentage = document.getElementById('loader-percentage');
            const loaderProgress = document.getElementById('loader-progress');

            function checkLoadProgress() {
                loadedCount++;
                const actualProgress = (loadedCount / frameCount) * 100;
                
                // Calculate duration based on remaining distance.
                // 100% progress over 1 second = 0.01 seconds per 1%
                const duration = Math.max(0, (actualProgress - loadingState.visual) * 0.01);

                gsap.to(loadingState, {
                    visual: actualProgress,
                    duration: duration,
                    ease: "none", // Linear ease ensures numbers count up consistently
                    overwrite: "auto",
                    onUpdate: () => {
                        const displayPercent = Math.floor(loadingState.visual);
                        if(loaderPercentage) loaderPercentage.innerText = `${displayPercent}%`;
                        if(loaderProgress) loaderProgress.style.width = `${displayPercent}%`;
                    },
                    onComplete: () => {
                        if (actualProgress === 100 && Math.floor(loadingState.visual) === 100) {
                            if (preloader) {
                                gsap.to(preloader, {
                                    opacity: 0,
                                    duration: 0.8,
                                    ease: "power2.inOut",
                                    delay: 0.1, // Very brief pause
                                    onComplete: () => {
                                        sessionStorage.setItem('loaderPlayed', 'true');
                                        preloader.style.display = 'none';
                                    }
                                });
                            }
                        }
                    }
                });
            }

            // Preload
            const loaderPlayed = sessionStorage.getItem('loaderPlayed') === 'true';
            
            if (loaderPlayed && preloader) {
                preloader.style.display = 'none';
            }

            for (let i = 0; i < frameCount; i++) {
                const img = new Image();
                img.onload = () => {
                    if (i === 0) {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        // Enable high-quality rendering to improve perceived video quality
                        context.imageSmoothingEnabled = true;
                        context.imageSmoothingQuality = 'high';
                        render();
                    }
                    if (!loaderPlayed) {
                        checkLoadProgress();
                    }
                };
                if (!loaderPlayed) {
                    img.onerror = checkLoadProgress;
                }
                img.src = currentFrame(i);
                images.push(img);
            }

            function render() {
                // Ensure image is loaded before drawing to avoid blank flashes
                if (images[imageSequence.frame] && images[imageSequence.frame].complete) {
                    // Turn off smoothing during rapid scroll to boost FPS on mobile
                    context.imageSmoothingEnabled = !isMobile;
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(images[imageSequence.frame], 0, 0, canvas.width, canvas.height);
                }
            }

            // Global Canvas Visibility (Fade in as we leave hero)
            gsap.to("#hero-canvas", {
                opacity: 1,
                scrollTrigger: {
                    trigger: "main",
                    start: "top 80%",
                    end: "top 20%",
                    scrub: true
                }
            });

            // Global Canvas Scroll Animation
            gsap.to(imageSequence, {
                frame: frameCount - 1,
                snap: "frame",
                ease: "none",
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: "bottom bottom",
                    scrub: isMobile ? 1.5 : 0.5 // Smoother scrub on mobile
                },
                onUpdate: render
            });

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

for f_name in files:
    file_path = os.path.join(target_dir, f_name)
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Replace everything from <script>\s*// GSAP Animations to </script> at the bottom
    # with script_template
    html = re.sub(r'<script>\s*// GSAP Animations.*?</script>', script_template, html, flags=re.DOTALL)
    
    # Make sure we don't have multiple script blocks if we mess up.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html)

print("Fixed JS on 5 pages.")
