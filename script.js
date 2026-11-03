// =====================================================
// Real-time Chat Application - Hardened & Optimized
// Compatible with file:// (direct open) and http:// (web server)
// =====================================================

(function () {
    'use strict';

    // Firebase web app configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCmTDZWE0dQUQfVo25SWqO4KPZ87OkA9JA",
        authDomain: "nebula19-2e077.firebaseapp.com",
        projectId: "nebula19-2e077",
        storageBucket: "nebula19-2e077.firebasestorage.app",
        messagingSenderId: "879709662661",
        appId: "1:879709662661:web:eaf6fcaa837486c2e7afac",
        measurementId: "G-7KYL0F8H58"
    };

    let auth = null;
    let db = null;
    let storage = null;
    let isOfflineFallback = false;

    // Global Application State
    let currentUser = null;
    let currentRoomCode = null;
    let pendingRoomCode = null;
    let unsubscribeMessages = null;
    let unsubscribePresence = null;
    let unsubscribeTyping = null;
    let presenceHeartbeatInterval = null;
    let typingTimeout = null;
    let lastTypingBroadcast = 0;
    let onlineUsers = {};
    let isInitialMessagesLoad = true;
    let isSoundMuted = localStorage.getItem('nebula_sound_muted') === 'true';
    let oldestMessageDoc = null;
    let isScrollTicking = false;

    // State for consecutive message grouping & date dividers
    let lastRenderedDateStr = null;
    let lastRenderedEmail = null;
    let lastRenderedTimestamp = 0;

    // DOM Elements (Cached safely)
    let authScreen, lobbyScreen, chatScreen, loadingOverlay, toastContainer;
    let loginForm, signupForm, loginEmail, loginPassword, signupEmail, signupPassword;
    let loginBtn, signupBtn, guestBtn, guestBtnSignup, showSignupLink, showLoginLink;
    let userEmailDisplay, roomCodeInput, joinRoomBtn, logoutBtnLobby;
    let suggestedRooms, recentRoomsList, recentRoomsSection;
    let currentRoomName, currentUserEmail, messagesContainer, messagesWrapper;
    let loadEarlierContainer, loadEarlierBtn, messageInput, sendBtn;
    let leaveRoomBtn, logoutBtnChat, shareRoomBtn, soundToggleBtn;
    let toggleSidebarBtn, closeSidebarBtn, chatSidebar;
    let imageUploadInput, dragOverlay, scrollBottomBtn, scrollBadge;
    let typingIndicator, typingUserText, onlineUsersList, onlineCount;
    let imageLightbox, lightboxImg, lightboxClose, lightboxDownload;

    // Stealth Cloak, E2EE, Ephemeral & Disguise Elements
    let panicModeBtn, burnRoomBtn;
    let burnRoomModal, cancelBurnBtn, confirmBurnBtn, burnModalBackdrop;
    let burnTimerControl, burnTimerBtn, burnTimerMenu, burnTimerLabel;
    let disguiseOverlay, calcCloseStealthBtn, calcHistoryView, calcResultView;
    let selectedBurnSeconds = 0;

    function cacheDOMElements() {
        authScreen = document.getElementById('auth-screen');
        lobbyScreen = document.getElementById('lobby-screen');
        chatScreen = document.getElementById('chat-screen');
        loadingOverlay = document.getElementById('loading-overlay');
        toastContainer = document.getElementById('toast-container');

        loginForm = document.getElementById('login-form');
        signupForm = document.getElementById('signup-form');
        loginEmail = document.getElementById('login-email');
        loginPassword = document.getElementById('login-password');
        signupEmail = document.getElementById('signup-email');
        signupPassword = document.getElementById('signup-password');
        loginBtn = document.getElementById('login-btn');
        signupBtn = document.getElementById('signup-btn');
        guestBtn = document.getElementById('guest-btn');
        guestBtnSignup = document.getElementById('guest-btn-signup');
        showSignupLink = document.getElementById('show-signup');
        showLoginLink = document.getElementById('show-login');

        userEmailDisplay = document.getElementById('user-email-display');
        roomCodeInput = document.getElementById('room-code-input');
        joinRoomBtn = document.getElementById('join-room-btn');
        logoutBtnLobby = document.getElementById('logout-btn-lobby');
        suggestedRooms = document.getElementById('suggested-rooms');
        recentRoomsList = document.getElementById('recent-rooms-list');
        recentRoomsSection = document.getElementById('recent-rooms-section');

        currentRoomName = document.getElementById('current-room-name');
        currentUserEmail = document.getElementById('current-user-email');
        messagesContainer = document.getElementById('messages-container');
        messagesWrapper = document.getElementById('messages-wrapper');
        loadEarlierContainer = document.getElementById('load-earlier-container');
        loadEarlierBtn = document.getElementById('load-earlier-btn');
        messageInput = document.getElementById('message-input');
        sendBtn = document.getElementById('send-btn');
        leaveRoomBtn = document.getElementById('leave-room-btn');
        logoutBtnChat = document.getElementById('logout-btn-chat');
        shareRoomBtn = document.getElementById('share-room-btn');
        soundToggleBtn = document.getElementById('sound-toggle-btn');
        toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        closeSidebarBtn = document.getElementById('close-sidebar-btn');
        chatSidebar = document.getElementById('chat-sidebar');
        imageUploadInput = document.getElementById('image-upload-input');
        dragOverlay = document.getElementById('drag-overlay');
        scrollBottomBtn = document.getElementById('scroll-bottom-btn');
        scrollBadge = document.getElementById('scroll-badge');
        typingIndicator = document.getElementById('typing-indicator');
        typingUserText = document.getElementById('typing-user-text');
        onlineUsersList = document.getElementById('online-users-list');
        onlineCount = document.getElementById('online-count');

        imageLightbox = document.getElementById('image-lightbox');
        lightboxImg = document.getElementById('lightbox-img');
        lightboxClose = document.getElementById('lightbox-close');
        lightboxDownload = document.getElementById('lightbox-download');

        panicModeBtn = document.getElementById('panic-mode-btn');
        burnRoomBtn = document.getElementById('burn-room-btn');
        burnRoomModal = document.getElementById('burn-room-modal');
        cancelBurnBtn = document.getElementById('cancel-burn-btn');
        confirmBurnBtn = document.getElementById('confirm-burn-btn');
        burnModalBackdrop = document.getElementById('burn-modal-backdrop');
        burnTimerControl = document.getElementById('burn-timer-control');
        burnTimerBtn = document.getElementById('burn-timer-btn');
        burnTimerMenu = document.getElementById('burn-timer-menu');
        burnTimerLabel = document.getElementById('burn-timer-label');
        disguiseOverlay = document.getElementById('disguise-overlay');
        calcCloseStealthBtn = document.getElementById('calc-close-stealth-btn');
        calcHistoryView = document.getElementById('calc-history-view');
        calcResultView = document.getElementById('calc-result-view');
    }

    // =====================================================
    // Toast Notification System
    // =====================================================

    function showToast(message, type = 'info', duration = 3200) {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';

        toast.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${escapeHtml(message)}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    // =====================================================
    // Robust Utilities & Image Compression
    // =====================================================

    function parseTimestamp(timestamp) {
        if (!timestamp) return new Date();
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        if (timestamp instanceof Date) {
            return timestamp;
        }
        if (typeof timestamp.seconds === 'number') {
            return new Date(timestamp.seconds * 1000);
        }
        if (typeof timestamp._seconds === 'number') {
            return new Date(timestamp._seconds * 1000);
        }
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    function compressImage(file, maxWidth = 1600, quality = 0.82) {
        return new Promise((resolve) => {
            if (!file.type || !file.type.startsWith('image/') || file.size < 250 * 1024) {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxWidth) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxWidth) / height);
                            height = maxWidth;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob && blob.size < file.size) {
                            const compressedFile = new File([blob], (file.name || 'image').replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    }

    function showLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    function showScreen(screen) {
        if (!screen) return;
        if (authScreen) authScreen.classList.add('hidden');
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    function formatTime(timestamp) {
        const date = parseTimestamp(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function getDateDividerLabel(date) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
    }

    function getAvatarUrl(email) {
        const seed = email || 'nebula-user';
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
    }

    function updateSoundToggleUI() {
        if (!soundToggleBtn) return;
        if (isSoundMuted) {
            soundToggleBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            soundToggleBtn.title = 'Unmute Sound';
            soundToggleBtn.style.color = 'var(--text-secondary)';
        } else {
            soundToggleBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            soundToggleBtn.title = 'Mute Sound';
            soundToggleBtn.style.color = 'var(--neon-cyan)';
        }
    }

    function playNotificationSound() {
        if (isSoundMuted) return;
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.35;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function linkifyText(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`;
        });
    }

    function parseMarkdown(text) {
        if (!text) return '';
        let parsed = text;
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        parsed = parsed.replace(/`(.*?)`/g, '<code>$1</code>');
        return parsed;
    }

    function scrollToBottom(smooth = true) {
        if (messagesContainer) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
        if (scrollBadge) scrollBadge.classList.add('hidden');
    }

    function checkEmptyState() {
        if (!messagesWrapper) return;
        const messagesCount = messagesWrapper.querySelectorAll('.message').length;
        let emptyState = document.getElementById('empty-state-msg');

        if (messagesCount === 0) {
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.id = 'empty-state-msg';
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <i class="fas fa-comment-dots"></i>
                    <h3>Welcome to the Room!</h3>
                    <p>Be the first to say hello, paste an image (Ctrl+V), or share the invite link.</p>
                `;
                messagesWrapper.appendChild(emptyState);
            }
        } else {
            if (emptyState) {
                emptyState.remove();
            }
        }
    }

    function showTypingIndicator(userEmail) {
        if (typingIndicator && userEmail) {
            if (typingUserText) {
                const username = userEmail.split('@')[0];
                typingUserText.textContent = `${username} is typing...`;
            }
            typingIndicator.classList.remove('hidden');

            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                typingIndicator.classList.add('hidden');
            }, 3000);
        }
    }

    // =====================================================
    // Lightbox Viewer
    // =====================================================

    function openLightbox(imageUrl) {
        if (!imageLightbox || !lightboxImg) return;
        lightboxImg.src = imageUrl;
        if (lightboxDownload) lightboxDownload.href = imageUrl;
        imageLightbox.classList.remove('hidden');
    }

    function closeLightbox() {
        if (!imageLightbox) return;
        imageLightbox.classList.add('hidden');
        if (lightboxImg) lightboxImg.src = '';
    }

    // =====================================================
    // Zero-Knowledge End-to-End Encryption (E2EE)
    // AES-256-GCM + PBKDF2 derived from Room Secret Code
    // =====================================================
    const roomKeyCache = new Map();
    const decryptedCache = new Map();

    async function getRoomKey(roomCode) {
        const cleanCode = (roomCode || '').trim().toUpperCase();
        if (!cleanCode) return null;
        if (roomKeyCache.has(cleanCode)) {
            return roomKeyCache.get(cleanCode);
        }
        if (!window.crypto || !window.crypto.subtle) return null;
        try {
            const enc = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                enc.encode(cleanCode),
                "PBKDF2",
                false,
                ["deriveKey"]
            );
            const salt = enc.encode("nebula19-salt-v1");
            const key = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
            roomKeyCache.set(cleanCode, key);
            return key;
        } catch (err) {
            console.error("Failed to derive room key:", err);
            return null;
        }
    }

    async function encryptText(plainText, roomCode) {
        if (!plainText || !window.crypto || !window.crypto.subtle) return plainText;
        try {
            const key = await getRoomKey(roomCode);
            if (!key) return plainText;
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const encryptedBuf = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                enc.encode(plainText)
            );
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
            const cipherHex = Array.from(new Uint8Array(encryptedBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            const ciphertext = `e2e:${ivHex}:${cipherHex}`;
            decryptedCache.set(ciphertext, plainText);
            return ciphertext;
        } catch (err) {
            console.warn("Encryption failed, sending as fallback:", err);
            return plainText;
        }
    }

    async function decryptText(payload, roomCode) {
        if (typeof payload !== 'string' || !payload.startsWith('e2e:')) {
            return payload; // Plain text or legacy
        }
        if (decryptedCache.has(payload)) {
            return decryptedCache.get(payload);
        }
        if (!window.crypto || !window.crypto.subtle) return payload;
        try {
            const parts = payload.split(':');
            if (parts.length !== 3) return payload;
            const ivHex = parts[1];
            const cipherHex = parts[2];
            const ivMatches = ivHex.match(/.{1,2}/g);
            const cipherMatches = cipherHex.match(/.{1,2}/g);
            if (!ivMatches || !cipherMatches) return payload;

            const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
            const ciphertext = new Uint8Array(cipherMatches.map(byte => parseInt(byte, 16)));
            const key = await getRoomKey(roomCode);
            if (!key) return payload;

            const decryptedBuf = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
            );
            const dec = new TextDecoder();
            const decryptedString = dec.decode(decryptedBuf);
            decryptedCache.set(payload, decryptedString);
            return decryptedString;
        } catch (err) {
            console.warn("Decryption failed (room key mismatch):", err);
            return "🔒 [Encrypted message - Room key mismatch]";
        }
    }

    // =====================================================
    // Ephemeral / Self-Destruct Timers (Auto-Burn)
    // =====================================================
    const activeBurnIntervals = new Map();

    function formatBurnCountdown(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}m ${s}s`;
        }
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    }

    function setupMessageBurnTimer(msgId, expiresAt) {
        if (!msgId || !expiresAt) return;
        if (activeBurnIntervals.has(msgId)) {
            clearInterval(activeBurnIntervals.get(msgId));
        }

        const tick = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            const badge = document.getElementById(`burn-${msgId}`);
            if (remaining <= 0) {
                if (activeBurnIntervals.has(msgId)) {
                    clearInterval(activeBurnIntervals.get(msgId));
                    activeBurnIntervals.delete(msgId);
                }
                const msgEl = document.querySelector(`.message[data-msg-id="${msgId}"]`);
                if (msgEl) {
                    msgEl.classList.add('smoke-out');
                    setTimeout(() => {
                        if (msgEl.parentNode) msgEl.remove();
                        checkEmptyState();
                    }, 600);
                }
                // Wipe from Firestore so no trace is left
                if (db && currentRoomCode) {
                    db.collection('rooms').doc(currentRoomCode).collection('messages').doc(msgId).delete().catch(() => {});
                }
            } else if (badge) {
                const valEl = badge.querySelector('.countdown-val');
                if (valEl) valEl.textContent = formatBurnCountdown(remaining);
            }
        };

        const intervalId = setInterval(tick, 1000);
        activeBurnIntervals.set(msgId, intervalId);
        tick();
    }

    // =====================================================
    // Room Wipe (Burn Room) Action
    // =====================================================
    async function burnRoom() {
        if (!currentRoomCode) return;
        if (!db) {
            showToast('Database not connected.', 'error');
            return;
        }

        showLoading();
        try {
            const messagesRef = db.collection('rooms').doc(currentRoomCode).collection('messages');
            const snapshot = await messagesRef.limit(500).get();

            if (snapshot.empty) {
                hideLoading();
                showToast('Room is already clean.', 'info');
                if (burnRoomModal) burnRoomModal.classList.add('hidden');
                return;
            }

            const batch = db.batch();
            snapshot.docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();

            hideLoading();
            if (burnRoomModal) burnRoomModal.classList.add('hidden');

            if (messagesWrapper) {
                messagesWrapper.classList.add('smoke-out');
                setTimeout(() => {
                    messagesWrapper.innerHTML = '';
                    messagesWrapper.classList.remove('smoke-out');
                    checkEmptyState();
                }, 600);
            }

            showToast('🔥 Room burned. All messages wiped permanently.', 'success', 4000);
        } catch (err) {
            hideLoading();
            console.error('Failed to wipe room:', err);
            showToast('Failed to wipe room: ' + err.message, 'error');
        }
    }

    // =====================================================
    // Stealth Cloak Camouflage & Realistic Calculator Mode
    // =====================================================
    let isStealthActive = false;
    let originalTitle = document.title;
    let calcCurrent = '0';
    let calcPrevious = '';
    let calcOp = null;
    let calcResetDisplay = false;

    function toggleStealthMode(forceState) {
        if (!disguiseOverlay) return;
        isStealthActive = typeof forceState === 'boolean' ? forceState : !isStealthActive;

        if (isStealthActive) {
            disguiseOverlay.classList.remove('hidden');
            originalTitle = document.title;
            document.title = 'Calculator';
            resetCalculator();
        } else {
            disguiseOverlay.classList.add('hidden');
            document.title = originalTitle || 'Nebula | Real-time Secure Chat';
        }
    }

    function resetCalculator() {
        calcCurrent = '0';
        calcPrevious = '';
        calcOp = null;
        calcResetDisplay = false;
        updateCalcUI();
    }

    function updateCalcUI() {
        if (calcResultView) calcResultView.textContent = calcCurrent;
        if (calcHistoryView) calcHistoryView.textContent = calcPrevious + (calcOp ? ` ${calcOp}` : '');
    }

    function handleCalculatorAction(action) {
        if (!action) return;

        if (action >= '0' && action <= '9') {
            if (calcCurrent === '0' || calcResetDisplay) {
                calcCurrent = action;
                calcResetDisplay = false;
            } else {
                if (calcCurrent.length < 14) calcCurrent += action;
            }
            updateCalcUI();
            return;
        }

        if (action === '.') {
            if (calcResetDisplay) {
                calcCurrent = '0.';
                calcResetDisplay = false;
            } else if (!calcCurrent.includes('.')) {
                calcCurrent += '.';
            }
            updateCalcUI();
            return;
        }

        if (action === 'clear') {
            resetCalculator();
            return;
        }

        if (action === 'back') {
            if (calcCurrent.length > 1) {
                calcCurrent = calcCurrent.slice(0, -1);
            } else {
                calcCurrent = '0';
            }
            updateCalcUI();
            return;
        }

        if (action === '%') {
            const val = parseFloat(calcCurrent);
            if (!isNaN(val)) {
                calcCurrent = String(val / 100);
                updateCalcUI();
            }
            return;
        }

        if (['+', '-', '*', '/'].includes(action)) {
            if (calcOp && !calcResetDisplay) {
                calculateResult();
            }
            calcPrevious = calcCurrent;
            calcOp = action;
            calcResetDisplay = true;
            updateCalcUI();
            return;
        }

        if (action === '=') {
            // Secret unlock code: typing 19 and pressing = unlocks chat!
            if (calcCurrent === '19' || calcPrevious === '19') {
                toggleStealthMode(false);
                showToast('Stealth Cloak deactivated', 'info', 2000);
                return;
            }

            if (calcOp && calcPrevious) {
                calculateResult();
                calcPrevious = '';
                calcOp = null;
                calcResetDisplay = true;
                updateCalcUI();
            }
        }
    }

    function calculateResult() {
        const prev = parseFloat(calcPrevious);
        const curr = parseFloat(calcCurrent);
        if (isNaN(prev) || isNaN(curr)) return;

        let result = 0;
        switch (calcOp) {
            case '+': result = prev + curr; break;
            case '-': result = prev - curr; break;
            case '*': result = prev * curr; break;
            case '/': result = curr !== 0 ? prev / curr : 'Error'; break;
        }

        calcCurrent = typeof result === 'number' ? (Math.round(result * 1000000) / 1000000).toString() : result;
    }

    // =====================================================
    // Recent Rooms & Quick Join Chips
    // =====================================================

    function getRecentRooms() {
        try {
            return JSON.parse(localStorage.getItem('nebula_recent_rooms') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveRecentRoom(room) {
        if (!room) return;
        const normalized = room.trim().toUpperCase();
        let rooms = getRecentRooms().filter(r => r !== normalized);
        rooms.unshift(normalized);
        rooms = rooms.slice(0, 6);
        localStorage.setItem('nebula_recent_rooms', JSON.stringify(rooms));
        renderRecentRooms();
    }

    function deleteRecentRoom(room) {
        let rooms = getRecentRooms().filter(r => r !== room);
        localStorage.setItem('nebula_recent_rooms', JSON.stringify(rooms));
        renderRecentRooms();
    }

    function renderRecentRooms() {
        if (!recentRoomsList || !recentRoomsSection) return;
        const rooms = getRecentRooms();

        if (rooms.length === 0) {
            recentRoomsSection.style.display = 'none';
            recentRoomsList.innerHTML = '';
            return;
        }

        recentRoomsSection.style.display = 'block';
        recentRoomsList.innerHTML = '';

        rooms.forEach((room) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'room-chip';
            btn.innerHTML = `
                <span>#${escapeHtml(room)}</span>
                <span class="chip-delete" title="Remove"><i class="fas fa-times"></i></span>
            `;

            btn.querySelector('.chip-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteRecentRoom(room);
            });

            btn.addEventListener('click', () => {
                roomCodeInput.value = room;
                handleJoinRoom();
            });

            recentRoomsList.appendChild(btn);
        });
    }

    // =====================================================
    // Authentication Functions
    // =====================================================

    async function handleGuestSignIn() {
        showLoading();
        const randomNum = Math.floor(100 + Math.random() * 900);
        const guestEmail = `tester${randomNum}@nebula.test`;

        if (auth && !isOfflineFallback) {
            try {
                const userCredential = await auth.signInAnonymously();
                currentUser = {
                    uid: userCredential.user.uid,
                    email: guestEmail
                };
                sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
                showToast(`Signed in as ${guestEmail}`, 'success');
                showLobby();
                hideLoading();
                return;
            } catch (err) {
                console.warn('Anonymous auth failed, fallback to test user:', err);
            }
        }

        // Local test user session
        currentUser = {
            uid: 'guest-' + Math.random().toString(36).substring(2, 10),
            email: guestEmail
        };
        sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
        showToast(`Guest session: ${guestEmail}`, 'success');
        showLobby();
        hideLoading();
    }

    async function handleLogin(e) {
        if (e) e.preventDefault();
        const email = (loginEmail && loginEmail.value.trim()) || 'tester@nebula.test';
        const password = (loginPassword && loginPassword.value) || '123456';

        showLoading();
        if (auth && !isOfflineFallback) {
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                currentUser = userCredential.user;
                sessionStorage.removeItem('nebula_test_user');
                showToast('Welcome back!', 'success');
                showLobby();
                hideLoading();
                return;
            } catch (error) {
                console.warn('Standard login error, trying auto-signup:', error);
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password.length >= 6 ? password : password + '123456');
                    currentUser = userCredential.user;
                    sessionStorage.removeItem('nebula_test_user');
                    showToast('Account created and signed in!', 'success');
                    showLobby();
                    hideLoading();
                    return;
                } catch (signupErr) {
                    console.warn('Auto-signup error, entering test mode:', signupErr);
                }
            }
        }

        currentUser = {
            uid: 'user-' + Math.random().toString(36).substring(2, 10),
            email: email
        };
        sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
        showToast(`Test mode active for ${email}`, 'info');
        showLobby();
        hideLoading();
    }

    async function handleSignup(e) {
        if (e) e.preventDefault();
        const email = (signupEmail && signupEmail.value.trim()) || 'tester@nebula.test';
        const password = (signupPassword && signupPassword.value) || '123456';

        showLoading();
        if (auth && !isOfflineFallback) {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password.length >= 6 ? password : password + '123456');
                currentUser = userCredential.user;
                sessionStorage.removeItem('nebula_test_user');
                showToast('Account created successfully!', 'success');
                showLobby();
                hideLoading();
                return;
            } catch (error) {
                console.warn('Signup error, entering test mode:', error);
            }
        }

        currentUser = {
            uid: 'user-' + Math.random().toString(36).substring(2, 10),
            email: email
        };
        sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
        showToast(`Test mode session for ${email}`, 'info');
        showLobby();
        hideLoading();
    }

    async function handleLogout() {
        showLoading();
        leaveRoomCleanup();
        sessionStorage.removeItem('nebula_test_user');
        if (auth) {
            try {
                await auth.signOut();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
        hideLoading();
        currentUser = null;
        currentRoomCode = null;
        showToast('You have logged out.', 'info');
        showScreen(authScreen);
    }

    function toggleAuthForms() {
        if (loginForm) loginForm.classList.toggle('hidden');
        if (signupForm) signupForm.classList.toggle('hidden');
    }

    // =====================================================
    // Lobby Functions
    // =====================================================

    function showLobby() {
        if (currentUser && userEmailDisplay) {
            userEmailDisplay.textContent = currentUser.email;
        }

        renderRecentRooms();

        if (pendingRoomCode) {
            const codeToJoin = pendingRoomCode;
            pendingRoomCode = null;
            currentRoomCode = codeToJoin;
            saveRecentRoom(codeToJoin);
            showChatRoom();
            return;
        }

        showScreen(lobbyScreen);
    }

    function handleJoinRoom() {
        if (!roomCodeInput) return;
        const roomCode = roomCodeInput.value.trim().toUpperCase();

        if (!roomCode) {
            showToast('Please enter a room code', 'error');
            return;
        }

        currentRoomCode = roomCode;
        saveRecentRoom(roomCode);
        showChatRoom();
    }

    // =====================================================
    // Presence & Online Users
    // =====================================================

    function setupPresence() {
        if (unsubscribePresence) {
            unsubscribePresence();
            unsubscribePresence = null;
        }
        if (presenceHeartbeatInterval) {
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
        }

        if (!db || !currentRoomCode || !currentUser) return;

        const userPresenceDoc = db.collection('rooms').doc(currentRoomCode).collection('presence').doc(currentUser.uid);

        async function sendHeartbeat() {
            if (!currentRoomCode || !currentUser || !db) return;
            try {
                await userPresenceDoc.set({
                    email: currentUser.email,
                    lastSeen: Date.now()
                }, { merge: true });
            } catch (err) {
                console.warn('Presence update error:', err);
            }
        }

        sendHeartbeat();
        presenceHeartbeatInterval = setInterval(sendHeartbeat, 25000);

        try {
            unsubscribePresence = db.collection('rooms').doc(currentRoomCode).collection('presence').onSnapshot((snapshot) => {
                const now = Date.now();
                onlineUsers = {};

                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.lastSeen && (now - data.lastSeen < 60000)) {
                        onlineUsers[docSnap.id] = data;
                    }
                });

                updateOnlineUsersUI();
                updateReadReceiptsUI();
            }, (error) => {
                console.warn('Presence snapshot error:', error);
            });
        } catch (err) {
            console.warn('Error starting presence listener:', err);
        }
    }

    function updateOnlineUsersUI() {
        if (!onlineUsersList || !onlineCount) return;

        onlineUsersList.innerHTML = '';
        const userList = Object.values(onlineUsers);

        userList.forEach((user) => {
            const li = document.createElement('li');
            const username = user.email ? user.email.split('@')[0] : 'User';
            li.innerHTML = `
                <div class="user-status-indicator online"></div>
                <span>${escapeHtml(username)}</span>
            `;
            onlineUsersList.appendChild(li);
        });

        onlineCount.textContent = `${userList.length} Online`;
    }

    function updateReadReceiptsUI() {
        const othersOnline = Object.keys(onlineUsers).some(uid => uid !== (currentUser ? currentUser.uid : ''));
        document.querySelectorAll('.message.mine:not(.pending) .read-receipt-icon').forEach(icon => {
            if (othersOnline) {
                icon.className = 'fas fa-check-double read-receipt-icon';
                icon.style.color = 'var(--neon-cyan)';
                icon.title = 'Read';
            } else {
                icon.className = 'fas fa-check read-receipt-icon';
                icon.style.color = 'var(--text-secondary)';
                icon.title = 'Sent';
            }
        });
    }

    // =====================================================
    // Typing Indicator
    // =====================================================

    function setupTypingListener() {
        if (unsubscribeTyping) {
            unsubscribeTyping();
            unsubscribeTyping = null;
        }

        if (!db || !currentRoomCode) return;

        try {
            unsubscribeTyping = db.collection('rooms').doc(currentRoomCode).collection('typing').onSnapshot((snapshot) => {
                const now = Date.now();
                let activeTypingEmail = null;

                snapshot.forEach((docSnap) => {
                    if (docSnap.id !== (currentUser ? currentUser.uid : '')) {
                        const data = docSnap.data();
                        if (data.timestamp && (now - data.timestamp < 3500)) {
                            activeTypingEmail = data.email;
                        }
                    }
                });

                if (activeTypingEmail) {
                    showTypingIndicator(activeTypingEmail);
                }
            }, (error) => {
                console.warn('Typing snapshot error:', error);
            });
        } catch (err) {
            console.warn('Error starting typing listener:', err);
        }
    }

    async function broadcastTyping() {
        if (!currentRoomCode || !currentUser || !db) return;
        const now = Date.now();
        if (now - lastTypingBroadcast < 1500) return;
        lastTypingBroadcast = now;

        try {
            await db.collection('rooms').doc(currentRoomCode).collection('typing').doc(currentUser.uid).set({
                email: currentUser.email,
                timestamp: now
            });
        } catch (err) {
            console.warn('Typing broadcast error:', err);
        }
    }

    // =====================================================
    // Chat Room & Real-time Messages
    // =====================================================

    function showChatRoom() {
        if (currentRoomName) currentRoomName.textContent = `# ${currentRoomCode}`;
        if (currentUserEmail) currentUserEmail.textContent = currentUser ? currentUser.email : '';
        if (messagesWrapper) messagesWrapper.innerHTML = '';

        if (loadEarlierContainer && messagesWrapper) {
            messagesWrapper.appendChild(loadEarlierContainer);
            loadEarlierContainer.classList.add('hidden');
        }

        lastRenderedDateStr = null;
        lastRenderedEmail = null;
        lastRenderedTimestamp = 0;
        oldestMessageDoc = null;

        showScreen(chatScreen);

        subscribeToMessages();
        setupPresence();
        setupTypingListener();
        updateSoundToggleUI();

        if (messageInput) messageInput.focus();
    }

    function subscribeToMessages() {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        if (!db || !currentRoomCode) return;

        isInitialMessagesLoad = true;
        showLoading();

        try {
            const messagesQuery = db.collection('rooms').doc(currentRoomCode).collection('messages')
                .orderBy('created_at', 'asc')
                .limitToLast(50);

            unsubscribeMessages = messagesQuery.onSnapshot((snapshot) => {
                hideLoading();

                if (snapshot.docs.length > 0) {
                    oldestMessageDoc = snapshot.docs[0];
                    if (snapshot.docs.length >= 50 && loadEarlierContainer) {
                        loadEarlierContainer.classList.remove('hidden');
                    }
                }

                // Initial Batch Render
                if (isInitialMessagesLoad) {
                    messagesWrapper.innerHTML = '';
                    if (loadEarlierContainer) {
                        messagesWrapper.appendChild(loadEarlierContainer);
                    }
                    lastRenderedDateStr = null;
                    lastRenderedEmail = null;
                    lastRenderedTimestamp = 0;

                    const fragment = document.createDocumentFragment();

                    snapshot.forEach((docSnap) => {
                        const msgData = { id: docSnap.id, ...docSnap.data() };
                        buildMessageNodes(msgData, fragment);
                    });

                    messagesWrapper.appendChild(fragment);

                    isInitialMessagesLoad = false;
                    scrollToBottom(false);
                    checkEmptyState();
                    return;
                }

                // Incremental Updates
                const docChanges = snapshot.docChanges();

                docChanges.forEach((change) => {
                    const msgData = { id: change.doc.id, ...change.doc.data() };

                    if (change.type === 'added') {
                        // Avoid duplicates if optimistic message already exists
                        const alreadyInDom = document.querySelector(`.message[data-msg-id="${msgData.id}"]`);
                        if (alreadyInDom) {
                            alreadyInDom.classList.remove('pending');
                            return;
                        }

                        const isNearBottom = messagesContainer ?
                            (messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 150) : true;

                        displayMessage(msgData);

                        if (isNearBottom) {
                            scrollToBottom(true);
                        } else {
                            if (scrollBadge) scrollBadge.classList.remove('hidden');
                        }

                        if (msgData.user_email !== (currentUser ? currentUser.email : '')) {
                            playNotificationSound();
                        }
                    } else if (change.type === 'modified') {
                        const existingDiv = document.querySelector(`.message[data-msg-id="${msgData.id}"]`);
                        if (existingDiv) {
                            const currentScroll = messagesContainer ? messagesContainer.scrollTop : 0;
                            const nextSibling = existingDiv.nextSibling;
                            existingDiv.remove();
                            displayMessage(msgData, true, nextSibling);
                            if (messagesContainer) messagesContainer.scrollTop = currentScroll;
                        }
                    } else if (change.type === 'removed') {
                        const existingDiv = document.querySelector(`.message[data-msg-id="${msgData.id}"]`);
                        if (existingDiv) {
                            existingDiv.remove();
                            checkEmptyState();
                        }
                    }
                });

                checkEmptyState();
            }, (error) => {
                hideLoading();
                console.error('Error listening to messages:', error);
                showToast('Error loading messages: ' + error.message, 'error');
            });
        } catch (err) {
            hideLoading();
            console.error('Failed to subscribe to messages:', err);
        }
    }

    async function loadEarlierMessages() {
        if (!oldestMessageDoc || !currentRoomCode || !db) return;

        showLoading();
        try {
            const olderQuery = await db.collection('rooms').doc(currentRoomCode).collection('messages')
                .orderBy('created_at', 'asc')
                .endBefore(oldestMessageDoc)
                .limitToLast(30)
                .get();

            hideLoading();

            if (olderQuery.empty) {
                if (loadEarlierContainer) loadEarlierContainer.classList.add('hidden');
                showToast('Reached the beginning of room history.', 'info');
                return;
            }

            oldestMessageDoc = olderQuery.docs[0];

            const prevScrollHeight = messagesContainer ? messagesContainer.scrollHeight : 0;
            const prevScrollTop = messagesContainer ? messagesContainer.scrollTop : 0;

            const fragment = document.createDocumentFragment();
            olderQuery.docs.forEach((docSnap) => {
                const msgData = { id: docSnap.id, ...docSnap.data() };
                buildMessageNodes(msgData, fragment);
            });

            const insertPoint = loadEarlierContainer ? loadEarlierContainer.nextSibling : (messagesWrapper ? messagesWrapper.firstChild : null);
            if (messagesWrapper && insertPoint) {
                messagesWrapper.insertBefore(fragment, insertPoint);
            }

            if (messagesContainer) {
                messagesContainer.scrollTop = prevScrollTop + (messagesContainer.scrollHeight - prevScrollHeight);
            }

            if (olderQuery.docs.length < 30 && loadEarlierContainer) {
                loadEarlierContainer.classList.add('hidden');
            }
        } catch (err) {
            hideLoading();
            console.error('Failed to load older messages:', err);
            showToast('Failed to load older messages.', 'error');
        }
    }

    async function sendMessage() {
        if (!messageInput) return;
        const content = messageInput.value.trim();
        if (!content) return;

        messageInput.value = '';
        messageInput.style.height = 'auto';

        const tempId = 'optimistic_' + Date.now();
        const burnSeconds = selectedBurnSeconds;
        const expiresAt = burnSeconds > 0 ? (Date.now() + (burnSeconds * 1000)) : null;

        // 0ms Optimistic UI render
        const optimisticMsg = {
            id: tempId,
            room_code: currentRoomCode,
            user_email: currentUser ? currentUser.email : 'User',
            user_id: currentUser ? currentUser.uid : 'anon',
            content: content,
            image_url: null,
            reactions: {},
            is_deleted: false,
            created_at: new Date(),
            isPending: true,
            burn_seconds: burnSeconds,
            expires_at: expiresAt
        };

        // Cache decrypted value so sender immediately sees plain text
        decryptedCache.set(content, content);

        displayMessage(optimisticMsg);
        scrollToBottom(true);

        if (!db) {
            showToast('Database not connected. Message sent locally only.', 'info');
            return;
        }

        try {
            // End-to-End Encrypt message content with room key
            const encryptedContent = await encryptText(content, currentRoomCode);
            decryptedCache.set(encryptedContent, content);

            const docPayload = {
                room_code: currentRoomCode,
                user_email: currentUser.email,
                user_id: currentUser.uid,
                content: encryptedContent,
                image_url: null,
                reactions: {},
                is_deleted: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                edited_at: null
            };

            if (burnSeconds > 0 && expiresAt) {
                docPayload.burn_seconds = burnSeconds;
                docPayload.expires_at = expiresAt;
            }

            const docRef = await db.collection('rooms').doc(currentRoomCode).collection('messages').add(docPayload);

            // Smoothly upgrade optimistic element ID to actual Firestore doc ID
            const pendingElement = document.querySelector(`.message[data-msg-id="${tempId}"]`);
            if (pendingElement) {
                pendingElement.setAttribute('data-msg-id', docRef.id);
                pendingElement.classList.remove('pending');
                const clock = pendingElement.querySelector('.fa-clock');
                if (clock) {
                    clock.className = 'fas fa-check read-receipt-icon';
                    clock.title = 'Sent (Encrypted)';
                }
            }

            if (expiresAt) {
                setupMessageBurnTimer(docRef.id, expiresAt);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message: ' + error.message, 'error');

            const pendingEl = document.querySelector(`.message[data-msg-id="${tempId}"]`);
            if (pendingEl) {
                pendingEl.style.opacity = '0.5';
                pendingEl.title = 'Failed to send.';
            }
        }
    }

    async function uploadImageFile(file) {
        if (!file || !currentRoomCode || !currentUser) return;

        if (!storage || !db) {
            showToast('Cloud storage is not connected.', 'error');
            return;
        }

        showLoading();
        try {
            const compressed = await compressImage(file, 1600, 0.82);

            const fileExt = compressed.name ? compressed.name.split('.').pop() : 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const imageStorageRef = storage.ref(`chat-images/${currentRoomCode}/${fileName}`);

            const uploadSnapshot = await imageStorageRef.put(compressed);
            const downloadUrl = await uploadSnapshot.ref.getDownloadURL();

            const burnSeconds = selectedBurnSeconds;
            const expiresAt = burnSeconds > 0 ? (Date.now() + (burnSeconds * 1000)) : null;

            const docPayload = {
                room_code: currentRoomCode,
                user_email: currentUser.email,
                user_id: currentUser.uid,
                content: '*Sent an image*',
                image_url: downloadUrl,
                reactions: {},
                is_deleted: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                edited_at: null
            };

            if (burnSeconds > 0 && expiresAt) {
                docPayload.burn_seconds = burnSeconds;
                docPayload.expires_at = expiresAt;
            }

            const docRef = await db.collection('rooms').doc(currentRoomCode).collection('messages').add(docPayload);

            if (expiresAt) {
                setupMessageBurnTimer(docRef.id, expiresAt);
            }

            showToast('Image uploaded!', 'success');
        } catch (err) {
            console.error('Image upload failed:', err);
            let msg = err.message || '';
            if (err.code === 'storage/unauthorized') {
                msg = 'Permission denied. Make sure storage.rules are published in your Firebase Console.';
            }
            showToast('Failed to upload image: ' + msg, 'error');
        } finally {
            hideLoading();
        }
    }

    function buildMessageNodes(message, containerNode) {
        if (message.expires_at && Date.now() >= message.expires_at) {
            if (db && currentRoomCode && message.id && !message.id.startsWith('optimistic_')) {
                db.collection('rooms').doc(currentRoomCode).collection('messages').doc(message.id).delete().catch(() => {});
            }
            return;
        }

        const msgDate = parseTimestamp(message.created_at);
        const msgDateStr = msgDate.toDateString();

        if (msgDateStr !== lastRenderedDateStr) {
            lastRenderedDateStr = msgDateStr;
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${getDateDividerLabel(msgDate)}</span>`;
            containerNode.appendChild(divider);
        }

        const msgTime = msgDate.getTime();
        const isConsecutive = lastRenderedEmail === message.user_email && (msgTime - lastRenderedTimestamp < 120000);

        lastRenderedEmail = message.user_email;
        lastRenderedTimestamp = msgTime;

        const messageEl = createMessageDOMElement(message, isConsecutive);
        if (messageEl) {
            containerNode.appendChild(messageEl);
            if (message.expires_at && !message.is_deleted) {
                setupMessageBurnTimer(message.id, message.expires_at);
            }
        }
    }

    function createMessageDOMElement(message, isConsecutive = false) {
        // Drop already expired messages
        if (message.expires_at && Date.now() >= message.expires_at) {
            if (db && currentRoomCode && message.id && !message.id.startsWith('optimistic_')) {
                db.collection('rooms').doc(currentRoomCode).collection('messages').doc(message.id).delete().catch(() => {});
            }
            return null;
        }

        const messageDiv = document.createElement('div');
        const isMine = currentUser && (message.user_email === currentUser.email || message.user_id === currentUser.uid);
        const avatarUrl = getAvatarUrl(message.user_email);

        const rawContent = message.content || '';
        let initialContent = rawContent;
        const isEncrypted = typeof rawContent === 'string' && rawContent.startsWith('e2e:');

        if (isEncrypted) {
            if (decryptedCache.has(rawContent)) {
                initialContent = decryptedCache.get(rawContent);
            } else {
                initialContent = '🔒 Decrypting...';
            }
        }

        const escapedContent = escapeHtml(initialContent);
        const linkedContent = linkifyText(escapedContent);
        const finalContent = message.is_deleted ? '<em>This message was deleted</em>' : parseMarkdown(linkedContent);

        const isPending = message.isPending === true;

        messageDiv.className = `message ${isMine ? 'mine' : 'others'} ${isConsecutive ? 'grouped' : ''} ${isPending ? 'pending' : ''}`;
        messageDiv.setAttribute('data-msg-id', message.id);
        messageDiv.setAttribute('data-content', initialContent);
        messageDiv.setAttribute('data-sender', message.user_email || '');

        let actionsHtml = '';
        if (!message.is_deleted && !isPending) {
            let editDeleteHtml = '';
            if (isMine) {
                editDeleteHtml = `
                    <button class="action-btn edit-btn" data-id="${message.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" data-id="${message.id}" title="Delete"><i class="fas fa-trash"></i></button>
                `;
            }
            actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn copy-btn" data-id="${message.id}" title="Copy Text"><i class="fas fa-copy"></i></button>
                    <button class="action-btn react-btn" data-id="${message.id}" title="React"><i class="fas fa-smile"></i></button>
                    ${editDeleteHtml}
                    <div class="emoji-picker-popup hidden" id="picker-${message.id}">
                        <button class="emoji-option" data-id="${message.id}" data-emoji="👍">👍</button>
                        <button class="emoji-option" data-id="${message.id}" data-emoji="❤️">❤️</button>
                        <button class="emoji-option" data-id="${message.id}" data-emoji="😂">😂</button>
                        <button class="emoji-option" data-id="${message.id}" data-emoji="🎉">🎉</button>
                        <button class="emoji-option" data-id="${message.id}" data-emoji="🚀">🚀</button>
                    </div>
                </div>
            `;
        }

        let imageHtml = '';
        if (message.image_url && !message.is_deleted) {
            imageHtml = `<img src="${message.image_url}" class="message-image" alt="Attachment" title="Click to view full image" loading="lazy" />`;
        }

        let reactionsHtml = '';
        if (message.reactions && Object.keys(message.reactions).length > 0 && !message.is_deleted) {
            const pills = Object.entries(message.reactions).map(([emoji, users]) => {
                if (!Array.isArray(users) || users.length === 0) return '';
                return `<span class="reaction-pill reaction-click" data-id="${message.id}" data-emoji="${emoji}">${emoji} ${users.length}</span>`;
            }).join('');
            if (pills) {
                reactionsHtml = `<div class="reactions-container">${pills}</div>`;
            }
        }

        const editedTag = message.edited_at ? '<span class="edited-tag">(edited)</span>' : '';

        let burnBadgeHtml = '';
        if (message.expires_at && !message.is_deleted) {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((message.expires_at - now) / 1000));
            if (remaining > 0) {
                burnBadgeHtml = `<span class="burn-countdown-badge" id="burn-${message.id}"><i class="fas fa-fire"></i> <span class="countdown-val">${formatBurnCountdown(remaining)}</span></span>`;
            }
        }

        let readReceiptHtml = '';
        if (isMine && !message.is_deleted) {
            if (isPending) {
                readReceiptHtml = '<i class="far fa-clock" style="color:var(--text-secondary); margin-left:6px; font-size:10px;" title="Sending..."></i>';
            } else {
                const othersOnline = Object.keys(onlineUsers).some(uid => uid !== currentUser.uid);
                if (othersOnline) {
                    readReceiptHtml = '<i class="fas fa-check-double read-receipt-icon" style="color:var(--neon-cyan); margin-left: 6px; font-size:10px;" title="Read"></i>';
                } else {
                    readReceiptHtml = '<i class="fas fa-check read-receipt-icon" style="color:var(--text-secondary); margin-left: 6px; font-size:10px;" title="Sent"></i>';
                }
            }
        }

        messageDiv.innerHTML = `
            <img src="${avatarUrl}" alt="Avatar" class="message-avatar" loading="lazy" />
            <div class="message-content-wrapper">
                <div class="message-sender">${escapeHtml(message.user_email || 'User')}</div>
                <div class="message-bubble">
                    ${actionsHtml}
                    ${imageHtml}
                    <div class="message-content">${finalContent}</div>
                    ${reactionsHtml}
                    <div class="message-time">${formatTime(message.created_at)}${editedTag}${burnBadgeHtml}${readReceiptHtml}</div>
                </div>
            </div>
        `;

        if (isEncrypted && !decryptedCache.has(rawContent)) {
            decryptText(rawContent, currentRoomCode).then(decrypted => {
                const contentEl = messageDiv.querySelector('.message-content');
                if (contentEl && !message.is_deleted) {
                    const esc = escapeHtml(decrypted);
                    const lnk = linkifyText(esc);
                    contentEl.innerHTML = parseMarkdown(lnk);
                }
                messageDiv.setAttribute('data-content', decrypted);
            });
        }

        return messageDiv;
    }

    function displayMessage(message, isUpdate = false, insertBeforeNode = null) {
        if (!messagesWrapper) return;

        if (message.expires_at && Date.now() >= message.expires_at) {
            if (db && currentRoomCode && message.id && !message.id.startsWith('optimistic_')) {
                db.collection('rooms').doc(currentRoomCode).collection('messages').doc(message.id).delete().catch(() => {});
            }
            return;
        }

        const msgDate = parseTimestamp(message.created_at);
        const msgDateStr = msgDate.toDateString();

        if (!isUpdate && msgDateStr !== lastRenderedDateStr) {
            lastRenderedDateStr = msgDateStr;
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${getDateDividerLabel(msgDate)}</span>`;
            if (insertBeforeNode) {
                messagesWrapper.insertBefore(divider, insertBeforeNode);
            } else {
                messagesWrapper.appendChild(divider);
            }
        }

        let isConsecutive = false;
        if (isUpdate) {
            // Check previous sibling element to preserve grouping state
            const prevEl = insertBeforeNode ? insertBeforeNode.previousElementSibling : messagesWrapper.lastElementChild;
            isConsecutive = prevEl && prevEl.classList.contains('message') && prevEl.getAttribute('data-sender') === message.user_email;
        } else {
            const msgTime = msgDate.getTime();
            isConsecutive = lastRenderedEmail === message.user_email && (msgTime - lastRenderedTimestamp < 120000);
            lastRenderedEmail = message.user_email;
            lastRenderedTimestamp = msgTime;
        }

        const messageDiv = createMessageDOMElement(message, isConsecutive);
        if (!messageDiv) return;

        if (insertBeforeNode) {
            messagesWrapper.insertBefore(messageDiv, insertBeforeNode);
        } else {
            messagesWrapper.appendChild(messageDiv);
        }

        if (message.expires_at && !message.is_deleted) {
            setupMessageBurnTimer(message.id, message.expires_at);
        }

        if (!isUpdate) checkEmptyState();
    }

    async function toggleReaction(messageId, emoji) {
        if (!db || !currentRoomCode || !currentUser) return;
        try {
            const messageRef = db.collection('rooms').doc(currentRoomCode).collection('messages').doc(messageId);
            const docSnap = await messageRef.get();
            if (!docSnap.exists) return;

            const data = docSnap.data();
            let currentReactions = data.reactions || {};
            if (!currentReactions[emoji]) currentReactions[emoji] = [];

            if (currentReactions[emoji].includes(currentUser.email)) {
                currentReactions[emoji] = currentReactions[emoji].filter(e => e !== currentUser.email);
                if (currentReactions[emoji].length === 0) {
                    delete currentReactions[emoji];
                }
            } else {
                currentReactions[emoji].push(currentUser.email);
            }

            await messageRef.update({ reactions: currentReactions });
        } catch (err) {
            console.error('Failed to toggle reaction:', err);
        }
    }

    function leaveRoomCleanup() {
        if (presenceHeartbeatInterval) {
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
        }
        if (currentRoomCode && currentUser && db) {
            const userPresenceDoc = db.collection('rooms').doc(currentRoomCode).collection('presence').doc(currentUser.uid);
            userPresenceDoc.delete().catch(() => {});
            const typingDoc = db.collection('rooms').doc(currentRoomCode).collection('typing').doc(currentUser.uid);
            typingDoc.delete().catch(() => {});
        }
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }
        if (unsubscribePresence) {
            unsubscribePresence();
            unsubscribePresence = null;
        }
        if (unsubscribeTyping) {
            unsubscribeTyping();
            unsubscribeTyping = null;
        }
        onlineUsers = {};
    }

    function leaveRoom() {
        leaveRoomCleanup();
        currentRoomCode = null;
        if (roomCodeInput) roomCodeInput.value = '';
        showLobby();
    }

    // =====================================================
    // Attach Event Listeners Safely
    // =====================================================

    function attachEventListeners() {
        if (loginBtn) loginBtn.addEventListener('click', handleLogin);
        if (signupBtn) signupBtn.addEventListener('click', handleSignup);
        if (guestBtn) guestBtn.addEventListener('click', handleGuestSignIn);
        if (guestBtnSignup) guestBtnSignup.addEventListener('click', handleGuestSignIn);

        if (showSignupLink) {
            showSignupLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAuthForms();
            });
        }
        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAuthForms();
            });
        }

        if (loginPassword) {
            loginPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin(e);
            });
        }
        if (loginEmail) {
            loginEmail.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin(e);
            });
        }
        if (signupPassword) {
            signupPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSignup(e);
            });
        }

        if (joinRoomBtn) joinRoomBtn.addEventListener('click', handleJoinRoom);
        if (logoutBtnLobby) logoutBtnLobby.addEventListener('click', handleLogout);
        if (roomCodeInput) {
            roomCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleJoinRoom();
            });
        }

        if (suggestedRooms) {
            suggestedRooms.addEventListener('click', (e) => {
                const chip = e.target.closest('.room-chip');
                if (chip) {
                    const targetRoom = chip.getAttribute('data-room');
                    if (targetRoom && roomCodeInput) {
                        roomCodeInput.value = targetRoom;
                        handleJoinRoom();
                    }
                }
            });
        }

        if (sendBtn) sendBtn.addEventListener('click', sendMessage);

        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            messageInput.addEventListener('input', () => {
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
                broadcastTyping();
            });
        }

        if (imageUploadInput) {
            imageUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                imageUploadInput.value = '';
                await uploadImageFile(file);
            });
        }

        // Paste Image Support
        document.addEventListener('paste', async (e) => {
            if (!chatScreen || chatScreen.classList.contains('hidden')) return;

            const clipboardItems = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData));
            if (!clipboardItems || !clipboardItems.items) return;

            for (let i = 0; i < clipboardItems.items.length; i++) {
                if (clipboardItems.items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = clipboardItems.items[i].getAsFile();
                    if (file) {
                        showToast('Pasting image...', 'info');
                        await uploadImageFile(file);
                    }
                    break;
                }
            }
        });

        // Drag & Drop
        if (chatScreen && dragOverlay) {
            window.addEventListener('dragover', (e) => {
                if (chatScreen.classList.contains('hidden')) return;
                e.preventDefault();
                dragOverlay.classList.remove('hidden');
            });

            window.addEventListener('dragleave', (e) => {
                if (e.clientX <= 0 || e.clientY <= 0) {
                    dragOverlay.classList.add('hidden');
                }
            });

            window.addEventListener('drop', async (e) => {
                if (chatScreen.classList.contains('hidden')) return;
                e.preventDefault();
                dragOverlay.classList.add('hidden');

                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        showToast('Uploading dropped image...', 'info');
                        await uploadImageFile(file);
                    } else {
                        showToast('Only image files are supported.', 'error');
                    }
                }
            });
        }

        if (messagesContainer && scrollBottomBtn) {
            messagesContainer.addEventListener('scroll', () => {
                if (!isScrollTicking) {
                    window.requestAnimationFrame(() => {
                        const dist = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
                        if (dist > 160) {
                            scrollBottomBtn.classList.remove('hidden');
                        } else {
                            scrollBottomBtn.classList.add('hidden');
                            if (scrollBadge) scrollBadge.classList.add('hidden');
                        }
                        isScrollTicking = false;
                    });
                    isScrollTicking = true;
                }
            }, { passive: true });

            scrollBottomBtn.addEventListener('click', () => {
                scrollToBottom(true);
            });
        }

        if (loadEarlierBtn) {
            loadEarlierBtn.addEventListener('click', loadEarlierMessages);
        }

        if (shareRoomBtn) {
            shareRoomBtn.addEventListener('click', () => {
                if (!currentRoomCode) return;
                const origin = window.location.origin;
                const path = window.location.pathname;
                const inviteUrl = `${origin}${path}?room=${encodeURIComponent(currentRoomCode)}`;

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inviteUrl).then(() => {
                        showToast(`Invite link copied for #${currentRoomCode}!`, 'success');
                    }).catch(() => {
                        prompt('Copy this invite link:', inviteUrl);
                    });
                } else {
                    prompt('Copy this invite link:', inviteUrl);
                }
            });
        }

        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', () => {
                isSoundMuted = !isSoundMuted;
                localStorage.setItem('nebula_sound_muted', isSoundMuted ? 'true' : 'false');
                updateSoundToggleUI();
                showToast(isSoundMuted ? 'Sound chimes muted' : 'Sound chimes enabled', 'info');
            });
        }

        if (toggleSidebarBtn && chatSidebar) {
            toggleSidebarBtn.addEventListener('click', () => {
                chatSidebar.classList.toggle('sidebar-open');
            });
        }

        if (closeSidebarBtn && chatSidebar) {
            closeSidebarBtn.addEventListener('click', () => {
                chatSidebar.classList.remove('sidebar-open');
            });
        }

        if (messagesWrapper) {
            messagesWrapper.addEventListener('click', async (e) => {
                const img = e.target.closest('.message-image');
                if (img) {
                    openLightbox(img.src);
                    return;
                }

                const copyBtn = e.target.closest('.copy-btn');
                const editBtn = e.target.closest('.edit-btn');
                const deleteBtn = e.target.closest('.delete-btn');
                const reactBtn = e.target.closest('.react-btn');
                const emojiOpt = e.target.closest('.emoji-option');
                const reactionPill = e.target.closest('.reaction-click');

                if (!reactBtn && !emojiOpt) {
                    document.querySelectorAll('.emoji-picker-popup').forEach(p => p.classList.add('hidden'));
                }

                if (copyBtn) {
                    const messageDiv = copyBtn.closest('.message');
                    const content = messageDiv ? messageDiv.getAttribute('data-content') : '';
                    if (content && navigator.clipboard) {
                        navigator.clipboard.writeText(content).then(() => {
                            showToast('Message copied to clipboard!', 'success');
                        }).catch(() => {});
                    }
                }

                if (reactBtn) {
                    const messageId = reactBtn.getAttribute('data-id');
                    const picker = document.getElementById(`picker-${messageId}`);
                    if (picker) {
                        const isHidden = picker.classList.contains('hidden');
                        document.querySelectorAll('.emoji-picker-popup').forEach(p => p.classList.add('hidden'));
                        if (isHidden) picker.classList.remove('hidden');
                    }
                }

                if (emojiOpt || reactionPill) {
                    const target = emojiOpt || reactionPill;
                    const messageId = target.getAttribute('data-id');
                    const emoji = target.getAttribute('data-emoji');
                    document.querySelectorAll('.emoji-picker-popup').forEach(p => p.classList.add('hidden'));
                    await toggleReaction(messageId, emoji);
                }

                if (deleteBtn) {
                    const messageId = deleteBtn.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this message?')) {
                        if (db && currentRoomCode) {
                            try {
                                await db.collection('rooms').doc(currentRoomCode).collection('messages').doc(messageId).update({
                                    is_deleted: true,
                                    content: 'This message was deleted'
                                });
                                showToast('Message deleted', 'info');
                            } catch (err) {
                                console.error('Failed to delete message:', err);
                                showToast('Failed to delete message: ' + err.message, 'error');
                            }
                        }
                    }
                }

                if (editBtn) {
                    const messageId = editBtn.getAttribute('data-id');
                    const msgDiv = editBtn.closest('.message');
                    const prevText = msgDiv ? msgDiv.getAttribute('data-content') : '';
                    const newContent = prompt('Edit your message:', prevText);
                    if (newContent !== null && newContent.trim() !== '') {
                        if (db && currentRoomCode) {
                            try {
                                await db.collection('rooms').doc(currentRoomCode).collection('messages').doc(messageId).update({
                                    content: newContent.trim(),
                                    edited_at: firebase.firestore.FieldValue.serverTimestamp()
                                });
                                showToast('Message updated', 'success');
                            } catch (err) {
                                console.error('Failed to edit message:', err);
                                showToast('Failed to edit message: ' + err.message, 'error');
                            }
                        }
                    }
                }
            });
        }

        if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
        if (imageLightbox) {
            const backdrop = imageLightbox.querySelector('.lightbox-backdrop');
            if (backdrop) backdrop.addEventListener('click', closeLightbox);
        }

        // Stealth Cloak (Panic Mode) & Disguise Controls
        if (panicModeBtn) {
            panicModeBtn.addEventListener('click', () => toggleStealthMode(true));
        }
        if (calcCloseStealthBtn) {
            calcCloseStealthBtn.addEventListener('click', () => toggleStealthMode(false));
        }

        document.querySelectorAll('.calc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-calc');
                handleCalculatorAction(action);
            });
        });

        // Room Wipe (Burn Room) Modal Controls
        if (burnRoomBtn) {
            burnRoomBtn.addEventListener('click', () => {
                if (burnRoomModal) burnRoomModal.classList.remove('hidden');
            });
        }
        if (cancelBurnBtn) {
            cancelBurnBtn.addEventListener('click', () => {
                if (burnRoomModal) burnRoomModal.classList.add('hidden');
            });
        }
        if (burnModalBackdrop) {
            burnModalBackdrop.addEventListener('click', () => {
                if (burnRoomModal) burnRoomModal.classList.add('hidden');
            });
        }
        if (confirmBurnBtn) {
            confirmBurnBtn.addEventListener('click', burnRoom);
        }

        // Auto-Burn Self-Destruct Timer Controls
        if (burnTimerBtn) {
            burnTimerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (burnTimerMenu) burnTimerMenu.classList.toggle('hidden');
            });
        }

        document.querySelectorAll('.burn-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const sec = parseInt(item.getAttribute('data-burn') || '0', 10);
                selectedBurnSeconds = sec;
                document.querySelectorAll('.burn-menu-item').forEach(btn => btn.classList.remove('active'));
                item.classList.add('active');
                if (burnTimerBtn) {
                    if (sec > 0) {
                        burnTimerBtn.classList.add('active');
                    } else {
                        burnTimerBtn.classList.remove('active');
                    }
                }
                if (burnTimerLabel) {
                    if (sec === 0) burnTimerLabel.textContent = 'Off';
                    else if (sec === 30) burnTimerLabel.textContent = '30s';
                    else if (sec === 300) burnTimerLabel.textContent = '5m';
                    else if (sec === 3600) burnTimerLabel.textContent = '1h';
                    else if (sec === 86400) burnTimerLabel.textContent = '24h';
                }
                if (burnTimerMenu) burnTimerMenu.classList.add('hidden');
            });
        });

        document.addEventListener('click', (e) => {
            if (burnTimerMenu && !burnTimerMenu.classList.contains('hidden') && !e.target.closest('#burn-timer-control')) {
                burnTimerMenu.classList.add('hidden');
            }
        });

        // Global Esc Shortcut (Toggles Stealth Cloak / Closes Modals)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (burnRoomModal && !burnRoomModal.classList.contains('hidden')) {
                    burnRoomModal.classList.add('hidden');
                    return;
                }
                if (imageLightbox && !imageLightbox.classList.contains('hidden')) {
                    closeLightbox();
                    return;
                }
                toggleStealthMode();
            }
        });

        // Mouse Spotlight Glow Follower
        document.addEventListener('mousemove', (e) => {
            const container = document.querySelector('.chat-glass-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                container.style.setProperty('--spotlight-x', `${x}px`);
                container.style.setProperty('--spotlight-y', `${y}px`);
            }
        });

        if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', leaveRoom);
        if (logoutBtnChat) logoutBtnChat.addEventListener('click', handleLogout);

        window.addEventListener('beforeunload', () => {
            leaveRoomCleanup();
        });
    }

    // =====================================================
    // Application Startup & Firebase Verification
    // =====================================================

    function startApplication() {
        cacheDOMElements();
        attachEventListeners();
        showLoading();

        // Check for URL room query parameter (?room=ABC)
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            pendingRoomCode = roomParam.trim().toUpperCase();
        }

        // Check active test-mode session
        const savedTestUser = sessionStorage.getItem('nebula_test_user');
        if (savedTestUser) {
            try {
                currentUser = JSON.parse(savedTestUser);
                hideLoading();
                showLobby();
                return;
            } catch (e) {
                sessionStorage.removeItem('nebula_test_user');
            }
        }

        if (auth && !isOfflineFallback) {
            auth.onAuthStateChanged((user) => {
                hideLoading();
                if (sessionStorage.getItem('nebula_test_user')) return;
                if (user) {
                    currentUser = user;
                    showLobby();
                } else {
                    currentUser = null;
                    showScreen(authScreen);
                }
            });
        } else {
            hideLoading();
            showScreen(authScreen);
        }
    }

    function initFirebaseAndLaunch() {
        // Wait gracefully for Firebase CDN libraries if still loading
        let retries = 0;
        const checkTimer = setInterval(() => {
            retries++;
            const isFirebaseReady = typeof window.firebase !== 'undefined' &&
                window.firebase.apps &&
                window.firebase.auth &&
                window.firebase.firestore &&
                window.firebase.storage;

            if (isFirebaseReady) {
                clearInterval(checkTimer);
                try {
                    if (!firebase.apps.length) {
                        firebase.initializeApp(firebaseConfig);
                    }
                    auth = firebase.auth();
                    db = firebase.firestore();
                    storage = firebase.storage();
                } catch (e) {
                    console.warn('Firebase init warning:', e);
                }
                startApplication();
            } else if (retries >= 35) {
                // If network/CDN blocks after 3.5s, fall back to seamless test mode
                clearInterval(checkTimer);
                console.warn('Firebase services delayed or offline. Launching fallback test mode.');
                isOfflineFallback = true;
                startApplication();
            }
        }, 100);
    }

    // Launch application safely when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebaseAndLaunch);
    } else {
        initFirebaseAndLaunch();
    }

})();
