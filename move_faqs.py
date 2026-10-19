import re
import os

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Delete the injected FAQ section at the bottom
faq_section_pattern = re.compile(r'<!-- FAQ Section -->.*?</section>', re.DOTALL)
html = faq_section_pattern.sub('', html)

# 2. Find the <!-- FAQs & Guides Section --> and replace it
faq_guides_pattern = re.compile(r'<!-- FAQs & Guides Section -->.*?<div class="mt-6 md:hidden text-center">\s*<button class="btn-secondary w-full">View All Documentation</button>\s*</div>\s*</div>', re.DOTALL)

ruixen_faqs = """
<!-- FAQs Section (Moved to this position) -->
<div class="col-span-4 md:col-span-12 mt-xl">
  <div class="grid gap-8 md:grid-cols-5 md:gap-12">
    <div class="md:col-span-2">
      <h2 class="text-on-surface text-4xl font-headline-lg font-bold">FAQs</h2>
      <p class="text-on-surface-variant font-body-lg mt-4 text-balance text-lg">
        Everything you need to know about Ruixen UI
      </p>
      <p class="text-on-surface-variant font-body-md mt-6 hidden md:block">
        Can't find what you're looking for? Reach out to our 
        <a href="#" class="text-primary font-medium hover:underline">Ruixen UI support team</a> for assistance.
      </p>
    </div>

    <div class="md:col-span-3">
      <div class="flex flex-col">
        
        <div class="border-b border-outline/20 accordion-item">
          <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
            What is Ruixen UI?
            <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
          </button>
          <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Ruixen UI is a modern, fully responsive design system that provides pre-built components, utilities, and layouts to help developers build scalable web applications quickly and efficiently.">
            </div>
          </div>
        </div>

        <div class="border-b border-outline/20 accordion-item">
          <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
            Which platforms does Ruixen UI support?
            <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
          </button>
          <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Ruixen UI is built for web applications and works seamlessly with React, Next.js, and other modern JavaScript frameworks. It also supports dark mode and responsive layouts out of the box.">
            </div>
          </div>
        </div>

        <div class="border-b border-outline/20 accordion-item">
          <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
            Can I customize Ruixen UI components?
            <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
          </button>
          <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Yes! All Ruixen UI components are fully customizable via props, CSS classes, and theme configuration. You can easily adapt colors, spacing, typography, and layout to match your brand.">
            </div>
          </div>
        </div>

        <div class="border-b border-outline/20 accordion-item">
          <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
            Does Ruixen UI provide integration with third-party tools?
            <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
          </button>
          <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Absolutely. Ruixen UI includes ready-to-use integrations and patterns for popular tools and services, making it easier to connect your application with analytics, authentication, and workflow platforms.">
            </div>
          </div>
        </div>

        <div class="border-b border-outline/20 accordion-item">
          <button class="w-full flex items-center justify-between py-6 font-headline-md font-medium text-left text-lg text-on-surface hover:underline transition-all group accordion-trigger">
            Is there documentation and support available?
            <span class="material-symbols-outlined shrink-0 transition-transform duration-300 accordion-icon">keyboard_arrow_down</span>
          </button>
          <div class="accordion-content h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="pb-6 pt-0 text-on-surface-variant font-body-md leading-relaxed text-base blurred-text-container" data-text="Yes, Ruixen UI comes with comprehensive documentation, live examples, and tutorials. Additionally, our community and support channels are available to help you implement components and resolve any issues.">
            </div>
          </div>
        </div>

      </div>
      <p class="text-on-surface-variant font-body-md mt-6 md:hidden">
        Can't find what you're looking for? Contact our 
        <a href="#" class="text-primary font-medium hover:underline">
          customer support team
        </a>
      </p>
    </div>
  </div>
</div>
"""

html = faq_guides_pattern.sub(ruixen_faqs, html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Replaced FAQs successfully.")
