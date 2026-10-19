import os
import shutil
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
assets_dir = os.path.join(target_dir, "assets", "images")
os.makedirs(assets_dir, exist_ok=True)

# Image paths from brain dir
brain_dir = r"C:\Users\praja\.gemini\antigravity-ide\brain\0011fd65-a2ce-45cd-bb1a-9d2e173a5152"
img1_src = os.path.join(brain_dir, "architectural_cad_render_1787139614965.jpg")
img2_src = os.path.join(brain_dir, "hvac_mep_render_1787139687727.jpg")
img3_src = os.path.join(brain_dir, "drafting_precision_render_1787139713031.jpg")

img1_dst = os.path.join(assets_dir, "architectural_render.jpg")
img2_dst = os.path.join(assets_dir, "hvac_render.jpg")
img3_dst = os.path.join(assets_dir, "drafting_tools.jpg")

# Copy files
shutil.copy(img1_src, img1_dst)
shutil.copy(img2_src, img2_dst)
shutil.copy(img3_src, img3_dst)

index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# The specific old URLs found in grep
old_arch_url = "https://lh3.googleusercontent.com/aida/AP1WRLuIyiMxCNRgDl1wvIAF9T_dThhWH7rDB_2qAfaeH04ZAARzmizHCIkEAFUvTkFrCvBQYwgtgZWCJhbJJUdy03CUb4tj5rQ4c-UtYc7egDoYTXl4iuOu6ouM2A4wMApq0kJbq2XwhC6VvqNq2HbYkAcataTwjLyMS1oyqQY7emRnr0jdliczdcV25THxDZvldqFbmJaVcm81ObabbgJ9sNRIV37_nxVLgp3sRX2y00NZhDRdtHzsQqzC-Q"
old_arch_2_url = "https://lh3.googleusercontent.com/aida/AP1WRLsRlGsFRac4AsR5fM7TtRrJofJE-WZwVv_ft6HfUJDl8sF0wiwC5keQmSeTEw2NxueiMiyq2ddlO8MSwYHBMUwKNkZBLZ8xSd6NsBVsFR5fPydlfH0l1inccQN-oQD0SWxNfeJs7UGmoPJpWiinE8Fg50m_8nmcdp6BXj0RHf87OfGZIpdUThih4cpTzBSgovZjrh839gkNLO4FVCYzI0drLyapg7QGSrVOxT2PgMLTI4yOy8ZjMMDrjw"
old_mep_url = "https://lh3.googleusercontent.com/aida/AP1WRLvV91LxSzLGUTzw3x7TfiBAwOorNc8CAhtEF3Aq07FRLFTqsjjjoOhhvh5dCi3Am-7pQcGas7cyN0zLLF36HlYY18xBTcGbsEO15xwCIqyI0gbOd2KUIgPr6nbMUpQTv4EdvwJ9Gw46Bq6Rxc6SIrcRhry7EHHLACQHVsvp2F0uHP0-giM0vk9ZDFPyMFKG6863E4X9zy1SeCfFwi9jYj8UrGdEfbHBm2LdHFgHLfAQ-CJleF3xTEDu4A"
old_draft_1_url = "https://lh3.googleusercontent.com/aida/AP1WRLv3PSSUyGfKM1GsLm1JSInojNQ1J-xDQBtWncojLZSaY7jo10ucldunEcTLnbfGZ_gIC_2lrEQm9vko4VexYKNo11_tQ3kpyS4d5QN3s9rZ9gmUxX4RWXgUUTvQxBLHAwaG2usTNYIn8TMHGFBFmV9JMkJ30_Tql0qtnAaBFXByvc_fGyFL3r8D-ZpZDztr-jA50wtVFyMisjUqf5yC0lt583Wx4nOaoHts-XugyqgZdPSN7Am18tYUrg"
old_draft_2_url = "https://lh3.googleusercontent.com/aida/AP1WRLvLzDJe12rMitBSmZRqxrtvswsGE_W8eo0EFzFPUA7dc2Cpch3xc0iygXk5XlvgymSXQqxX6XGf_VaV2iorP2iNo0Z8sHQZL770MJ-ysH5_8m8hYHFUiOAm3SOVCtJYiHhJQDm1_HGKj7Cd0HJEFgjEiddp59PQZ-gCqPbw4yICrxL9tBLQv9wF2eEuIfoDPKpgH4wJxvr08lnvqkBusLgLwV29f_3t7Ilm3X8OVc4g3Igf6A-KWUMvqw"

html = html.replace(old_arch_url, "assets/images/architectural_render.jpg")
html = html.replace(old_arch_2_url, "assets/images/architectural_render.jpg")
html = html.replace(old_mep_url, "assets/images/hvac_render.jpg")
html = html.replace(old_draft_1_url, "assets/images/drafting_tools.jpg")
html = html.replace(old_draft_2_url, "assets/images/drafting_tools.jpg")

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Images replaced successfully in index.html.")
