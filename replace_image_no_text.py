import os
import shutil

target_dir = r"c:\Users\praja\Downloads\new\website"
assets_dir = os.path.join(target_dir, "assets", "images")

# Image path from brain dir
brain_dir = r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152"
new_img_src = os.path.join(brain_dir, "architectural_cad_render_no_text_1787140409434.jpg")

img1_dst = os.path.join(assets_dir, "architectural_render.jpg")

# Copy file and overwrite existing
shutil.copy(new_img_src, img1_dst)

print("Overwrote architectural render successfully.")
