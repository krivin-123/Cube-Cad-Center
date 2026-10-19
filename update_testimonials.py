import os
import re

target_dir = r"c:\Users\praja\Downloads\new\website"
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

old_testimonial_1 = """"The project-based approach at Cube Cad Center completely transformed my understanding of Revit. I felt incredibly prepared for my first architectural firm interview."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">Revit Architecture</p>"""

new_testimonial_1 = """"This is the best place for learning actual designing. I truly believe that my concept of design of components is properly clear by faculty."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Verified Student</h4>
                        <p class="text-sm text-on-surface-variant">Mechanical Design</p>"""


old_testimonial_2 = """"Excellent instructors with real industry experience. The SolidWorks training covered advanced assemblies that I now use every day in my mechanical design job."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">SolidWorks Masterclass</p>"""

new_testimonial_2 = """"Super talented and supporting faculties. They make sure that you stay aware and updated with fast-changing industry standards."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Verified Student</h4>
                        <p class="text-sm text-on-surface-variant">CAD & BIM Programs</p>"""


old_testimonial_3 = """"A highly professional environment. The placement assistance helped me land a great role immediately after completing my AutoCAD certification."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Student Name</h4>
                        <p class="text-sm text-on-surface-variant">AutoCAD 2D & 3D</p>"""

new_testimonial_3 = """"Such a great place for learning... The teachers are highly experienced and provide proper guidance. If you want to go in the design field go with Cube CAD, excellent experience."</p>
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-outline/20 rounded-full"></div>
                    <div>
                        <h4 class="font-bold text-on-surface">Verified Student</h4>
                        <p class="text-sm text-on-surface-variant">AutoCAD 2D & 3D</p>"""


html = html.replace(old_testimonial_1, new_testimonial_1)
html = html.replace(old_testimonial_2, new_testimonial_2)
html = html.replace(old_testimonial_3, new_testimonial_3)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Testimonials updated successfully.")
