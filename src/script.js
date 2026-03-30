// --- Initial State & Selectors ---

lucide.createIcons();

const API_BASE_URL = 'http://localhost:8000/api';
const header = document.querySelector('.header');
const authBtn = document.getElementById('auth-btn');

const ndaModal = document.getElementById('nda-modal');
const loginModal = document.getElementById('login-modal');
const profileModal = document.getElementById('profile-modal');

const ndaRegisterForm = document.getElementById('nda-register-form');
const loginFormPublic = document.getElementById('login-form-public');

let currentUser = JSON.parse(sessionStorage.getItem('kazgeo_current_user')) || null;

// --- Initialization ---

function init() {
    setupEventListeners(); // Set listeners first
    updateAuthUI();
    revealOnScroll();
}

function updateAuthUI() {
    const lang = getActiveLang();
    if (!authBtn) return;

    if (currentUser) {
        authBtn.textContent = currentUser.name || "User";
        authBtn.classList.add('user-active');
    } else {
        const text = lang === 'ru' ? 'Войти' : 'Login';
        authBtn.textContent = text;
        authBtn.classList.remove('user-active');
    }
}

function getActiveLang() {
    const activeBtn = document.querySelector('.lang-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-lang') : 'ru';
}

// --- Auth Actions ---

async function handleLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            currentUser = await response.json();
            sessionStorage.setItem('kazgeo_current_user', JSON.stringify(currentUser));
            closeLoginModal();
            updateAuthUI();
            // Redirect to profile page after login
            window.location.href = 'profile.html';
        } else {
            const err = await response.json();
            alert(err.detail || (getActiveLang() === 'ru' ? "Неверный email или пароль" : "Invalid email or password"));
        }
    } catch (error) {
        console.error("Login failed:", error);
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('kazgeo_current_user');
    closeProfileModal();
    updateAuthUI();
    window.location.reload();
}

// --- Modal Controls ---

function openNDAModal() {
    if (loginModal) loginModal.style.display = 'none';
    ndaModal.style.display = 'flex';
    showNDAStep(1);
}

function closeNDAModal() {
    ndaModal.style.display = 'none';
}

function openLoginModal() {
    if (ndaModal) ndaModal.style.display = 'none';
    loginModal.style.display = 'flex';
}

function closeLoginModal() {
    loginModal.style.display = 'none';
}

function openProfilePage() {
    window.location.href = 'profile.html';
}

function closeProfileModal() {
    profileModal.style.display = 'none';
}

function showNDAStep(step) {
    document.getElementById('nda-step-1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('nda-step-2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('nda-step-3').style.display = step === 3 ? 'block' : 'none';
}

// --- Form Submissions ---

ndaRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('nda-name').value;
    const email = document.getElementById('nda-email').value;
    const password = document.getElementById('nda-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (response.ok) {
            currentUser = await response.json();
            sessionStorage.setItem('kazgeo_current_user', JSON.stringify(currentUser));
            showNDAStep(2);
            updateAuthUI();
        } else {
            const err = await response.json();
            alert(err.detail || (getActiveLang() === 'ru' ? "Ошибка при регистрации" : "Error during registration"));
        }
    } catch (error) {
        console.error("Reg failed:", error);
    }
});

document.getElementById('nda-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('nda-file');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('email', currentUser.email);
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch(`${API_BASE_URL}/submit-nda`, {
            method: 'POST',
            body: formData
        });
        if (response.ok) showNDAStep(3);
    } catch (error) {
        console.error("Upload failed:", error);
    }
});

loginFormPublic.addEventListener('submit', handleLogin);

// --- Navigation & Core UI ---

async function handleDocumentClick(file, titleRu, titleEn) {
    const lang = getActiveLang();
    
    if (!currentUser) {
        openLoginModal();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/check-access/${currentUser.email}`);
        const data = await response.json();

        if (data.approved) {
            const link = document.createElement('a');
            link.href = file;
            link.download = file;
            link.click();
        } else {
            alert(lang === 'ru' ? "Сначала необходимо подписать NDA и дождаться одобрения." : "Sign NDA first and wait for approval.");
            openProfilePage();
        }
    } catch (error) {
        console.error("Access check error:", error);
    }
}

function setupEventListeners() {
    // Handle auth button click
    if (authBtn) {
        authBtn.addEventListener('click', (e) => {
            const user = JSON.parse(sessionStorage.getItem('kazgeo_current_user'));
            console.log("Auth button clicked, current session user:", !!user);
            if (user) {
                openProfilePage();
            } else {
                openLoginModal();
            }
        });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
        revealOnScroll();
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('[data-ru]').forEach(el => {
                const text = el.getAttribute(`data-${lang}`);
                if (text) {
                    const icon = el.querySelector('i');
                    if (icon) {
                        el.innerHTML = '';
                        el.appendChild(icon);
                        el.appendChild(document.createTextNode(' ' + text));
                    } else el.textContent = text;
                }
            });
            updateAuthUI(); // Refresh Login button text
        });
    });
}

const revealOnScroll = () => {
    document.querySelectorAll('.reveal').forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight - 100) el.classList.add('active');
    });
};

// Global Exposure
window.handleDocumentClick = handleDocumentClick;
window.openNDAModal = openNDAModal;
window.closeNDAModal = closeNDAModal;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openProfilePage = openProfilePage;
window.handleLogout = handleLogout;
window.showNDAStep = showNDAStep;

init();
