// --- Admin Logic (Backend Powered) ---

const API_BASE_URL = 'http://localhost:8000/api';
const ADMIN_PASSWORD_SECRET = 'admin123';
const LOGIN_KEY = 'kazgeo_admin_logged_in';

// State
let users = [];
let requests = [];
let documents = [];
let editingUserId = null;

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
const cOk = document.getElementById('confirm-ok');
const cCancel = document.getElementById('confirm-cancel');

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
    // Fetch both to ensure they are available for merged rendering
    await fetchRequests(); 
    await renderUsers();
    await renderDocuments();
}

async function fetchRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/requests`, {
            headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
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

        if (tab === 'users') {
            await fetchRequests();
            await renderUsers();
        }
        if (tab === 'documents') await renderDocuments();
    });
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    
    if (password === ADMIN_PASSWORD_SECRET) {
        sessionStorage.setItem(LOGIN_KEY, 'true');
        showAdminPanel();
        loginError.style.display = 'none';
    } else {
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem(LOGIN_KEY);
    showLogin();
});

// --- User Management Functions ---

async function renderUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
        });
        if (!response.ok) throw new Error('Unauthorized');
        users = await response.json();
        
        userList.innerHTML = '';
        users.forEach(user => {
            // Find request for this user
            const req = requests.find(r => r.email === user.email);
            
            let ndaContent = '<span class="role-badge viewer">Нет запроса</span>';
            if (req) {
                const fileName = req.file_path.split('/').pop();
                const publicUrl = `http://localhost:8000/api/uploads/${fileName}`;
                const statusLabel = req.status === 'approved' ? 'ОДОБРЕН' : req.status === 'rejected' ? 'ОТКЛОНЕН' : 'ОЖИДАЕТ';
                
                // Only show download link when pending for review
                const fileLink = req.status === 'pending' 
                    ? `<a href="${publicUrl}" target="_blank" class="btn-link" style="font-size: 0.7rem;">Проверить NDA.docx</a>` 
                    : '';
                
                ndaContent = `
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span class="role-badge ${req.status}">${statusLabel}</span>
                        ${fileLink}
                    </div>
                `;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${ndaContent}</td>
                <td><span class="role-badge ${user.is_approved ? 'approved' : 'pending'}">${user.is_approved ? 'Активен' : 'Ожидает'}</span></td>
                <td class="actions">
                    ${req && req.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="approveRequest(${req.id})" title="Одобрить NDA">Одобрить NDA</button>
                    ` : ''}
                    ${!user.is_approved && (!req || req.status === 'approved') ? `
                        <button class="btn btn-primary btn-sm" onclick="approveUser(${user.id})">Активировать</button>
                    ` : ''}
                    <button class="btn-icon delete" onclick="deleteUser(${user.id})"><i data-lucide="trash-2"></i></button>
                </td>
            `;
            userList.appendChild(tr);
        });
        lucide.createIcons();
    } catch (error) {
        console.error("Failed to fetch users:", error);
        alert("Ошибка при загрузке списка пользователей. Возможно, сессия истекла.");
    }
}

async function deleteUser(id) {
    showConfirmDialog({
        title: 'Удалить пользователя?',
        msg: 'Это действие необратимо. Пользователь потеряет доступ к системе.',
        icon: 'warning',
        confirmText: 'Удалить',
        onConfirm: () => {
             alert("Удаление пользователя еще не реализовано на бэкенде в целях безопасности.");
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
            headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET },
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
                    headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
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
                    headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
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
                    headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
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
                    headers: { 'X-Admin-Password': ADMIN_PASSWORD_SECRET }
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
    const newCancel = cCancel.cloneNode(true);
    cCancel.parentNode.replaceChild(newCancel, cCancel);

    newOk.addEventListener('click', () => {
        onConfirm();
        confirmModal.style.display = 'none';
    });

    newCancel.addEventListener('click', () => {
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

// Initialize
init();
