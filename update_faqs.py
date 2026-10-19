import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Define the new FAQs block
new_faqs = """<!-- FAQs Section -->
<div class="max-w-4xl mx-auto w-full">
    <div class="text-center mb-16">
        <div class="chip mb-4">GOT QUESTIONS?</div>
        <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-6 font-bold">Frequently Asked Questions</h2>
        <p class="font-body-lg text-lg text-on-surface-variant">Find quick answers to common questions about our CAD and BIM training programs.</p>
    </div>
    
    <div class="flex flex-col gap-4">
        <!-- FAQ 1 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Which course is best for beginners?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    If you are new to design software, we highly recommend starting with our <strong>AutoCAD 2D & 3D Drafting</strong> course. It builds the fundamental understanding of coordinates, dimensions, and technical drawing that translates to all other advanced software.
                </div>
            </div>
        </div>

        <!-- FAQ 2 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Do I need prior CAD experience?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    No prior experience is necessary for our foundation courses. We teach you from scratch, starting with the basic interface and progressing to advanced 3D modeling. However, basic computer literacy is required.
                </div>
            </div>
        </div>

        <!-- FAQ 3 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                How long does a course take?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    Course duration varies depending on the software and depth of the curriculum. Foundation courses like AutoCAD typically take 1.5 to 2 months, while advanced Masterclasses (like Revit BIM or SolidWorks) range from 2.5 to 3 months of regular classes.
                </div>
            </div>
        </div>

        <!-- FAQ 4 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Which software versions are taught?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    We strictly use the latest, industry-standard versions of all software (e.g., AutoCAD 2024, Revit 2024, SolidWorks) to ensure our students learn the most modern tools and workflows currently demanded by employers.
                </div>
            </div>
        </div>

        <!-- FAQ 5 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Are the courses practical or theoretical?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    Our training is <strong>90% practical</strong>. While we explain the underlying engineering concepts, the vast majority of class time is spent actively modeling, drafting, and problem-solving within the software interface.
                </div>
            </div>
        </div>

        <!-- FAQ 6 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Do students work on real projects?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    Yes. Every course concludes with a mandatory capstone project. Students draft actual residential floorplans, design mechanical assemblies, or model structural frameworks, providing them with a strong portfolio for job interviews.
                </div>
            </div>
        </div>

        <!-- FAQ 7 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                Are classes online or offline?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    We currently offer comprehensive offline training at our Satellite and South Bopal branches in Ahmedabad, providing direct, in-person mentorship and access to our high-performance workstation labs.
                </div>
            </div>
        </div>

        <!-- FAQ 8 -->
        <div class="surface-card rounded-2xl overflow-hidden accordion-item border border-outline/20 group">
            <button class="w-full flex items-center justify-between p-6 md:p-8 font-headline-md font-medium text-left text-lg text-on-surface hover:text-primary transition-all accordion-trigger bg-surface-variant/30">
                How can I contact the institute?
                <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 border border-outline/20 group-hover:border-primary transition-colors">
                    <span class="material-symbols-outlined transition-transform duration-300 accordion-icon">add</span>
                </div>
            </button>
            <div class="accordion-content h-0 overflow-hidden transition-all duration-300">
                <div class="p-6 md:p-8 pt-0 border-t border-outline/10 text-on-surface-variant leading-relaxed">
                    You can easily reach us via phone at <strong>+91 9978999694</strong> / <strong>+91 9909996285</strong> / <strong>+91 9909997285</strong>, email us at <strong>info@cubecadcenter.co</strong>, or visit either of our branches located in Iscon Emporio (Satellite) or SoBo Center (South Bopal).
                </div>
            </div>
        </div>
    </div>
</div>"""

# Replace the existing FAQ section content
faq_section_pattern = re.compile(r'<section id="faq".*?>(.*?)</section>', re.DOTALL)
html = faq_section_pattern.sub(f'<section id="faq" class="py-24 max-w-4xl mx-auto px-6">\n{new_faqs}\n</section>', html)

# Fix JS accordion toggling to support 'add' -> 'remove' icon rotation/swapping
# I need to update the JS block. Wait, changing the icon innerText is better.
# Let's write a JS snippet to replace the old JS.

old_js = """        // Setup FAQ accordion toggling
        document.addEventListener('DOMContentLoaded', () => {
            const accordionTriggers = document.querySelectorAll('.accordion-trigger');
            accordionTriggers.forEach(trigger => {
                trigger.addEventListener('click', () => {
                    const content = trigger.nextElementSibling;
                    const icon = trigger.querySelector('.accordion-icon');
                    const isExpanded = content.classList.contains('h-auto');
                    
                    document.querySelectorAll('.accordion-content').forEach(c => {
                        c.classList.remove('h-auto');
                        c.style.height = '0px';
                    });
                    document.querySelectorAll('.accordion-icon').forEach(i => i.style.transform = 'rotate(0deg)');
                    
                    if (!isExpanded) {
                        content.classList.add('h-auto');
                        content.style.height = content.scrollHeight + 'px';
                        if (icon) icon.style.transform = 'rotate(180deg)';
                    }
                });
            });
        });"""

new_js = """        // Setup FAQ accordion toggling
        document.addEventListener('DOMContentLoaded', () => {
            const accordionTriggers = document.querySelectorAll('.accordion-trigger');
            accordionTriggers.forEach(trigger => {
                trigger.addEventListener('click', () => {
                    const content = trigger.nextElementSibling;
                    const icon = trigger.querySelector('.accordion-icon');
                    const isExpanded = content.classList.contains('h-auto');
                    
                    // Close all
                    document.querySelectorAll('.accordion-content').forEach(c => {
                        c.classList.remove('h-auto', 'opacity-100');
                        c.classList.add('opacity-0');
                        c.style.height = '0px';
                    });
                    document.querySelectorAll('.accordion-icon').forEach(i => {
                        i.innerText = 'add';
                        i.style.transform = 'rotate(0deg)';
                    });
                    
                    // Open clicked if it wasn't expanded
                    if (!isExpanded) {
                        content.classList.add('h-auto', 'opacity-100');
                        content.classList.remove('opacity-0');
                        content.style.height = content.scrollHeight + 'px';
                        if (icon) {
                            icon.innerText = 'remove';
                            icon.style.transform = 'rotate(180deg)';
                        }
                    }
                });
            });
        });"""

# Because there are two versions of JS accordion logic appended (due to my previous messy appends), let's just do a string replace on both or re-write the `<script>` tag.
# I'll just use regex to replace the specific block.
html = html.replace(old_js, new_js)

# I should also remove the other redundant accordion logic that was injected previously via animations_script
redundant_js_pattern = re.compile(r'// FAQ Accordion Logic with Staggered Blur Text Reveal.*?(?=// --- Interactive Waves)', re.DOTALL)
html = redundant_js_pattern.sub('', html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated FAQs.")
