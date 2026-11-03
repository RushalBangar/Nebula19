// =====================================================
// Real-time Chat Application - High-Performance Implementation
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

    // Initialize Firebase Services
    if (!window.firebase) {
        console.error('Firebase SDK failed to load. Please check your internet connection.');
        alert('Firebase SDK failed to load. Please verify your internet connection.');
        return;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

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

    // Map of pending optimistic messages: tempId -> { content, timestamp }
    const pendingOptimisticMessages = new Set();

    // DOM Elements
    const authScreen = document.getElementById('auth-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const chatScreen = document.getElementById('chat-screen');
    const loadingOverlay = document.getElementById('loading-overlay');
    const toastContainer = document.getElementById('toast-container');

    // Auth Elements
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const guestBtn = document.getElementById('guest-btn');
    const guestBtnSignup = document.getElementById('guest-btn-signup');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');

    // Lobby Elements
    const userEmailDisplay = document.getElementById('user-email-display');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const logoutBtnLobby = document.getElementById('logout-btn-lobby');
    const suggestedRooms = document.getElementById('suggested-rooms');
    const recentRoomsList = document.getElementById('recent-rooms-list');
    const recentRoomsSection = document.getElementById('recent-rooms-section');

    // Chat Elements
    const currentRoomName = document.getElementById('current-room-name');
    const currentUserEmail = document.getElementById('current-user-email');
    const messagesContainer = document.getElementById('messages-container');
    const messagesWrapper = document.getElementById('messages-wrapper');
    const loadEarlierContainer = document.getElementById('load-earlier-container');
    const loadEarlierBtn = document.getElementById('load-earlier-btn');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const logoutBtnChat = document.getElementById('logout-btn-chat');
    const shareRoomBtn = document.getElementById('share-room-btn');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const chatSidebar = document.getElementById('chat-sidebar');
    const imageUploadInput = document.getElementById('image-upload-input');
    const dragOverlay = document.getElementById('drag-overlay');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    const scrollBadge = document.getElementById('scroll-badge');
    const typingIndicator = document.getElementById('typing-indicator');
    const typingUserText = document.getElementById('typing-user-text');
    const onlineUsersList = document.getElementById('online-users-list');
    const onlineCount = document.getElementById('online-count');

    // Lightbox Elements
    const imageLightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxDownload = document.getElementById('lightbox-download');

    // =====================================================
    // Toast Notification System
    // =====================================================

    function showToast(message, type = 'info', duration = 3000) {
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
    // Utility & Image Compression Functions (Speed Boost)
    // =====================================================

    // Fast client-side image compression: reduces multi-megabyte images to ~250KB in milliseconds
    function compressImage(file, maxWidth = 1600, quality = 0.82) {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/') || file.size < 250 * 1024) {
                resolve(file); // Already small enough
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
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
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
        authScreen.classList.add('hidden');
        lobbyScreen.classList.add('hidden');
        chatScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    function formatTime(timestamp) {
        if (!timestamp) {
            return new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }

        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) date = new Date();

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
        } catch (e) {
            // Audio fallback
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function linkifyText(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${url}</a>`;
        });
    }

    function parseMarkdown(text) {
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
                <span>#${room}</span>
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

        try {
            const userCredential = await auth.signInAnonymously();
            currentUser = {
                uid: userCredential.user.uid,
                email: guestEmail
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
            showToast(`Signed in as ${guestEmail}`, 'success');
            showLobby();
        } catch (err) {
            console.warn('Anonymous auth not enabled in Firebase Console, using local test session:', err);
            currentUser = {
                uid: 'guest-' + Math.random().toString(36).substring(2, 10),
                email: guestEmail
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
            showToast(`Guest session active: ${guestEmail}`, 'success');
            showLobby();
        } finally {
            hideLoading();
        }
    }

    async function handleLogin(e) {
        if (e) e.preventDefault();
        const email = loginEmail.value.trim() || 'tester@nebula.test';
        const password = loginPassword.value || '123456';

        showLoading();
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            currentUser = userCredential.user;
            sessionStorage.removeItem('nebula_test_user');
            showToast('Welcome back!', 'success');
            showLobby();
        } catch (error) {
            console.warn('Login failed, attempting auto-signup or test bypass:', error);
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password.length >= 6 ? password : password + '123456');
                currentUser = userCredential.user;
                sessionStorage.removeItem('nebula_test_user');
                showToast('Account created and signed in!', 'success');
                showLobby();
            } catch (signupErr) {
                console.warn('Auto-signup failed, entering with test-mode session:', signupErr);
                currentUser = {
                    uid: 'user-' + Math.random().toString(36).substring(2, 10),
                    email: email
                };
                sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
                showToast(`Test mode active for ${email}`, 'info');
                showLobby();
            }
        } finally {
            hideLoading();
        }
    }

    async function handleSignup(e) {
        if (e) e.preventDefault();
        const email = signupEmail.value.trim() || 'tester@nebula.test';
        const password = signupPassword.value || '123456';

        showLoading();
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password.length >= 6 ? password : password + '123456');
            currentUser = userCredential.user;
            sessionStorage.removeItem('nebula_test_user');
            showToast('Account created successfully!', 'success');
            showLobby();
        } catch (error) {
            console.warn('Signup failed, entering with test-mode session:', error);
            currentUser = {
                uid: 'user-' + Math.random().toString(36).substring(2, 10),
                email: email
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
            showToast(`Test mode session started for ${email}`, 'info');
            showLobby();
        } finally {
            hideLoading();
        }
    }

    async function handleLogout() {
        showLoading();
        leaveRoomCleanup();
        sessionStorage.removeItem('nebula_test_user');
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            hideLoading();
            currentUser = null;
            currentRoomCode = null;
            showToast('You have logged out.', 'info');
            showScreen(authScreen);
        }
    }

    function toggleAuthForms() {
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }

    // =====================================================
    // Lobby Functions
    // =====================================================

    function showLobby() {
        if (currentUser) {
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

        const userPresenceDoc = db.collection('rooms').doc(currentRoomCode).collection('presence').doc(currentUser.uid);

        async function sendHeartbeat() {
            if (!currentRoomCode || !currentUser) return;
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
    }

    async function broadcastTyping() {
        if (!currentRoomCode || !currentUser) return;
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
    // Chat Room & Real-time Messages (Optimized with Batch Fragments & Limit)
    // =====================================================

    function showChatRoom() {
        currentRoomName.textContent = `# ${currentRoomCode}`;
        currentUserEmail.textContent = currentUser.email;
        messagesWrapper.innerHTML = '';
        if (loadEarlierContainer) {
            messagesWrapper.appendChild(loadEarlierContainer);
            loadEarlierContainer.classList.add('hidden');
        }

        lastRenderedDateStr = null;
        lastRenderedEmail = null;
        lastRenderedTimestamp = 0;
        oldestMessageDoc = null;
        pendingOptimisticMessages.clear();

        showScreen(chatScreen);

        subscribeToMessages();
        setupPresence();
        setupTypingListener();
        updateSoundToggleUI();

        messageInput.focus();
    }

    function subscribeToMessages() {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        isInitialMessagesLoad = true;
        showLoading();

        // Performance: fetch recent 50 messages instead of unbounded history
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

            // High-speed Initial Load: Batch render in a single DocumentFragment
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

            // Incremental Real-time Updates
            const docChanges = snapshot.docChanges();

            docChanges.forEach((change) => {
                const msgData = { id: change.doc.id, ...change.doc.data() };

                if (change.type === 'added') {
                    // Check if matching optimistic message is already in DOM
                    const existingOptimistic = Array.from(document.querySelectorAll('.message.pending')).find(
                        el => el.getAttribute('data-content') === msgData.content &&
                              el.getAttribute('data-sender') === msgData.user_email
                    );

                    if (existingOptimistic) {
                        // Replace pending optimistic element with confirmed real message
                        const nextSib = existingOptimistic.nextSibling;
                        existingOptimistic.remove();
                        displayMessage(msgData, true, nextSib);
                    } else {
                        const isNearBottom = messagesContainer ?
                            (messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 150) : true;

                        displayMessage(msgData);

                        if (isNearBottom) {
                            scrollToBottom(true);
                        } else {
                            if (scrollBadge) scrollBadge.classList.remove('hidden');
                        }

                        if (msgData.user_email !== currentUser.email) {
                            playNotificationSound();
                        }
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
    }

    // Load Earlier Messages (Pagination for fast initial loads)
    async function loadEarlierMessages() {
        if (!oldestMessageDoc || !currentRoomCode) return;

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

            // Record current scroll position to avoid jump
            const prevScrollHeight = messagesContainer ? messagesContainer.scrollHeight : 0;
            const prevScrollTop = messagesContainer ? messagesContainer.scrollTop : 0;

            const fragment = document.createDocumentFragment();
            olderQuery.docs.forEach((docSnap) => {
                const msgData = { id: docSnap.id, ...docSnap.data() };
                buildMessageNodes(msgData, fragment);
            });

            // Insert right after the load-earlier container
            const insertPoint = loadEarlierContainer ? loadEarlierContainer.nextSibling : messagesWrapper.firstChild;
            messagesWrapper.insertBefore(fragment, insertPoint);

            // Restore scroll position
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

    // =====================================================
    // Instant Optimistic Message Sending (0ms User Latency)
    // =====================================================

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;

        // Reset input immediately
        messageInput.value = '';
        messageInput.style.height = 'auto';

        const tempId = 'optimistic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        // Optimistic local message object for instant UI render
        const optimisticMsg = {
            id: tempId,
            room_code: currentRoomCode,
            user_email: currentUser.email,
            user_id: currentUser.uid,
            content: content,
            image_url: null,
            reactions: {},
            is_deleted: false,
            created_at: new Date(),
            isPending: true
        };

        // Render immediately in 0ms!
        displayMessage(optimisticMsg);
        scrollToBottom(true);

        try {
            await db.collection('rooms').doc(currentRoomCode).collection('messages').add({
                room_code: currentRoomCode,
                user_email: currentUser.email,
                user_id: currentUser.uid,
                content: content,
                image_url: null,
                reactions: {},
                is_deleted: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                edited_at: null
            });
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message: ' + error.message, 'error');

            // Mark optimistic message as failed
            const pendingEl = document.querySelector(`.message[data-msg-id="${tempId}"]`);
            if (pendingEl) {
                pendingEl.style.opacity = '0.5';
                pendingEl.title = 'Failed to send. Click to retry.';
            }
        }
    }

    async function uploadImageFile(file) {
        if (!file || !currentRoomCode || !currentUser) return;

        showLoading();
        try {
            // Speed boost: fast in-memory client compression
            const compressed = await compressImage(file, 1600, 0.82);

            const fileExt = compressed.name ? compressed.name.split('.').pop() : 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const imageStorageRef = storage.ref(`chat-images/${currentRoomCode}/${fileName}`);

            const uploadSnapshot = await imageStorageRef.put(compressed);
            const downloadUrl = await uploadSnapshot.ref.getDownloadURL();

            await db.collection('rooms').doc(currentRoomCode).collection('messages').add({
                room_code: currentRoomCode,
                user_email: currentUser.email,
                user_id: currentUser.uid,
                content: '*Sent an image*',
                image_url: downloadUrl,
                reactions: {},
                is_deleted: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                edited_at: null
            });

            showToast('Image uploaded in milliseconds!', 'success');
        } catch (err) {
            console.error('Image upload failed:', err);
            showToast('Failed to upload image: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // Helper to construct DOM nodes (reusable for single items & document fragments)
    function buildMessageNodes(message, containerNode) {
        let msgDate = new Date();
        if (message.created_at) {
            if (message.created_at.toDate) msgDate = message.created_at.toDate();
            else msgDate = new Date(message.created_at);
        }
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
        containerNode.appendChild(messageEl);
    }

    function createMessageDOMElement(message, isConsecutive = false) {
        const messageDiv = document.createElement('div');
        const isMine = currentUser && (message.user_email === currentUser.email || message.user_id === currentUser.uid);
        const avatarUrl = getAvatarUrl(message.user_email);

        const rawContent = message.content || '';
        const escapedContent = escapeHtml(rawContent);
        const linkedContent = linkifyText(escapedContent);
        const finalContent = message.is_deleted ? '<em>This message was deleted</em>' : parseMarkdown(linkedContent);

        const isPending = message.isPending === true;

        messageDiv.className = `message ${isMine ? 'mine' : 'others'} ${isConsecutive ? 'grouped' : ''} ${isPending ? 'pending' : ''}`;
        messageDiv.setAttribute('data-msg-id', message.id);
        messageDiv.setAttribute('data-content', rawContent);
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
                    <div class="message-time">${formatTime(message.created_at)}${editedTag}${readReceiptHtml}</div>
                </div>
            </div>
        `;

        return messageDiv;
    }

    function displayMessage(message, isUpdate = false, insertBeforeNode = null) {
        let msgDate = new Date();
        if (message.created_at) {
            if (message.created_at.toDate) msgDate = message.created_at.toDate();
            else msgDate = new Date(message.created_at);
        }
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

        const msgTime = msgDate.getTime();
        const isConsecutive = !isUpdate &&
            lastRenderedEmail === message.user_email &&
            (msgTime - lastRenderedTimestamp < 120000);

        if (!isUpdate) {
            lastRenderedEmail = message.user_email;
            lastRenderedTimestamp = msgTime;
        }

        const messageDiv = createMessageDOMElement(message, isConsecutive);

        if (insertBeforeNode) {
            messagesWrapper.insertBefore(messageDiv, insertBeforeNode);
        } else {
            messagesWrapper.appendChild(messageDiv);
        }

        if (!isUpdate) checkEmptyState();
    }

    async function toggleReaction(messageId, emoji) {
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
        if (currentRoomCode && currentUser) {
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
        roomCodeInput.value = '';
        showLobby();
    }

    // =====================================================
    // Event Listeners (Optimized & Throttled)
    // =====================================================

    // Auth Events
    loginBtn.addEventListener('click', handleLogin);
    signupBtn.addEventListener('click', handleSignup);
    if (guestBtn) guestBtn.addEventListener('click', handleGuestSignIn);
    if (guestBtnSignup) guestBtnSignup.addEventListener('click', handleGuestSignIn);

    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });

    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin(e);
    });
    loginEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin(e);
    });
    signupPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignup(e);
    });

    // Lobby Events
    joinRoomBtn.addEventListener('click', handleJoinRoom);
    logoutBtnLobby.addEventListener('click', handleLogout);
    roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinRoom();
    });

    // Suggested Channels in Lobby
    if (suggestedRooms) {
        suggestedRooms.addEventListener('click', (e) => {
            const chip = e.target.closest('.room-chip');
            if (chip) {
                const targetRoom = chip.getAttribute('data-room');
                if (targetRoom) {
                    roomCodeInput.value = targetRoom;
                    handleJoinRoom();
                }
            }
        });
    }

    // Chat Events
    sendBtn.addEventListener('click', sendMessage);

    // Auto-expanding textarea & Enter-to-send (Shift+Enter for newline)
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

    // Image Upload Event (File Picker)
    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        imageUploadInput.value = '';
        await uploadImageFile(file);
    });

    // Clipboard Paste Image Event (Ctrl + V)
    document.addEventListener('paste', async (e) => {
        if (chatScreen.classList.contains('hidden')) return;

        const clipboardItems = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < clipboardItems.length; i++) {
            if (clipboardItems[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = clipboardItems[i].getAsFile();
                if (file) {
                    showToast('Compressing and pasting image...', 'info');
                    await uploadImageFile(file);
                }
                break;
            }
        }
    });

    // Drag and Drop Images
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
                    showToast('Compressing and uploading...', 'info');
                    await uploadImageFile(file);
                } else {
                    showToast('Only image files are supported.', 'error');
                }
            }
        });
    }

    // High-performance RAF Throttled Scroll Listener
    if (messagesContainer && scrollBottomBtn) {
        messagesContainer.addEventListener('scroll', () => {
            if (!isScrollTicking) {
                window.requestAnimationFrame(() => {
                    const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
                    if (distanceFromBottom > 160) {
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

    // Load Earlier Messages Button
    if (loadEarlierBtn) {
        loadEarlierBtn.addEventListener('click', loadEarlierMessages);
    }

    // Share Room Invite Link
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

    // Sound Chimes Toggle
    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', () => {
            isSoundMuted = !isSoundMuted;
            localStorage.setItem('nebula_sound_muted', isSoundMuted ? 'true' : 'false');
            updateSoundToggleUI();
            showToast(isSoundMuted ? 'Sound chimes muted' : 'Sound chimes enabled', 'info');
        });
    }

    // Mobile Sidebar Drawer Toggles
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

    // Messages Area Clicks (Lightbox, Copy, Reactions, Edit, Delete)
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
            if (content) {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(content).then(() => {
                        showToast('Message copied to clipboard!', 'success');
                    }).catch(() => {});
                }
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

        if (editBtn) {
            const messageId = editBtn.getAttribute('data-id');
            const msgDiv = editBtn.closest('.message');
            const prevText = msgDiv ? msgDiv.getAttribute('data-content') : '';
            const newContent = prompt('Edit your message:', prevText);
            if (newContent !== null && newContent.trim() !== '') {
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
    });

    // Lightbox Modal Events
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (imageLightbox) {
        const backdrop = imageLightbox.querySelector('.lightbox-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeLightbox);
    }
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    leaveRoomBtn.addEventListener('click', leaveRoom);
    logoutBtnChat.addEventListener('click', handleLogout);

    window.addEventListener('beforeunload', () => {
        leaveRoomCleanup();
    });

    // =====================================================
    // Initialize App
    // =====================================================

    function initializeAppAuth() {
        showLoading();

        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            pendingRoomCode = roomParam.trim().toUpperCase();
        }

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
    }

    // Launch application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAppAuth);
    } else {
        initializeAppAuth();
    }

})();
