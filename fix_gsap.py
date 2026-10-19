import os

html_path = "index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

gsap_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>'
scroll_trigger_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>'

if scroll_trigger_script not in html:
    html = html.replace(gsap_script, gsap_script + "\n    " + scroll_trigger_script)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("Injected ScrollTrigger script.")
else:
    print("ScrollTrigger script already exists.")
