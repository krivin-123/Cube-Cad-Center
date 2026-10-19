import re
import os

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update the General Inquiries phone numbers
general_inquiries_old = """<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">General Inquiries</span>
<a class="font-body-lg text-body-lg text-on-surface hover:text-primary transition-colors" href="tel:+919876543210">+91 98765 43210</a>"""

general_inquiries_new = """<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">General Inquiries</span>
<div class="flex flex-col gap-1">
<a class="font-body-lg text-body-lg text-on-surface hover:text-primary transition-colors" href="tel:+919978999694">+91 9978999694</a>
<a class="font-body-lg text-body-lg text-on-surface hover:text-primary transition-colors" href="tel:+919909996285">+91 9909996285</a>
<a class="font-body-lg text-body-lg text-on-surface hover:text-primary transition-colors" href="tel:+919909997285">+91 9909997285</a>
</div>"""

html = html.replace(general_inquiries_old, general_inquiries_new)


# 2. Update the Locations Block
locations_old_pattern = re.compile(r'<!-- Locations -->\s*<div class="surface-card p-6 surface-card-active flex flex-col gap-4">\s*<div class="card-header-separator pb-3">\s*<h3 class="font-headline-md text-headline-md text-on-surface">Our Headquarters</h3>\s*</div>\s*<!-- Satellite Branch -->\s*<div class="mb-2 pb-4 last:border-0 last:pb-0">\s*<div class="flex justify-between items-center mb-2">\s*<h4 class="font-body-lg text-body-lg font-semibold text-on-surface">Ahmedabad</h4>\s*<span class="chip">HQ</span>\s*</div>\s*<p class="font-body-sm text-body-sm text-on-surface-variant mb-2">301, Titanium City Center, 100 Ft. Anand Nagar Road, Satellite, Ahmedabad, Gujarat 380015</p>\s*<a class="font-body-sm text-body-sm font-semibold text-primary hover:underline flex items-center gap-1" href="tel:\+919876543210">\s*<span class="material-symbols-outlined text-\[16px\]">call</span> \+91 98765 43210\s*</a>\s*</div>\s*</div>\s*</div>', re.DOTALL)

locations_new = """<!-- Locations -->
<div class="surface-card p-6 surface-card-active flex flex-col gap-4">
<div class="card-header-separator pb-3">
<h3 class="font-headline-md text-headline-md text-on-surface">Our Branches</h3>
</div>
<!-- Satellite Branch -->
<div class="mb-4 pb-4 border-b border-outline/20">
<div class="flex justify-between items-center mb-2">
<h4 class="font-body-lg text-body-lg font-semibold text-on-surface">Satellite</h4>
<span class="chip">HQ</span>
</div>
<p class="font-body-sm text-body-sm text-on-surface-variant mb-2">310, Iscon Emporio, Beside Star Bazaar, Near Jodhpur Cross Road, Satellite, Ahmedabad. Gujarat 380015, India.</p>
<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
<span class="material-symbols-outlined text-[16px]">schedule</span> 10:00 am To 08:00 pm (Mon-Sat)
</p>
</div>
<!-- Bopal Branch -->
<div class="mb-0 pb-0">
<div class="flex justify-between items-center mb-2">
<h4 class="font-body-lg text-body-lg font-semibold text-on-surface">South Bopal</h4>
</div>
<p class="font-body-sm text-body-sm text-on-surface-variant mb-2">C449, 4th Floor, SoBo Center, South Bopal, Above Gwalia, Ahmedabad. Gujarat 380058, India.</p>
<p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
<span class="material-symbols-outlined text-[16px]">schedule</span> 10:00 am To 08:00 pm (Mon-Sun)
</p>
</div>
</div>
</div>"""

html = locations_old_pattern.sub(locations_new, html)


# 3. Update the Footer
footer_old_pattern = re.compile(r'<div>\s*<h4 class="font-label-caps text-label-caps font-semibold text-on-surface mb-4 tracking-widest">Contact</h4>\s*<ul class="flex flex-col gap-2">\s*<li class="text-on-surface-variant font-body-md">301, Titanium City Center, Satellite</li>\s*<li class="text-on-surface-variant font-body-md">Ahmedabad, Gujarat 380015</li>\s*<li class="text-on-surface-variant font-body-md mt-4"><a href="tel:\+919876543210" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-\[18px\]">call</span> \+91 98765 43210</a></li>\s*<li class="text-on-surface-variant font-body-md mt-1"><a href="mailto:info@cubecadcenter\.co" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-\[18px\]">email</span> info@cubecadcenter\.co</a></li>\s*</ul>\s*</div>', re.DOTALL)

footer_new = """<div>
                  <h4 class="font-label-caps text-label-caps font-semibold text-on-surface mb-4 tracking-widest">Contact</h4>
                  <ul class="flex flex-col gap-2">
                      <li class="text-on-surface-variant font-body-md font-semibold text-on-surface">Satellite:</li>
                      <li class="text-on-surface-variant font-body-sm">310, Iscon Emporio, Near Jodhpur Cross Road</li>
                      <li class="text-on-surface-variant font-body-md font-semibold text-on-surface mt-2">Bopal:</li>
                      <li class="text-on-surface-variant font-body-sm">C449, 4th Floor, SoBo Center, South Bopal</li>
                      <li class="text-on-surface-variant font-body-md mt-4"><a href="tel:+919978999694" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">call</span> +91 9978999694</a></li>
                      <li class="text-on-surface-variant font-body-md"><a href="tel:+919909996285" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">call</span> +91 9909996285</a></li>
                      <li class="text-on-surface-variant font-body-md mt-1"><a href="mailto:info@cubecadcenter.co" class="hover:text-primary transition-colors font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">email</span> info@cubecadcenter.co</a></li>
                  </ul>
              </div>"""

html = footer_old_pattern.sub(footer_new, html)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Branch details updated successfully.")
