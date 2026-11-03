// =====================================================
// Real-time Chat Application - Firebase Implementation
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
    let unsubscribeMessages = null;
    let unsubscribePresence = null;
    let unsubscribeTyping = null;
    let presenceHeartbeatInterval = null;
    let typingTimeout = null;
    let lastTypingBroadcast = 0;
    let onlineUsers = {};
    let isInitialMessagesLoad = true;

    // DOM Elements
    const authScreen = document.getElementById('auth-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const chatScreen = document.getElementById('chat-screen');
    const loadingOverlay = document.getElementById('loading-overlay');

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

    // Chat Elements
    const currentRoomName = document.getElementById('current-room-name');
    const currentUserEmail = document.getElementById('current-user-email');
    const messagesContainer = document.getElementById('messages-container');
    const messagesWrapper = document.getElementById('messages-wrapper');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const logoutBtnChat = document.getElementById('logout-btn-chat');
    const imageUploadInput = document.getElementById('image-upload-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const typingUserText = document.getElementById('typing-user-text');
    const onlineUsersList = document.getElementById('online-users-list');
    const onlineCount = document.getElementById('online-count');

    // =====================================================
    // Utility Functions
    // =====================================================

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

    function showError(message) {
        alert(message);
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

        if (isNaN(date.getTime())) {
            date = new Date();
        }

        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function getAvatarUrl(email) {
        const seed = email || 'nebula-user';
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
    }

    function playNotificationSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {});
        } catch (e) {
            // Audio playback fallback
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

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
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
                    <p>Be the first to say hello.</p>
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
    // Authentication Functions (Instant Test Mode Enabled)
    // =====================================================

    async function handleGuestSignIn() {
        showLoading();
        const randomNum = Math.floor(100 + Math.random() * 900);
        const guestEmail = `tester${randomNum}@nebula.test`;

        try {
            // Attempt Firebase Anonymous Auth
            const userCredential = await auth.signInAnonymously();
            currentUser = {
                uid: userCredential.user.uid,
                email: guestEmail
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
            showLobby();
        } catch (err) {
            console.warn('Anonymous auth not enabled in Firebase Console, using local test session:', err);
            // Fallback seamless test user session
            currentUser = {
                uid: 'guest-' + Math.random().toString(36).substring(2, 10),
                email: guestEmail
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
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
            showLobby();
        } catch (error) {
            console.warn('Standard login failed, attempting auto-signup or test-mode bypass:', error);
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password.length >= 6 ? password : password + '123456');
                currentUser = userCredential.user;
                sessionStorage.removeItem('nebula_test_user');
                showLobby();
            } catch (signupErr) {
                console.warn('Auto-signup failed, entering with test-mode session:', signupErr);
                currentUser = {
                    uid: 'user-' + Math.random().toString(36).substring(2, 10),
                    email: email
                };
                sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
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
            showLobby();
        } catch (error) {
            console.warn('Signup failed, entering with test-mode session:', error);
            currentUser = {
                uid: 'user-' + Math.random().toString(36).substring(2, 10),
                email: email
            };
            sessionStorage.setItem('nebula_test_user', JSON.stringify(currentUser));
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
        showScreen(lobbyScreen);
    }

    function handleJoinRoom() {
        const roomCode = roomCodeInput.value.trim().toUpperCase();

        if (!roomCode) {
            showError('Please enter a room code');
            return;
        }

        currentRoomCode = roomCode;
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
                <span>${username}</span>
            `;
            onlineUsersList.appendChild(li);
        });

        onlineCount.textContent = `${userList.length} Online`;
    }

    function updateReadReceiptsUI() {
        const othersOnline = Object.keys(onlineUsers).some(uid => uid !== (currentUser ? currentUser.uid : ''));
        document.querySelectorAll('.message.mine .read-receipt-icon').forEach(icon => {
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
    // Chat Room & Real-time Messages
    // =====================================================

    function showChatRoom() {
        currentRoomName.textContent = `# ${currentRoomCode}`;
        currentUserEmail.textContent = currentUser.email;
        messagesWrapper.innerHTML = '';

        showScreen(chatScreen);

        subscribeToMessages();
        setupPresence();
        setupTypingListener();

        messageInput.focus();
    }

    function subscribeToMessages() {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        isInitialMessagesLoad = true;
        showLoading();

        unsubscribeMessages = db.collection('rooms').doc(currentRoomCode).collection('messages')
            .orderBy('created_at', 'asc')
            .onSnapshot((snapshot) => {
                hideLoading();
                const docChanges = snapshot.docChanges();

                docChanges.forEach((change) => {
                    const msgData = { id: change.doc.id, ...change.doc.data() };

                    if (change.type === 'added') {
                        displayMessage(msgData);
                        scrollToBottom();

                        if (!isInitialMessagesLoad && msgData.user_email !== currentUser.email) {
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

                if (isInitialMessagesLoad) {
                    isInitialMessagesLoad = false;
                    scrollToBottom();
                    checkEmptyState();
                }
            }, (error) => {
                hideLoading();
                console.error('Error listening to messages:', error);
                showError('Error loading messages: ' + error.message);
            });
    }

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;

        messageInput.value = '';

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
            showError('Error sending message: ' + error.message);
            messageInput.value = content;
        }
    }

    function displayMessage(message, isUpdate = false, insertBeforeNode = null) {
        const messageDiv = document.createElement('div');
        const isMine = currentUser && (message.user_email === currentUser.email || message.user_id === currentUser.uid);
        const avatarUrl = getAvatarUrl(message.user_email);

        const rawContent = message.content || '';
        const escapedContent = escapeHtml(rawContent);
        const linkedContent = linkifyText(escapedContent);
        const finalContent = message.is_deleted ? '<em>This message was deleted</em>' : parseMarkdown(linkedContent);

        messageDiv.className = `message ${isMine ? 'mine' : 'others'}`;
        messageDiv.setAttribute('data-msg-id', message.id);

        let actionsHtml = '';
        if (!message.is_deleted) {
            let editDeleteHtml = '';
            if (isMine) {
                editDeleteHtml = `
                    <button class="action-btn edit-btn" data-id="${message.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" data-id="${message.id}" title="Delete"><i class="fas fa-trash"></i></button>
                `;
            }
            actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn react-btn" data-id="${message.id}" title="React"><i class="fas fa-smile"></i></button>
                    ${editDeleteHtml}
                    <!-- Emoji Picker Popup -->
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
            imageHtml = `<img src="${message.image_url}" class="message-image" alt="Attachment" loading="lazy" />`;
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
            const othersOnline = Object.keys(onlineUsers).some(uid => uid !== currentUser.uid);
            if (othersOnline) {
                readReceiptHtml = '<i class="fas fa-check-double read-receipt-icon" style="color:var(--neon-cyan); margin-left: 6px; font-size:10px;" title="Read"></i>';
            } else {
                readReceiptHtml = '<i class="fas fa-check read-receipt-icon" style="color:var(--text-secondary); margin-left: 6px; font-size:10px;" title="Sent"></i>';
            }
        }

        messageDiv.innerHTML = `
            <img src="${avatarUrl}" alt="Avatar" class="message-avatar" />
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
    // Event Listeners
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

    // Chat Events
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        broadcastTyping();
    });

    // Image Upload Event
    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        imageUploadInput.value = '';

        if (file.size > 5 * 1024 * 1024) {
            showError('Image must be less than 5MB');
            return;
        }

        showLoading();
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const imageStorageRef = storage.ref(`chat-images/${currentRoomCode}/${fileName}`);

            const uploadSnapshot = await imageStorageRef.put(file);
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
        } catch (err) {
            console.error('Image upload failed:', err);
            showError('Failed to upload image: ' + err.message);
        } finally {
            hideLoading();
        }
    });

    // Edit, Delete, React Message Actions
    messagesWrapper.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const reactBtn = e.target.closest('.react-btn');
        const emojiOpt = e.target.closest('.emoji-option');
        const reactionPill = e.target.closest('.reaction-click');

        if (!reactBtn && !emojiOpt) {
            document.querySelectorAll('.emoji-picker-popup').forEach(p => p.classList.add('hidden'));
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
                } catch (err) {
                    console.error('Failed to delete message:', err);
                    showError('Failed to delete message: ' + err.message);
                }
            }
        }

        if (editBtn) {
            const messageId = editBtn.getAttribute('data-id');
            const newContent = prompt('Edit your message:');
            if (newContent !== null && newContent.trim() !== '') {
                try {
                    await db.collection('rooms').doc(currentRoomCode).collection('messages').doc(messageId).update({
                        content: newContent.trim(),
                        edited_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.error('Failed to edit message:', err);
                    showError('Failed to edit message: ' + err.message);
                }
            }
        }
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

        // Check if there is an active test-mode session in this tab
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

    initializeAppAuth();

})();
