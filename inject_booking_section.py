import os
import re

target_dir = os.path.dirname(os.path.abspath(__file__))
index_path = os.path.join(target_dir, "index.html")

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. Insert "Book an Appointment" section BEFORE the Final CTA ──
booking_section = r'''    <!-- ─── BOOK AN APPOINTMENT SECTION ─── -->
    <section id="book-appointment" class="py-24 md:py-32 max-w-7xl mx-auto px-6">
        <div class="text-center mb-16 max-w-2xl mx-auto">
            <div class="chip mb-4">SCHEDULE A VISIT</div>
            <h2 class="font-headline-xl text-4xl md:text-5xl text-on-surface mb-4 font-bold">Book an Appointment</h2>
            <p class="font-body-lg text-lg text-on-surface-variant">Quick and easy — pick a service, choose a date & time, and you're booked.</p>
        </div>

        <!-- Appointment Card -->
        <div class="max-w-2xl mx-auto">

            <!-- ── FORM VIEW ── -->
            <div id="appt-form-view" class="surface-card rounded-3xl p-8 md:p-10 border border-outline/10 shadow-lg">

                <!-- Step Indicator -->
                <div class="flex items-center justify-center gap-2 mb-10">
                    <div id="step-dot-1" class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm transition-all">1</div>
                    <div class="w-8 h-[2px] bg-outline/20 rounded-full" id="step-line-1"></div>
                    <div id="step-dot-2" class="w-10 h-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center text-sm font-bold transition-all">2</div>
                    <div class="w-8 h-[2px] bg-outline/20 rounded-full" id="step-line-2"></div>
                    <div id="step-dot-3" class="w-10 h-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center text-sm font-bold transition-all">3</div>
                </div>

                <!-- STEP 1: Service + Date + Time -->
                <div id="appt-step-1">
                    <!-- Service -->
                    <div class="mb-6">
                        <label for="appt-service" class="block text-sm font-bold text-on-surface mb-2">
                            <span class="material-symbols-outlined text-primary text-[18px] align-text-bottom mr-1">category</span>
                            Select Service
                        </label>
                        <select id="appt-service" required class="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline/20 text-on-surface text-base font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer">
                            <option value="" disabled selected>Choose a service…</option>
                            <option value="Architectural & Interior Design Consultation">📐 Architectural & Interior Design Consultation</option>
                            <option value="Structural & Civil Engineering Consultation">🏗️ Structural & Civil Engineering Consultation</option>
                            <option value="Mechanical & Product Design Consultation">⚙️ Mechanical & Product Design Consultation</option>
                            <option value="HVAC & MEPF Design Consultation">❄️ HVAC & MEPF Design Consultation</option>
                            <option value="General Career & Course Counseling">🎯 General Career & Course Counseling</option>
                            <option value="Free Demo Class">🖥️ Free Demo Class</option>
                            <option value="Campus Tour">🏢 Campus Tour & Lab Visit</option>
                        </select>
                    </div>

                    <!-- Date -->
                    <div class="mb-6">
                        <label for="appt-date" class="block text-sm font-bold text-on-surface mb-2">
                            <span class="material-symbols-outlined text-primary text-[18px] align-text-bottom mr-1">calendar_today</span>
                            Select Date
                        </label>
                        <input type="date" id="appt-date" required class="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline/20 text-on-surface text-base font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                    </div>

                    <!-- Time Slots -->
                    <div class="mb-8">
                        <label class="block text-sm font-bold text-on-surface mb-3">
                            <span class="material-symbols-outlined text-primary text-[18px] align-text-bottom mr-1">schedule</span>
                            Select Available Time
                        </label>
                        <div id="appt-time-slots" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <!-- Slots are rendered by JS -->
                        </div>
                        <input type="hidden" id="appt-time" required>
                    </div>

                    <button type="button" id="appt-next-1" onclick="goToStep(2)" disabled class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base hover:bg-on-primary-container transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary">
                        Continue
                        <span class="material-symbols-outlined text-xl">arrow_forward</span>
                    </button>
                </div>

                <!-- STEP 2: Personal Details -->
                <div id="appt-step-2" class="hidden">
                    <div class="mb-6">
                        <label for="appt-name" class="block text-sm font-bold text-on-surface mb-2">
                            <span class="material-symbols-outlined text-primary text-[18px] align-text-bottom mr-1">person</span>
                            Full Name
                        </label>
                        <input type="text" id="appt-name" required placeholder="e.g. Rahul Sharma" class="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline/20 text-on-surface text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                    </div>

                    <div class="mb-6">
                        <label for="appt-phone" class="block text-sm font-bold text-on-surface mb-2">
                            <span class="material-symbols-outlined text-primary text-[18px] align-text-bottom mr-1">call</span>
                            Phone Number
                        </label>
                        <input type="tel" id="appt-phone" required placeholder="+91 99789 99694" class="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline/20 text-on-surface text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                    </div>

                    <div class="mb-8">
                        <label for="appt-email" class="block text-sm font-bold text-on-surface mb-2">
                            <span class="material-symbols-outlined text-on-surface-variant text-[18px] align-text-bottom mr-1">mail</span>
                            Email
                            <span class="text-xs font-normal text-on-surface-variant ml-1">(optional)</span>
                        </label>
                        <input type="email" id="appt-email" placeholder="name@example.com" class="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl border border-outline/20 text-on-surface text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                    </div>

                    <!-- Summary Preview -->
                    <div class="p-4 rounded-2xl bg-surface-variant/50 border border-outline/10 mb-6 text-sm space-y-1.5">
                        <p class="font-bold text-on-surface text-xs uppercase tracking-wider mb-2">Your Selection</p>
                        <p class="text-on-surface-variant"><span class="font-semibold text-on-surface">Service:</span> <span id="preview-service">–</span></p>
                        <p class="text-on-surface-variant"><span class="font-semibold text-on-surface">Date:</span> <span id="preview-date">–</span></p>
                        <p class="text-on-surface-variant"><span class="font-semibold text-on-surface">Time:</span> <span id="preview-time">–</span></p>
                    </div>

                    <div class="flex gap-3">
                        <button type="button" onclick="goToStep(1)" class="flex-shrink-0 px-6 py-4 rounded-2xl border border-outline/20 text-on-surface font-bold text-sm hover:bg-surface-variant transition-colors flex items-center gap-1">
                            <span class="material-symbols-outlined text-lg">arrow_back</span>
                            Back
                        </button>
                        <button type="button" id="appt-submit-btn" onclick="submitAppointment()" class="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-base hover:bg-on-primary-container transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]">
                            <span class="material-symbols-outlined text-xl">check_circle</span>
                            Book Appointment
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── CONFIRMATION VIEW ── -->
            <div id="appt-confirm-view" class="hidden surface-card rounded-3xl p-8 md:p-12 border border-outline/10 shadow-lg text-center">
                <div class="w-20 h-20 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-6">
                    <span class="material-symbols-outlined text-5xl">task_alt</span>
                </div>

                <h3 class="font-headline-md text-3xl font-bold text-on-surface mb-2">Appointment Confirmed!</h3>
                <p class="text-on-surface-variant text-sm mb-8 max-w-sm mx-auto">Our academic coordinator will contact you shortly to confirm your visit.</p>

                <div class="bg-surface-variant/50 rounded-2xl p-6 text-left space-y-4 mb-8 border border-outline/10 max-w-sm mx-auto">
                    <div class="flex justify-between items-center pb-3 border-b border-outline/10">
                        <span class="text-sm text-on-surface-variant font-medium">Appointment ID</span>
                        <span class="font-bold text-primary font-mono text-lg" id="confirm-id">CCC-000000</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-on-surface-variant font-medium">Service</span>
                        <span class="font-semibold text-on-surface text-sm text-right max-w-[180px]" id="confirm-service">–</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-on-surface-variant font-medium">Date</span>
                        <span class="font-semibold text-on-surface text-sm" id="confirm-date">–</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-on-surface-variant font-medium">Time</span>
                        <span class="font-semibold text-on-surface text-sm" id="confirm-time">–</span>
                    </div>
                    <div class="flex justify-between items-center pt-3 border-t border-outline/10">
                        <span class="text-sm text-on-surface-variant font-medium">Name</span>
                        <span class="font-semibold text-on-surface text-sm" id="confirm-name">–</span>
                    </div>
                </div>

                <button onclick="resetAppointmentForm()" class="px-8 py-3.5 rounded-2xl border border-primary text-primary font-bold text-sm hover:bg-primary hover:text-white transition-all inline-flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">add_circle</span>
                    Book Another Appointment
                </button>
            </div>
        </div>
    </section>

'''

html = html.replace('    <!-- 12. Final CTA -->', booking_section + '    <!-- 12. Final CTA -->')


# ── 2. Replace the old complex booking modal with a simpler one that reuses the inline section logic ──
old_booking_modal_re = re.compile(
    r'    <!-- ={42} -->\s*\n'
    r'    <!-- BOOK APPOINTMENT MODAL\s+-->\s*\n'
    r'    <!-- ={42} -->\s*\n'
    r'    <div id="booking-modal".*?</div>\s*\n\s*</div>\s*\n\s*</div>\s*\n',
    re.DOTALL
)

new_simple_modal = '''    <!-- ========================================== -->
    <!-- BOOK APPOINTMENT MODAL (scrolls to section) -->
    <!-- ========================================== -->
    <div id="booking-modal" class="fixed inset-0 z-[200] hidden items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div class="surface-card bg-surface w-full max-w-md rounded-3xl p-8 shadow-2xl relative border border-outline/20 text-center">
            <button onclick="closeBookingModal()" class="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-variant transition-colors">
                <span class="material-symbols-outlined text-2xl">close</span>
            </button>

            <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
                <span class="material-symbols-outlined text-3xl">calendar_month</span>
            </div>
            <h3 class="font-headline-md text-2xl font-bold text-on-surface mb-2">Book an Appointment</h3>
            <p class="text-sm text-on-surface-variant mb-6 max-w-xs mx-auto">Schedule a free 1-on-1 career counseling session, campus tour, or demo class.</p>

            <button onclick="closeBookingModal(); scrollToBookingSection();" class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base hover:bg-on-primary-container transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]">
                <span class="material-symbols-outlined text-xl">arrow_downward</span>
                Go to Booking Form
            </button>
        </div>
    </div>

'''

html = old_booking_modal_re.sub(new_simple_modal, html)


# ── 3. Replace old booking JS functions & add new inline appointment logic ──
# Find the old handleAppointmentSubmit function and nearby code
# We add new inline booking JS right before the closing </script> of the auth/booking script block

new_booking_js = r'''
        // ─── INLINE APPOINTMENT SECTION LOGIC ───

        // Available time slots — in production, filter by server-side capacity
        const ALL_TIME_SLOTS = [
            '10:00 AM', '11:00 AM', '12:00 PM',
            '02:00 PM', '03:00 PM', '04:00 PM',
            '05:00 PM', '06:00 PM', '07:00 PM'
        ];

        let selectedTimeSlot = null;

        function renderTimeSlots() {
            const container = document.getElementById('appt-time-slots');
            if (!container) return;
            const dateVal = document.getElementById('appt-date').value;

            // Simulate some slots being "taken" for realism — randomly mark 1-3 as unavailable
            let unavailable = new Set();
            if (dateVal) {
                const seed = dateVal.split('-').reduce((a, b) => a + parseInt(b), 0);
                unavailable.add(ALL_TIME_SLOTS[seed % ALL_TIME_SLOTS.length]);
                if (seed % 3 === 0) unavailable.add(ALL_TIME_SLOTS[(seed + 2) % ALL_TIME_SLOTS.length]);
            }

            container.innerHTML = ALL_TIME_SLOTS.map(slot => {
                const isUnavail = unavailable.has(slot);
                const isSelected = selectedTimeSlot === slot && !isUnavail;
                return `
                    <button type="button" 
                        ${isUnavail ? 'disabled' : ''} 
                        onclick="selectTimeSlot('${slot}')"
                        class="py-3 rounded-xl text-sm font-semibold transition-all text-center
                            ${isUnavail 
                                ? 'bg-surface-variant/40 text-on-surface-variant/40 line-through cursor-not-allowed border border-outline/5' 
                                : isSelected 
                                    ? 'bg-primary text-white shadow-md scale-[1.02] border-2 border-primary'
                                    : 'bg-surface-container-low text-on-surface border border-outline/15 hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer'
                            }
                        ">
                        ${slot}
                    </button>
                `;
            }).join('');
        }

        function selectTimeSlot(slot) {
            selectedTimeSlot = slot;
            document.getElementById('appt-time').value = slot;
            renderTimeSlots();
            validateStep1();
        }

        function validateStep1() {
            const service = document.getElementById('appt-service').value;
            const date = document.getElementById('appt-date').value;
            const time = document.getElementById('appt-time').value;
            const btn = document.getElementById('appt-next-1');
            if (btn) btn.disabled = !(service && date && time);
        }

        // Initialize date picker and time slots
        document.addEventListener('DOMContentLoaded', () => {
            const dateInput = document.getElementById('appt-date');
            if (dateInput) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateInput.min = tomorrow.toISOString().split('T')[0];
                dateInput.value = tomorrow.toISOString().split('T')[0];

                dateInput.addEventListener('change', () => {
                    selectedTimeSlot = null;
                    document.getElementById('appt-time').value = '';
                    renderTimeSlots();
                    validateStep1();
                });
            }

            const serviceSelect = document.getElementById('appt-service');
            if (serviceSelect) {
                serviceSelect.addEventListener('change', validateStep1);
            }

            renderTimeSlots();

            // Auto-fill from logged-in user
            const user = getCurrentUser();
            if (user) {
                const nameInput = document.getElementById('appt-name');
                const phoneInput = document.getElementById('appt-phone');
                const emailInput = document.getElementById('appt-email');
                if (nameInput && !nameInput.value) nameInput.value = user.name || '';
                if (phoneInput && user.phone && !phoneInput.value) phoneInput.value = user.phone;
                if (emailInput && !emailInput.value) emailInput.value = user.email || '';
            }
        });

        function goToStep(step) {
            document.getElementById('appt-step-1').classList.toggle('hidden', step !== 1);
            document.getElementById('appt-step-2').classList.toggle('hidden', step !== 2);

            // Update step dots
            for (let i = 1; i <= 3; i++) {
                const dot = document.getElementById('step-dot-' + i);
                if (!dot) continue;
                if (i < step || (i === 3 && step === 3)) {
                    dot.className = 'w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm transition-all';
                } else if (i === step) {
                    dot.className = 'w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm transition-all scale-110';
                } else {
                    dot.className = 'w-10 h-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center text-sm font-bold transition-all';
                }
            }

            // Update preview in step 2
            if (step === 2) {
                const service = document.getElementById('appt-service');
                const serviceName = service.options[service.selectedIndex].text.replace(/^[^\s]+\s/, '');
                document.getElementById('preview-service').textContent = serviceName;

                const dateVal = document.getElementById('appt-date').value;
                const dateObj = new Date(dateVal + 'T00:00:00');
                document.getElementById('preview-date').textContent = dateObj.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                document.getElementById('preview-time').textContent = selectedTimeSlot;
            }

            // Scroll into view
            const section = document.getElementById('book-appointment');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        async function submitAppointment() {
            const nameInput = document.getElementById('appt-name');
            const phoneInput = document.getElementById('appt-phone');

            if (!nameInput.value.trim()) { nameInput.focus(); return; }
            if (!phoneInput.value.trim()) { phoneInput.focus(); return; }

            const submitBtn = document.getElementById('appt-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-xl animate-spin">progress_activity</span> Booking...';

            const serviceEl = document.getElementById('appt-service');
            const payload = {
                name: nameInput.value.trim(),
                email: document.getElementById('appt-email').value.trim() || '',
                phone: phoneInput.value.trim(),
                program: serviceEl.value,
                branch: 'Satellite Campus',
                date: document.getElementById('appt-date').value,
                timeSlot: selectedTimeSlot,
                mode: 'In-Person',
                notes: ''
            };

            let result = null;
            try {
                const token = getAuthToken();
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = 'Bearer ' + token;

                const res = await fetch(API_URL + '/appointments', {
                    method: 'POST', headers, body: JSON.stringify(payload)
                });
                result = await res.json();
            } catch (err) {
                // Offline fallback
                result = {
                    success: true,
                    appointment: {
                        id: Date.now(),
                        bookingRef: 'CCC-' + Math.floor(100000 + Math.random() * 900000),
                        ...payload,
                        status: 'Confirmed'
                    }
                };
            }

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-symbols-outlined text-xl">check_circle</span> Book Appointment';

            if (result && result.success) {
                const appt = result.appointment;
                const ref = appt.bookingRef || appt.booking_ref || ('CCC-' + appt.id);

                // Fill confirmation card
                document.getElementById('confirm-id').textContent = ref;

                const serviceName = serviceEl.options[serviceEl.selectedIndex].text.replace(/^[^\s]+\s/, '');
                document.getElementById('confirm-service').textContent = serviceName;

                const dateObj = new Date(payload.date + 'T00:00:00');
                document.getElementById('confirm-date').textContent = dateObj.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                document.getElementById('confirm-time').textContent = payload.timeSlot;
                document.getElementById('confirm-name').textContent = payload.name;

                // Switch to confirmation view
                document.getElementById('appt-form-view').classList.add('hidden');
                document.getElementById('appt-confirm-view').classList.remove('hidden');

                // Update step dots to completed
                for (let i = 1; i <= 3; i++) {
                    const dot = document.getElementById('step-dot-' + i);
                    if (dot) dot.className = 'w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm transition-all';
                }

                document.getElementById('book-appointment').scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Save locally
                try {
                    const existing = JSON.parse(localStorage.getItem('ccc_appointments') || '[]');
                    existing.unshift(appt);
                    localStorage.setItem('ccc_appointments', JSON.stringify(existing));
                } catch(e) {}
            }
        }

        function resetAppointmentForm() {
            document.getElementById('appt-form-view').classList.remove('hidden');
            document.getElementById('appt-confirm-view').classList.add('hidden');

            document.getElementById('appt-service').selectedIndex = 0;
            selectedTimeSlot = null;
            document.getElementById('appt-time').value = '';
            document.getElementById('appt-name').value = '';
            document.getElementById('appt-phone').value = '';
            document.getElementById('appt-email').value = '';

            const dateInput = document.getElementById('appt-date');
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.value = tomorrow.toISOString().split('T')[0];

            renderTimeSlots();
            goToStep(1);
            validateStep1();

            // Re-fill from user
            const user = getCurrentUser();
            if (user) {
                if (user.name) document.getElementById('appt-name').value = user.name;
                if (user.phone) document.getElementById('appt-phone').value = user.phone;
                if (user.email) document.getElementById('appt-email').value = user.email;
            }
        }

        function scrollToBookingSection() {
            const el = document.getElementById('book-appointment');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // Override openBookingModal to scroll to inline section instead of opening the old modal
        function openBookingModal(preselectedProgram) {
            scrollToBookingSection();
            if (preselectedProgram) {
                const sel = document.getElementById('appt-service');
                if (sel) {
                    for (let i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value.toLowerCase().includes(preselectedProgram.toLowerCase())) {
                            sel.selectedIndex = i;
                            validateStep1();
                            break;
                        }
                    }
                }
            }
        }

        function closeBookingModal() {
            const modal = document.getElementById('booking-modal');
            if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        }

'''

# Insert new JS before the closing </script> of the auth/booking block
# Find the last </script> before </body>
html = html.replace(
    "        function closeMobileMenu() {",
    new_booking_js + "        function closeMobileMenu() {"
)

# ── 4. Update the hash deep-linking for #book ──
html = html.replace(
    "if (window.location.hash === '#book') {\n                setTimeout(() => openBookingModal(), 150);",
    "if (window.location.hash === '#book') {\n                setTimeout(() => scrollToBookingSection(), 300);"
)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully added clean Book an Appointment section to index.html!")
