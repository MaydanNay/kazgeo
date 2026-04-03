// Initialize Lucide icons
lucide.createIcons();

const API_BASE_URL = 'http://localhost:8000/api';
let currentUser = JSON.parse(sessionStorage.getItem('kazgeo_current_user')) || null;

// --- Protection Check ---
if (!currentUser) {
    window.location.href = 'index.html';
}

// --- Initialization ---
function init() {
    loadProfileDetails();
    setupLanguageSwitcher();
    updateWelcomeMsg();
}

async function loadProfileDetails() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/profile/${currentUser.email}`);
        if (!response.ok) throw new Error("Failed to fetch profile");

        const data = await response.json();
        const user = data.user;
        const lang = getActiveLang();

        // Update basic info
        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-created').textContent = new Date(user.created_at).toLocaleDateString();
        document.getElementById('welcome-msg').textContent = (lang === 'ru' ? 'С возвращением, ' : 'Welcome back, ') + user.name;

        // Update Status Card
        const statusBadge = document.getElementById('status-badge');
        const statusText = document.getElementById('status-text');
        const statusDesc = document.getElementById('status-desc');

        if (user.is_approved) {
            statusBadge.className = 'status-badge-lg approved';
            statusText.textContent = lang === 'ru' ? 'Доступ Одобрен' : 'Access Approved';
            statusDesc.textContent = lang === 'ru'
                ? 'Вам предоставлен полный доступ к документам проекта. Теперь вы можете скачать презентацию и другие материалы.'
                : 'You have been granted full access to the project documents. You can now download the presentation and other materials.';

            await loadApprovedDocuments();
        } else {
            statusBadge.className = 'status-badge-lg pending';
            statusText.textContent = lang === 'ru' ? 'На проверке' : 'Pending Review';
            statusDesc.textContent = lang === 'ru'
                ? 'Ваша заявка на доступ к документам находится на рассмотрении. Обычно это занимает не более 24 часов.'
                : 'Your document access request is currently under review. This usually takes less than 24 hours.';

            document.getElementById('dashboard-docs-grid').innerHTML = `
                <div class="empty-docs-msg">
                    <p data-ru="Документы будут доступны после одобрения NDA администратором." 
                       data-en="Documents will be available after the NDA is approved by admin.">
                        ${lang === 'ru' ? 'Документы будут доступны после одобрения NDA администратором.' : 'Documents will be available after the NDA is approved by admin.'}
                    </p>
                </div>
            `;
        }

    } catch (error) {
        console.error("Dashboard error:", error);
        alert("Server error. Please try again later.");
    }
}

async function loadApprovedDocuments() {
    const lang = getActiveLang();
    const docsGrid = document.getElementById('dashboard-docs-grid');

    try {
        const response = await fetch(`${API_BASE_URL}/documents?t=${Date.now()}`);
        const docs = await response.json();

        if (docs.length === 0) {
            docsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">${lang === 'ru' ? 'Документы пока не добавлены.' : 'No documents added yet.'}</p>`;
            return;
        }

        docsGrid.innerHTML = docs.map(doc => {
            // Map file path to public URL
            // doc.file_path is like "backend/uploads/documents/file.pdf"
            // We need to serve it via "/api/uploads/documents/file.pdf"
            const publicUrl = `http://localhost:8000/api/uploads/documents/${doc.file_path.split('/').pop()}`;

            // Map icon based on type
            let icon = 'file-text';
            if (['pdf'].includes(doc.file_type)) icon = 'file-text';
            if (['xls', 'xlsx', 'csv'].includes(doc.file_type)) icon = 'database';
            if (['ppt', 'pptx'].includes(doc.file_type)) icon = 'presentation';
            if (['doc', 'docx'].includes(doc.file_type)) icon = 'type';

            return `
                <div class="doc-card-premium animate">
                    <div class="doc-icon-wrapper">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="doc-details">
                        <h3>${lang === 'ru' ? doc.title_ru : doc.title_en}</h3>
                        <p>${doc.file_type.toUpperCase()} | ${doc.file_size}</p>
                    </div>
                    <a href="${publicUrl}" download="${lang === 'ru' ? doc.title_ru : doc.title_en}.${doc.file_type}" class="btn btn-sm btn-primary">Download</a>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    } catch (error) {
        console.error("Failed to load documents:", error);
    }
}

function handleLogout() {
    sessionStorage.removeItem('kazgeo_current_user');
    window.location.href = 'index.html';
}

function getActiveLang() {
    const activeLangBtn = document.querySelector('.lang-btn.active');
    return activeLangBtn ? activeLangBtn.getAttribute('data-lang') : 'ru';
}

function setupLanguageSwitcher() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Translate all elements with data-ru/data-en
            document.querySelectorAll('[data-ru]').forEach(el => {
                const text = el.getAttribute(`data-${lang}`);
                if (text) el.textContent = text;
            });

            loadProfileDetails(); // Refresh dynamic content
        });
    });
}

function updateWelcomeMsg() {
    if (currentUser) {
        const lang = getActiveLang();
        document.getElementById('welcome-msg').textContent = (lang === 'ru' ? 'С возвращением, ' : 'Welcome back, ') + currentUser.name;
    }
}

// Global exposure
window.handleLogout = handleLogout;

init();
