import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

faq_html = """
    <!-- FAQ Section -->
    <section id="faqs" class="py-24 max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop mt-lg">
      <div class="grid gap-8 md:grid-cols-5 md:gap-12">
        <div class="md:col-span-2">
          <h2 class="text-on-surface text-4xl font-headline-lg font-bold">FAQs</h2>
          <p class="text-on-surface-variant font-body-lg mt-4 text-balance text-lg">
            Everything you need to know about learning at Cube Cad Center.
          </p>
          <p class="text-on-surface-variant font-body-md mt-6 hidden md:block">
            Can't find what you're looking for? Reach out to our 
            <a href="mailto:info@cubecadcenter.co" class="text-primary font-medium hover:underline">support team</a> for assistance.
          </p>
        </div>

        <div class="md:col-span-3">
          <div class="flex flex-col">
            
            <div class="border-b border-outline/20 accordion-item">
              <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
                What courses does Cube Cad Center offer?
                <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
              </button>
              <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="We offer comprehensive training in Architectural Design (AutoCAD, Revit, SketchUp), Structural Engineering (STAAD.Pro, ETABS), Mechanical Design (SolidWorks, CATIA), and complete HVAC/MEP systems.">
                </div>
              </div>
            </div>

            <div class="border-b border-outline/20 accordion-item">
              <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
                Do you provide placement assistance?
                <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
              </button>
              <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Yes! We provide 100% placement assistance to all our students. We have tie-ups with leading engineering and architectural firms across Gujarat to help launch your career.">
                </div>
              </div>
            </div>

            <div class="border-b border-outline/20 accordion-item">
              <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
                Are the instructors industry professionals?
                <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
              </button>
              <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Absolutely. Our faculty consists of experienced professionals who have worked on real-world projects. They bring practical, industry-standard workflows into the classroom.">
                </div>
              </div>
            </div>

            <div class="border-b border-outline/20 accordion-item">
              <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
                Do I get a certification after completing the course?
                <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
              </button>
              <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Yes, Cube Cad Center is an authorized training institute. Upon successful completion of your course, you will receive an industry-recognized certificate that adds significant value to your resume.">
                </div>
              </div>
            </div>

            <div class="border-b border-outline/20 accordion-item">
              <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
                Can I take courses online or is it offline only?
                <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
              </button>
              <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="We offer flexible learning modes including fully offline classroom training in Ahmedabad, as well as hybrid options. Contact our support team to find a schedule that works for you.">
                </div>
              </div>
            </div>

          </div>
          <p class="text-on-surface-variant font-body-md mt-6 md:hidden">
            Can't find what you're looking for? Contact our 
            <a href="mailto:info@cubecadcenter.co" class="text-primary font-medium hover:underline">
              support team
            </a>
          </p>
        </div>
      </div>
    </section>
"""

faq_js = """
            // FAQ Accordion Logic with Staggered Blur Text Reveal
            const accordionItems = document.querySelectorAll('.accordion-item');
            
            // First, populate the blurred text containers with spans
            document.querySelectorAll('.blurred-text-container').forEach(container => {
                const text = container.getAttribute('data-text');
                container.innerHTML = '';
                const chars = text.split('');
                chars.forEach(char => {
                    const span = document.createElement('span');
                    // In HTML, a space in a span might collapse if empty, so use &nbsp;
                    span.innerHTML = char === ' ' ? '&nbsp;' : char;
                    span.className = 'inline-block opacity-0 blur-[10px] transform-gpu';
                    container.appendChild(span);
                });
            });

            accordionItems.forEach(item => {
                const trigger = item.querySelector('.accordion-trigger');
                const content = item.querySelector('.accordion-content');
                const icon = item.querySelector('.accordion-icon');
                const textSpans = content.querySelectorAll('span');
                let isOpen = false;
                
                // Animation timeline for this specific item
                let blurAnim;

                trigger.addEventListener('click', () => {
                    // Close all other accordions (accordion type="single")
                    accordionItems.forEach(otherItem => {
                        if (otherItem !== item && otherItem.classList.contains('is-open')) {
                            const otherTrigger = otherItem.querySelector('.accordion-trigger');
                            const otherContent = otherItem.querySelector('.accordion-content');
                            const otherIcon = otherItem.querySelector('.accordion-icon');
                            const otherSpans = otherContent.querySelectorAll('span');
                            
                            otherItem.classList.remove('is-open');
                            otherContent.style.height = '0px';
                            otherIcon.style.transform = 'rotate(0deg)';
                            gsap.killTweensOf(otherSpans);
                            gsap.set(otherSpans, { opacity: 0, filter: "blur(10px)" });
                        }
                    });

                    isOpen = !isOpen;
                    
                    if (isOpen) {
                        item.classList.add('is-open');
                        // Calculate auto height
                        content.style.height = 'auto';
                        const height = content.scrollHeight + 'px';
                        content.style.height = '0px'; // reset to 0
                        
                        // Force layout reflow
                        content.offsetHeight;
                        
                        // Expand height
                        content.style.height = height;
                        icon.style.transform = 'rotate(180deg)';

                        // Play GSAP blurred stagger text reveal
                        if (blurAnim) blurAnim.kill();
                        blurAnim = gsap.to(textSpans, {
                            opacity: 1,
                            filter: "blur(0px)",
                            duration: 0.3,
                            stagger: 0.015,
                            ease: "power2.out"
                        });
                        
                        // Cleanup height to auto after transition so resizing works
                        setTimeout(() => {
                            if (item.classList.contains('is-open')) {
                                content.style.height = 'auto';
                            }
                        }, 300);

                    } else {
                        item.classList.remove('is-open');
                        content.style.height = content.scrollHeight + 'px';
                        
                        // Force layout reflow
                        content.offsetHeight;
                        
                        // Collapse
                        content.style.height = '0px';
                        icon.style.transform = 'rotate(0deg)';
                        
                        // Reset GSAP spans
                        if (blurAnim) blurAnim.kill();
                        gsap.set(textSpans, { opacity: 0, filter: "blur(10px)" });
                    }
                });
            });
"""

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Insert HTML right above <footer
if 'id="faqs"' not in html:
    html = html.replace('<footer', faq_html + '\n    <footer')

# Insert JS right before the end of DOMContentLoaded block
# We look for the end of the DOMContentLoaded block, maybe right before '});\n    </script>'
if 'FAQ Accordion Logic' not in html:
    html = html.replace('});\n    </script>', faq_js + '\n        });\n    </script>')

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Injected FAQs successfully.")
