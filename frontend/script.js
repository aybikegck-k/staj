document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Öğeleri ---
    const longUrlInput = document.getElementById('longUrlInput');
    const shortenBtn = document.getElementById('shortenBtn');
    const resultBox = document.getElementById('resultBox');
    const shortenedLink = document.getElementById('shortenedLink');
    const copyButton = document.getElementById('copyButton');
    const globalMessage = document.getElementById('globalMessage');

    const authSection = document.getElementById('authSection');
    const authTitle = document.getElementById('authTitle');
    const authButtons = document.getElementById('authButtons');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const logoutButton = document.getElementById('logoutButton');

    const loggedInUserSection = document.getElementById('loggedInUserSection');
    const userDisplay = document.getElementById('userDisplay');

    const listUrlsBtn = document.getElementById('listUrlsBtn');
    const urlsListDiv = document.getElementById('urlsList');
    const noUrlsMessage = document.getElementById('noUrlsMessage');
    const urlsSection = document.querySelector('.urls-section');

    const shortenUrlSection = document.getElementById('shortenUrlSection');

    const BASE_URL = 'http://localhost:3000/api';

    // --- Yardımcı Fonksiyonlar ---
    function showMessage(text, type) {
        if (globalMessage) {
            globalMessage.textContent = text;
            globalMessage.className = `message-box ${type}`;
            globalMessage.classList.remove('hidden');
            setTimeout(() => {
                globalMessage.classList.add('hidden');
                globalMessage.textContent = '';
            }, 5000);
        }
    }

    function hideElement(element) {
        if (element) {
            element.style.display = 'none';
            element.classList.add('hidden');
        }
    }

    function showElement(element, displayType = 'block') {
        if (element) {
            element.classList.remove('hidden');
            element.style.removeProperty('display'); 
            element.style.display = displayType;
        }
    }

    function updateUI(user = null) {
        hideElement(globalMessage);
        hideElement(resultBox);
        showElement(shortenUrlSection);

        if (user && user.username) {
            hideElement(authSection); // Hesabım bölümünü gizle
            showElement(loggedInUserSection, 'flex'); // Kullanıcı bölümünü göster
            showElement(logoutButton, 'inline-block'); // Çıkış yap butonunu göster
            userDisplay.textContent = user.username;
            fetchUserUrls();
        } else {
            showElement(authSection); // Hesabım bölümünü göster
            showElement(authButtons, 'flex'); // Giriş/Kayıt butonlarını göster
            hideElement(loggedInUserSection); // Kullanıcı bölümünü gizle
            hideElement(logoutButton); // Çıkış yap butonunu gizle
            authTitle.textContent = 'Hesabım';
            hideElement(loginForm);
            hideElement(registerForm);
            urlsListDiv.innerHTML = '';
            hideElement(noUrlsMessage);
        }
    }

    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                updateUI(payload);
            } catch {
                localStorage.removeItem('token');
                updateUI(null);
            }
        } else {
            updateUI(null);
        }
    }

    // --- Başlangıç UI Ayarları ---
    if (authSection) showElement(authSection);
    if (authButtons) showElement(authButtons, 'flex');
    if (loggedInUserSection) hideElement(loggedInUserSection);
    if (loginForm) hideElement(loginForm);
    if (registerForm) hideElement(registerForm);
    if (resultBox) hideElement(resultBox);
    if (globalMessage) hideElement(globalMessage);
    if (noUrlsMessage) hideElement(noUrlsMessage);

    checkLoginStatus();

    // --- Auth İşlemleri ---
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(registerForm);
        showElement(loginForm);
        authTitle.textContent = 'Hesabıma Giriş Yap';
        hideElement(authButtons); // Bu satırı ekledim
        hideElement(globalMessage);
    });

    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideElement(loginForm);
        showElement(registerForm);
        authTitle.textContent = 'Yeni Hesap Oluştur';
        hideElement(authButtons); // Bu satırı ekledim
        hideElement(globalMessage);
    });

    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const username = regUsername.value;
        const email = regEmail.value;
        const password = regPassword.value;

        try {
            const response = await fetch(`${BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await response.json();

            if (response.ok) {
                showMessage('✅ Kayıt başarılı! Şimdi giriş yapabilirsiniz.', 'success');
                regUsername.value = '';
                regEmail.value = '';
                regPassword.value = '';
                showLoginBtn.click();
            } else {
                showMessage(`❌ ${data.error || 'Kayıt sırasında hata oluştu.'}`, 'error');
            }
        } catch {
            showMessage('❌ Sunucuya bağlanılamadı.', 'error');
        }
    });

   // loginBtn.addEventListener('click', ...
loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;

    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();

        // 🟢 Başarılı giriş durumunu kontrol edelim
        if (response.ok) {
            console.log('✅ Giriş başarılı. Backendden gelen data:', data);

            showMessage('✅ Giriş başarılı!', 'success');
            localStorage.setItem('token', data.token);
            loginEmail.value = '';
            loginPassword.value = '';
            updateUI(data.user);
            if (urlsSection) urlsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // 🔴 Hatalı giriş durumunu kontrol edelim
            console.log('❌ Giriş başarısız. Backendden gelen hata:', data);

            showMessage(`❌ ${data.error || 'Giriş sırasında hata oluştu.'}`, 'error');
        }
    } catch {
        console.log('❌ Sunucuya bağlanılamadı.');
        showMessage('❌ Sunucuya bağlanılamadı.', 'error');
    }
});

   logoutButton.addEventListener('click', () => {
    // Konsola bir mesaj yazdırarak bu fonksiyonun çalışıp çalışmadığını kontrol edelim
    console.log('Çıkış yap butonu tıklandı.');

    localStorage.removeItem('token');
    updateUI(null);
    showMessage('Başarıyla çıkış yapıldı.', 'success');
});

    // --- URL Kısaltma ---
    shortenBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const longUrl = longUrlInput.value.trim();
        hideElement(resultBox);
        hideElement(globalMessage);

        if (!longUrl) {
            showMessage('Lütfen kısaltmak istediğiniz linki girin.', 'error');
            return;
        }

        if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
            showMessage('Lütfen geçerli bir URL girin.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${BASE_URL}/shorten`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ longUrl }),
            });
            const data = await response.json();

            if (response.ok) {
                shortenedLink.href = data.shortUrl;
                shortenedLink.textContent = data.shortUrl;
                showElement(resultBox);
                showMessage(data.message || 'Linkiniz başarıyla kısaltıldı!', 'success');
                longUrlInput.value = '';
                if (token) fetchUserUrls();
            } else {
                showMessage(data.error || 'Link kısaltılırken hata oluştu.', 'error');
            }
        } catch {
            showMessage('Sunucuya bağlanılamadı.', 'error');
        }
    });

    copyButton.addEventListener('click', () => {
        const textToCopy = shortenedLink.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showMessage('Link panoya kopyalandı!', 'success');
        }).catch(() => {
            showMessage('Link kopyalanamadı.', 'error');
        });
    });

    // --- Link Listeleme ---
    async function fetchUserUrls() {
        urlsListDiv.innerHTML = '';
        hideElement(noUrlsMessage);
        hideElement(globalMessage);

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch(`${BASE_URL}/urls`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                if (data.urls && data.urls.length > 0) {
                    data.urls.forEach(urlItem => {
                        const div = document.createElement('div');
                        div.className = 'url-item';
                        div.innerHTML = `
                            <a href="${urlItem.shortUrl}" target="_blank">${urlItem.shortUrl}</a>
                            <span class="original-url">${urlItem.originalUrl}</span>
                            <span class="stats">
                                <span>Tıklama: ${urlItem.clickCount || 0}</span>
                                <span>Kısaltılma Tarihi: ${new Date(urlItem.createdAt).toLocaleDateString()}</span>
                            </span>
                        `;
                        urlsListDiv.appendChild(div);
                    });
                } else {
                    showElement(noUrlsMessage);
                }
            } else {
                showMessage(data.error || 'Linkleriniz getirilirken hata oluştu.', 'error');
            }
        } catch (error) {
            console.error('Link listesi isteği sırasında hata:', error);
            showMessage('Sunucuya bağlanılamadı veya bir ağ hatası oluştu.', 'error');
        }
    }

    listUrlsBtn.addEventListener('click', fetchUserUrls);
});