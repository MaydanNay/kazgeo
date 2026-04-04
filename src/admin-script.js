// --- Admin Logic (Backend Powered) ---

const API_BASE_URL = window.location.port === '3000' ? 'http://localhost:8000/api' : '/api';
const UPLOAD_BASE = window.location.port === '3000' ? 'http://localhost:8000/api/uploads' : '/api/uploads';
const LOGIN_KEY = 'kazgeo_admin_logged_in';
const ADMIN_SECRET_KEY = 'kazgeo_admin_secret'; // Key to store the password in session

// State
let users = [];
let requests = [];
let documents = [];
let editingUserId = null;

// --- Helper Functions ---
function cleanFilename(filename) {
    if (!filename) return "";
    // Pattern: template_uuid_filename
    if (filename.startsWith('template_')) {
        const parts = filename.split('_');
        if (parts.length >= 3) {
            return parts.slice(2).join('_');
        }
    }
    // Pattern: uuid_filename
    const parts = filename.split('_');
    if (parts.length >= 2 && parts[0].length === 36 && parts[0].includes('-')) {
        return parts.slice(1).join('_');
    }
    return filename;
}

// Selectors
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userList = document.getElementById('user-list');
const requestList = document.getElementById('request-list');
const addUserBtn = document.getElementById('add-user-btn');
const logoutBtn = document.getElementById('logout-btn');
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const modalTitle = document.getElementById('modal-title');
const cancelModal = document.getElementById('cancel-modal');
const tabBtns = document.querySelectorAll('.tab-btn');
const viewSections = document.querySelectorAll('.view-section');

// Document Selectors
const docList = document.getElementById('doc-list');
const docModal = document.getElementById('doc-modal');
const docForm = document.getElementById('doc-form');
const addDocBtn = document.getElementById('add-doc-btn');
const cancelDocModal = document.getElementById('cancel-doc-modal');

// Confirm Modal Selectors
const confirmModal = document.getElementById('confirm-modal');
const cIconBox = document.getElementById('confirm-icon-box');
const cIconEl = document.getElementById('confirm-icon-el');
const cTitle = document.getElementById('confirm-title');
const cMsg = document.getElementById('confirm-msg');
let cOk = document.getElementById('confirm-ok');
let cCancel = document.getElementById('confirm-cancel');

// --- Initialization ---

async function init() {
    if (sessionStorage.getItem(LOGIN_KEY) === 'true') {
        showAdminPanel();
    } else {
        showLogin();
    }
}

// --- Auth Functions ---

function showLogin() {
    loginSection.style.display = 'block';
    adminPanel.style.display = 'none';
}

async function showAdminPanel() {
    loginSection.style.display = 'none';
    adminPanel.style.display = 'block';
    await refreshData();
}

async function refreshData() {
    await fetchRequests(); 
    await renderUsers();
    await renderRequests();
    await fetchNDATemplate();
    await renderDocuments();
}

async function fetchRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/requests`, {
            headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
        });
        if (response.ok) {
            requests = await response.json();
        }
    } catch (error) {
        console.error("Failed to fetch requests:", error);
    }
}

// --- Tab Switching ---

tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const tab = btn.getAttribute('data-tab');
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        viewSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `${tab}-view`) {
                section.classList.add('active');
            }
        });

        if (tab === 'users') await renderUsers();
        if (tab === 'requests') {
            await renderRequests();
            updatePendingBadge();
        }
        if (tab === 'documents') {
            await fetchNDATemplate();
            await renderDocuments();
        }
    });
});

let currentNDATemplate = null;

async function fetchNDATemplate() {
    try {
        const response = await fetch(`${API_BASE_URL}/nda-template`);
        if (response.ok) {
            currentNDATemplate = await response.json();
            renderNDATemplate();
        }
    } catch (e) {
        console.error("Failed to fetch NDA template:", e);
    }
}

function renderNDATemplate() {
    const nameEl = document.getElementById('nda-template-name');
    const detailsEl = document.getElementById('nda-template-details');
    const viewBtn = document.getElementById('view-template-btn');

    if (currentNDATemplate) {
        const fileName = currentNDATemplate.file_path.split('/').pop();
        const cleanName = cleanFilename(fileName);
        nameEl.textContent = cleanName; 
        detailsEl.innerHTML = `
            <span style="display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="file-text" style="width: 14px; height: 14px;"></i> ${currentNDATemplate.file_type.toUpperCase()}</span>
            <span style="display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="database" style="width: 14px; height: 14px;"></i> ${currentNDATemplate.file_size}</span>
            <span style="display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="clock" style="width: 14px; height: 14px;"></i> ${new Date(currentNDATemplate.created_at).toLocaleDateString('ru-RU')}</span>
        `;
        viewBtn.disabled = false;
        viewBtn.onclick = () => {
             const publicUrl = `${UPLOAD_BASE}/documents/${fileName}`;
             window.open(publicUrl, '_blank');
        };
    } else {
        nameEl.textContent = "Шаблон не установлен";
        detailsEl.innerHTML = "Загрузите файл, который инвесторы будут скачивать для ознакомления и подписи.";
        viewBtn.disabled = true;
    }
    lucide.createIcons();
}

// NDA Template Event Listeners
const changeTemplateBtn = document.getElementById('change-template-btn');
const ndaTemplateInput = document.getElementById('nda-template-input');

if (changeTemplateBtn && ndaTemplateInput) {
    changeTemplateBtn.addEventListener('click', () => {
        ndaTemplateInput.click();
    });

    ndaTemplateInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        const btn = document.getElementById('change-template-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="spinner"></i> Загрузка...';

        try {
            const response = await fetch(`${API_BASE_URL}/admin/nda-template/upload`, {
                method: 'POST',
                headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) },
                body: formData
            });

            if (response.ok) {
                alert("Шаблон успешно обновлен!");
                await fetchNDATemplate();
                await renderDocuments();
            } else {
                alert("Ошибка при загрузке шаблона.");
            }
        } catch (error) {
            console.error("Template upload error:", error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            e.target.value = ''; // Reset input
        }
    });
}

function updatePendingBadge() {
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const tab = document.querySelector('.tab-btn[data-tab="requests"]');
    if (tab) {
        if (pendingCount > 0) {
            tab.innerHTML = `Заявки NDA <span class="pending-badge" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.65rem; margin-left: 5px;">${pendingCount}</span>`;
        } else {
            tab.innerHTML = 'Заявки NDA';
        }
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    // Validate password by attempting a simple API call
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'X-Admin-Password': password }
        });
        
        if (response.ok) {
            sessionStorage.setItem(LOGIN_KEY, 'true');
            sessionStorage.setItem(ADMIN_SECRET_KEY, password);
            showAdminPanel();
            loginError.style.display = 'none';
        } else {
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error("Login verification failed:", error);
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(LOGIN_KEY);
    sessionStorage.removeItem(ADMIN_SECRET_KEY);
    showLogin();
});

// --- User Management Functions ---

async function renderUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
        });
        if (!response.ok) throw new Error('Unauthorized');
        users = await response.json();
        
        userList.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    <span class="role-badge ${user.is_approved ? 'approved' : 'pending'}">
                        ${user.is_approved ? 'Активен' : 'Ожидает доступа'}
                    </span>
                </td>
                <td class="actions">
                    ${!user.is_approved ? `
                        <button class="btn btn-primary btn-sm" onclick="approveUser(${user.id})">Активировать вручную</button>
                    ` : ''}
                    <button class="btn-icon delete" onclick="deleteUser(${user.id})" title="Удалить аккаунт">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
            userList.appendChild(tr);
        });
        lucide.createIcons();
    } catch (error) {
        console.error("Failed to fetch users:", error);
    }
}

async function renderRequests() {
    try {
        await fetchRequests(); 
        requestList.innerHTML = '';
        
        // Sort by timestamp descending
        const sortedRequests = [...requests].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedRequests.forEach(req => {
                const fileName = req.file_path ? req.file_path.split('/').pop() : 'document';
                const publicUrl = req.file_path ? `${UPLOAD_BASE}/${fileName}` : '#';
                const statusLabel = req.status === 'approved' ? 'ОДОБРЕН' : req.status === 'rejected' ? 'ОТКЛОНЕН' : 'ОЖИДАЕТ';
            const date = new Date(req.timestamp).toLocaleDateString('ru-RU', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${req.id}</td>
                <td>
                    <div style="font-weight: 500;">${req.name}</div>
                    <div style="font-size: 0.75rem; color: #999;">${req.email}</div>
                </td>
                <td style="font-size: 0.75rem;">${date}</td>
                <td><span class="role-badge ${req.status}">${statusLabel}</span></td>
                <td>
                    <a href="${publicUrl}" target="_blank" class="btn-link" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                        <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> ${cleanFilename(fileName)}
                    </a>
                </td>
                <td class="actions">
                    ${req.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="approveRequest(${req.id})">Одобрить</button>
                        <button class="btn btn-secondary btn-sm" onclick="rejectRequest(${req.id})">Отклонить</button>
                    ` : ''}
                    <button class="btn-icon delete" onclick="deleteNDARequest(${req.id})" title="Удалить заявку"><i data-lucide="trash-2"></i></button>
                </td>
            `;
            requestList.appendChild(tr);
        });
        lucide.createIcons();
        updatePendingBadge();
    } catch (error) {
        console.error("Failed to render requests:", error);
    }
}

async function deleteUser(id) {
    showConfirmDialog({
        title: 'Удалить пользователя?',
        msg: 'Это действие необратимо. Пользователь потеряет доступ к системе.',
        icon: 'warning',
        confirmText: 'Удалить',
        onConfirm: async () => {
             try {
                const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Пользователь успешно удален.");
                    await refreshData();
                } else {
                    const err = await response.json();
                    alert(err.detail || "Ошибка при удалении.");
                }
             } catch (error) {
                 console.error("Delete user failed:", error);
                 alert("Произошла ошибка при удалении пользователя.");
             }
        }
    });
}


addUserBtn.addEventListener('click', () => {
    editingUserId = null;
    modalTitle.textContent = 'Добавить пользователя';
    userForm.reset();
    userModal.style.display = 'flex';
});

cancelModal.addEventListener('click', () => {
    userModal.style.display = 'none';
});

// --- Document Management Functions ---

async function renderDocuments() {
    try {
        const response = await fetch(`${API_BASE_URL}/documents`);
        documents = await response.json();
        
        docList.innerHTML = '';
        documents.forEach(doc => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${doc.id}</td>
                <td>${doc.title_ru}</td>
                <td>${doc.title_en}</td>
                <td style="font-size: 0.7rem; color: #888;">${cleanFilename(doc.file_path.split('/').pop())}</td>
                <td>${doc.file_size}</td>
                <td><span class="role-badge viewer">${doc.file_type.toUpperCase()}</span></td>
                <td class="actions">
                    <button class="btn-icon delete" onclick="deleteDocument(${doc.id})"><i data-lucide="trash-2"></i></button>
                </td>
            `;
            docList.appendChild(tr);
        });
        lucide.createIcons();
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        alert("Ошибка при загрузке списка документов.");
    }
}

addDocBtn.addEventListener('click', () => {
    docForm.reset();
    docModal.style.display = 'flex';
});

cancelDocModal.addEventListener('click', () => {
    docModal.style.display = 'none';
});

docForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-doc-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Загрузка...';

    const formData = new FormData();
    formData.append('title_ru', document.getElementById('doc-title-ru').value);
    formData.append('title_en', document.getElementById('doc-title-en').value);
    formData.append('file', document.getElementById('doc-file').files[0]);

    try {
        const response = await fetch(`${API_BASE_URL}/admin/documents/upload`, {
            method: 'POST',
            headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) },
            body: formData
        });

        if (response.ok) {
            alert("Документ успешно загружен.");
            docModal.style.display = 'none';
            await renderDocuments();
        } else {
            const err = await response.json();
            alert("Ошибка загрузки: " + (err.detail || "Неизвестная ошибка"));
        }
    } catch (error) {
        console.error("Upload error:", error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Загрузить';
    }
});

async function deleteDocument(id) {
    showConfirmDialog({
        title: 'Удалить документ?',
        msg: 'Файл будет навсегда удален из системы и перестанет быть доступным для инвесторов.',
        icon: 'warning',
        confirmText: 'Удалить',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/documents/${id}`, {
                    method: 'DELETE',
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Документ успешно удален.");
                    await renderDocuments();
                }
            } catch (error) {
                console.error("Delete failed:", error);
                alert("Ошибка при удалении документа.");
            }
        }
    });
}

// --- NDA Request Functions ---


async function approveRequest(id) {
    showConfirmDialog({
        title: 'Одобрить доступ?',
        msg: 'Пользователь получит полный доступ к документам и презентации.',
        icon: 'check',
        confirmText: 'Одобрить',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/approve/${id}`, { 
                    method: 'POST',
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Запрос успешно одобрен.");
                    await refreshData();
                } else {
                    const err = await response.json();
                    alert(err.detail || "Ошибка при одобрении доступа.");
                }
            } catch (error) {
                console.error("Approval failed:", error);
                alert("Произошла ошибка при одобрении запроса.");
            }
        }
    });
}

async function rejectRequest(id) {
    showConfirmDialog({
        title: 'Отклонить запрос?',
        msg: 'Пользователю будет отказано в доступе к NDA-документам.',
        icon: 'warning',
        confirmText: 'Отклонить',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/reject/${id}`, { 
                    method: 'POST', 
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Запрос отклонен.");
                    await refreshData();
                } else {
                    const err = await response.json();
                    alert(err.detail || "Ошибка при отклонении запроса.");
                }
            } catch (error) {
                console.error("Rejection failed:", error);
                alert("Произошла ошибка при отклонении запроса.");
            }
        }
    });
}

async function viewNDA(id) {
    const req = requests.find(r => r.id === id);
    if (req) {
        window.open(req.file_path, '_blank');
    }
}

async function deleteNDARequest(id) {
    showConfirmDialog({
        title: 'Удалить запрос NDA?',
        msg: 'Файл будет навсегда удален. Это позволит пользователю загрузить новый документ.',
        icon: 'warning',
        confirmText: 'Удалить',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/requests/${id}`, {
                    method: 'DELETE',
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Запрос успешно удален.");
                    await refreshData();
                } else {
                    const err = await response.json();
                    alert(err.detail || "Ошибка при удалении запроса.");
                }
            } catch (error) {
                console.error("NDA delete failed:", error);
                alert("Ошибка при удалении запроса.");
            }
        }
    });
}

async function approveUser(user_id) {
    showConfirmDialog({
        title: 'Активировать аккаунт?',
        msg: 'Пользователь получит статус одобренного инвестора.',
        icon: 'check',
        confirmText: 'Активировать',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/approve-user/${user_id}`, { 
                    method: 'POST',
                    headers: { 'X-Admin-Password': sessionStorage.getItem(ADMIN_SECRET_KEY) }
                });
                if (response.ok) {
                    alert("Аккаунт пользователя активирован.");
                    await refreshData();
                } else {
                    const err = await response.json();
                    alert(err.detail || "Ошибка при активации аккаунта.");
                }
            } catch (error) {
                console.error("User approval failed:", error);
                alert("Произошла ошибка при активации аккаунта.");
            }
        }
    });
}

// --- Dynamic Modal Logic ---
function showConfirmDialog({ title, msg, icon, confirmText, onConfirm }) {
    cTitle.textContent = title;
    cMsg.textContent = msg;
    cOk.textContent = confirmText || 'OK';
    
    // Switch Icon/Color
    cIconBox.className = 'confirm-icon' + (icon === 'warning' ? ' warning' : '');
    cIconEl.setAttribute('data-lucide', icon === 'warning' ? 'alert-triangle' : 'check-circle');
    lucide.createIcons();

    confirmModal.style.display = 'flex';

    // Handle Buttons (Clean up previous listeners)
    const newOk = cOk.cloneNode(true);
    cOk.parentNode.replaceChild(newOk, cOk);
    cOk = newOk; // Update global reference to the new button in the DOM

    const newCancel = cCancel.cloneNode(true);
    cCancel.parentNode.replaceChild(newCancel, cCancel);
    cCancel = newCancel; // Update global reference

    cOk.addEventListener('click', () => {
        onConfirm();
        confirmModal.style.display = 'none';
    });

    cCancel.addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });
}


// Expose functions to global scope
window.deleteUser = deleteUser;
window.approveUser = approveUser;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.viewNDA = viewNDA;
window.deleteDocument = deleteDocument;
window.deleteNDARequest = deleteNDARequest;

// Initialize
init();
