/**
 * Cube Cad Center - Site Configuration & Business Constants
 * 
 * Fill in official verified values below.
 * Any field left null or empty string ("") is automatically hidden
 * on the website so visitors never see template brackets like [NUMBER] or [FEES].
 */
const SITE_CONFIG = {
    // 1. Legal Entity & Governance (used in Privacy Policy & Terms of Service)
    legalEntityName: "", // TODO: Official registered business entity (e.g. "Cube Cad Center LLP")
    brandName: "Cube Cad Center",
    domain: "https://cubecadcenter.co",
    primaryCity: "Ahmedabad",
    primaryState: "Gujarat",

    // 2. Training Institute Credentials & Affiliations
    // Set to your official status, or leave empty if independent training
    authorizationCredential: "", // TODO: e.g. "Autodesk Authorized Training Center" (or leave empty)

    // 3. Impact & Trust Numbers (Hero Statistics Strip)
    // Keep null until verified. Cards with null/empty values are hidden automatically.
    stats: {
        studentsTrained: "2,500+",      // TODO: e.g. "5,000+" (Leave null if unverified)
        programsOffered: 17,        // Verified: 17 specialized CAD, BIM & MEP programs
        yearsInAhmedabad: "2",     // TODO: e.g. "10+" (Leave null if unverified)
        careerSupport: "Dedicated Portfolio & Placement Support"         // TODO: e.g. "Placement Assistance" (Leave null if unverified)
    },

    // 4. Featured Course Metadata Defaults
    // Durations, batch schedules, and fees. Hidden automatically if null.
    programs: {
        autocad: {
            duration: null,         // TODO: e.g. "6 Weeks"
            batchTimings: null,     // TODO: e.g. "Morning & Evening"
            fees: null              // TODO: e.g. "Contact for Fees"
        },
        revit: {
            duration: null,         // TODO: e.g. "8 Weeks"
            batchTimings: null,     // TODO: e.g. "Flexible Batches"
            fees: null              // TODO: e.g. "Contact for Fees"
        },
        sketchup: {
            duration: null,         // TODO: e.g. "4 Weeks"
            batchTimings: null,     // TODO: e.g. "Weekend & Weekday"
            fees: null              // TODO: e.g. "Contact for Fees"
        }
    }
};

/**
 * Automatically applies configuration constants to DOM elements across the site.
 */
function applySiteConfig() {
    if (typeof document === 'undefined') return;

    // A. Legal Entity Name replacements
    const legalName = (SITE_CONFIG.legalEntityName && SITE_CONFIG.legalEntityName.trim()) 
        ? SITE_CONFIG.legalEntityName.trim() 
        : SITE_CONFIG.brandName;
    document.querySelectorAll('[data-config="legalEntityName"]').forEach(el => {
        el.textContent = legalName;
    });

    // B. Authorization Credential
    const authCredential = (SITE_CONFIG.authorizationCredential && SITE_CONFIG.authorizationCredential.trim())
        ? SITE_CONFIG.authorizationCredential.trim()
        : null;
    document.querySelectorAll('[data-config="authorizationCredential"]').forEach(el => {
        if (authCredential) {
            el.textContent = authCredential;
            if (el.parentElement) el.parentElement.style.display = '';
        } else {
            if (el.parentElement) el.parentElement.style.display = 'none';
        }
    });

    // C. Trust / Statistics Section
    const statStudents = document.getElementById('stat-students');
    const statStudentsVal = document.getElementById('stat-students-val');
    const statPrograms = document.getElementById('stat-programs');
    const statProgramsVal = document.getElementById('stat-programs-val');
    const statYears = document.getElementById('stat-years');
    const statYearsVal = document.getElementById('stat-years-val');
    const statCareer = document.getElementById('stat-career');
    const statCareerSub = document.getElementById('stat-career-sub');
    const statsGrid = document.getElementById('stats-grid');
    const statsSection = document.getElementById('stats-section');

    let visibleStatsCount = 0;

    if (statStudents && statStudentsVal) {
        if (SITE_CONFIG.stats.studentsTrained) {
            statStudentsVal.textContent = SITE_CONFIG.stats.studentsTrained;
            statStudents.style.display = 'flex';
            visibleStatsCount++;
        } else {
            statStudents.style.display = 'none';
        }
    }

    if (statPrograms && statProgramsVal) {
        if (SITE_CONFIG.stats.programsOffered) {
            statProgramsVal.textContent = SITE_CONFIG.stats.programsOffered;
            statPrograms.style.display = 'flex';
            visibleStatsCount++;
        } else {
            statPrograms.style.display = 'none';
        }
    }

    if (statYears && statYearsVal) {
        if (SITE_CONFIG.stats.yearsInAhmedabad) {
            statYearsVal.textContent = SITE_CONFIG.stats.yearsInAhmedabad;
            statYears.style.display = 'flex';
            visibleStatsCount++;
        } else {
            statYears.style.display = 'none';
        }
    }

    if (statCareer && statCareerSub) {
        if (SITE_CONFIG.stats.careerSupport) {
            statCareerSub.textContent = SITE_CONFIG.stats.careerSupport;
            statCareer.style.display = 'flex';
            visibleStatsCount++;
        } else {
            statCareer.style.display = 'none';
        }
    }

    if (statsGrid) {
        // Adjust grid layout dynamically based on how many stats have verified values
        if (visibleStatsCount === 0) {
            if (statsSection) statsSection.style.display = 'none';
            else statsGrid.style.display = 'none';
        } else {
            if (statsSection) statsSection.style.display = '';
            statsGrid.style.display = 'grid';
            
            // Clean previous dynamic grid classes
            statsGrid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'md:grid-cols-4', 'sm:grid-cols-2', 'sm:grid-cols-3', 'max-w-md', 'max-w-xl', 'max-w-3xl');
            
            if (visibleStatsCount === 1) {
                statsGrid.classList.add('grid-cols-1', 'max-w-md', 'mx-auto');
                statsGrid.classList.remove('sm:divide-x');
            } else if (visibleStatsCount === 2) {
                statsGrid.classList.add('grid-cols-2', 'max-w-xl', 'mx-auto', 'sm:divide-x');
            } else if (visibleStatsCount === 3) {
                statsGrid.classList.add('grid-cols-1', 'sm:grid-cols-3', 'max-w-3xl', 'mx-auto', 'sm:divide-x');
            } else {
                statsGrid.classList.add('grid-cols-2', 'md:grid-cols-4', 'sm:divide-x');
            }
        }
    }

    // D. Course Metadata (Duration, Batch, Fees)
    ['autocad', 'revit', 'sketchup'].forEach(courseId => {
        const metaRow = document.getElementById(`course-meta-${courseId}`);
        const prog = SITE_CONFIG.programs[courseId];
        if (!metaRow) return;

        if (prog && (prog.duration || prog.batchTimings || prog.fees)) {
            metaRow.style.display = '';
            const durEl = metaRow.querySelector('.course-meta-duration');
            const batchEl = metaRow.querySelector('.course-meta-batch');
            const feeEl = metaRow.querySelector('.course-meta-fee');
            
            if (durEl) {
                if (prog.duration) {
                    durEl.textContent = prog.duration;
                    durEl.parentElement.style.display = '';
                } else {
                    durEl.parentElement.style.display = 'none';
                }
            }
            if (batchEl) {
                if (prog.batchTimings) {
                    batchEl.textContent = prog.batchTimings;
                    batchEl.parentElement.style.display = '';
                } else {
                    batchEl.parentElement.style.display = 'none';
                }
            }
            if (feeEl) {
                if (prog.fees) {
                    feeEl.textContent = prog.fees;
                    feeEl.parentElement.style.display = '';
                } else {
                    feeEl.parentElement.style.display = 'none';
                }
            }
        } else {
            // Completely hide empty metadata row if no values exist
            metaRow.style.display = 'none';
        }
    });
}

// Auto-run when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySiteConfig);
    } else {
        applySiteConfig();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITE_CONFIG, applySiteConfig };
}
