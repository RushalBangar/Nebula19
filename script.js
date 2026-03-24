// =====================================================
// Real-time Chat Application - JavaScript Logic
// =====================================================

(function () {
    'use strict';

    // Supabase Configuration
    const SUPABASE_URL = 'https://qlpjeqitecwfeotjnzes.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscGplcWl0ZWN3ZmVvdGpuemVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDMyMDIsImV4cCI6MjA4OTkxOTIwMn0.s_e-1X0NafgIgRovEziyrSsStxZGNoTlBRdkh2Mxro4';

    // Initialize Supabase Client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Global State
    let currentUser = null;
    let currentRoomCode = null;
    let realtimeChannel = null;
    let typingTimeout = null;
    let onlineUsers = {};

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
    const messagesWrapper = document.getElementById('messages-wrapper');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const logoutBtnChat = document.getElementById('logout-btn-chat');
    const imageUploadInput = document.getElementById('image-upload-input');

    // =====================================================
    // Utility Functions
    // =====================================================

    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function showScreen(screen) {
        authScreen.classList.add('hidden');
        lobbyScreen.classList.add('hidden');
        chatScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    function showError(message) {
        alert(message); // You can replace this with a better toast notification
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function getAvatarUrl(email) {
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
    }

    function playNotificationSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3; // Subtle volume
            audio.play().catch(err => console.log('Sound play failed:', err));
        } catch (error) {
            console.log('Sound not available:', error);
        }
    }

    function linkifyText(text) {
        // Regex to detect URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" class="message-link">${url}</a>`;
        });
    }

    function showTypingIndicator(userEmail) {
        const typingDiv = document.getElementById('typing-indicator');
        const typingText = document.getElementById('typing-user-text');
        
        if (typingDiv && userEmail) {
            if (typingText) {
                const username = userEmail.split('@')[0];
                typingText.textContent = `${username} is typing...`;
            }
            typingDiv.classList.remove('hidden');

            // Hide after 3 seconds
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                typingDiv.classList.add('hidden');
            }, 3000);
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

    async function toggleReaction(messageId, emoji) {
        // Fetch current reactions
        const { data, error } = await supabase.from('messages').select('reactions').eq('id', messageId).single();
        if(error || !data) return;

        let currentReactions = data.reactions || {};
        if (!currentReactions[emoji]) currentReactions[emoji] = [];

        if (currentReactions[emoji].includes(currentUser.email)) {
            currentReactions[emoji] = currentReactions[emoji].filter(e => e !== currentUser.email);
            if(currentReactions[emoji].length === 0) delete currentReactions[emoji];
        } else {
            currentReactions[emoji].push(currentUser.email);
        }

        await supabase.from('messages').update({ reactions: currentReactions }).eq('id', messageId);
    }

    function updateOnlineUsersUI() {
        const list = document.getElementById('online-users-list');
        const count = document.getElementById('online-count');
        if(!list || !count) return;

        list.innerHTML = '';
        let total = 0;

        for (const [key, state] of Object.entries(onlineUsers)) {
            if(state.length > 0) {
                total++;
                const userEmail = state[0].email;
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="user-status-indicator online"></div>
                    <span>${userEmail.split('@')[0]}</span>
                `;
                list.appendChild(li);
            }
        }
        count.textContent = `${total} Online`;
    }

    function parseMarkdown(text) {
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');             // Italic
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');           // Inline Code
        return text;
    }

    function broadcastTyping() {
        if (realtimeChannel) {
            realtimeChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: currentUser.email }
            });
        }
    }

    // =====================================================
    // Authentication Functions
    // =====================================================

    async function handleLogin(e) {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        showLoading();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        hideLoading();

        if (error) {
            console.error('Login error:', error);
            showError(error.message);
        } else {
            console.log('Login successful:', data.user.email);
            currentUser = data.user;
            showLobby();
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        const email = signupEmail.value.trim();
        const password = signupPassword.value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }

        showLoading();
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        hideLoading();

        if (error) {
            console.error('Signup error:', error);
            showError(error.message);
        } else {
            console.log('Signup successful:', data);
            // Check if email confirmation is required
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showError('This email is already registered. Please log in instead.');
                toggleAuthForms();
            } else if (data.user && !data.session) {
                showError('Account created! Please check your email to confirm your account, then log in.');
                toggleAuthForms();
            } else {
                showError('Account created! You can now log in.');
                toggleAuthForms();
            }
        }
    }

    async function handleLogout() {
        showLoading();
        await supabase.auth.signOut();
        hideLoading();
        currentUser = null;
        currentRoomCode = null;
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        showScreen(authScreen);
    }

    function toggleAuthForms() {
        loginForm.classList.toggle('hidden');
        signupForm.classList.toggle('hidden');
    }

    // =====================================================
    // Lobby Functions
    // =====================================================

    function showLobby() {
        userEmailDisplay.textContent = currentUser.email;
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
    // Chat Room Functions
    // =====================================================

    async function showChatRoom() {
        currentRoomName.textContent = `# ${currentRoomCode}`;
        currentUserEmail.textContent = currentUser.email;
        messagesWrapper.innerHTML = '';

        showScreen(chatScreen);

        // Load existing messages
        await loadMessages();

        // Subscribe to real-time updates
        subscribeToMessages();

        // Focus on input
        messageInput.focus();
    }

    async function loadMessages() {
        showLoading();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('room_code', currentRoomCode)
            .order('created_at', { ascending: true });

        hideLoading();

        if (error) {
            showError('Error loading messages: ' + error.message);
            return;
        }

        if (data && data.length > 0) {
            data.forEach(message => {
                displayMessage(message);
            });
            scrollToBottom();
        }
        
        checkEmptyState();
    }

    function subscribeToMessages() {
        // Unsubscribe from previous channel if exists
        if (realtimeChannel) {
            console.log('Removing previous channel...');
            supabase.removeChannel(realtimeChannel);
        }

        console.log('Setting up real-time subscription for room:', currentRoomCode);

        // Create new channel for real-time updates
        realtimeChannel = supabase
            .channel('room-messages-' + currentRoomCode)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_code=eq.${currentRoomCode}`
                },
                (payload) => {
                    console.log('Real-time update received:', payload);
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new;
                        displayMessage(newMessage);
                        scrollToBottom();

                        if (newMessage.user_email !== currentUser.email) {
                            playNotificationSound();
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const msgDiv = document.querySelector(`.message[data-msg-id="${payload.new.id}"]`);
                        if (msgDiv) {
                            // Instead of manual DOM manipulation which is getting brittle, 
                            // we'll replace the old node entirely with a fresh render:
                            const oldDiv = msgDiv;
                            const currentScroll = messagesWrapper.scrollTop;
                            messagesWrapper.removeChild(msgDiv);
                            displayMessage(payload.new, true, oldDiv.nextSibling);
                            messagesWrapper.scrollTop = currentScroll;
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const msgDiv = document.querySelector(`.message[data-msg-id="${payload.old.id}"]`);
                        if (msgDiv) {
                            msgDiv.remove();
                            checkEmptyState();
                        }
                    }
                }
            )
            .on('broadcast', { event: 'typing' }, (payload) => {
                // Show typing indicator if it's from another user
                if (payload.payload.user !== currentUser.email) {
                    showTypingIndicator(payload.payload.user);
                }
            })
            .on('presence', { event: 'sync' }, () => {
                onlineUsers = realtimeChannel.presenceState();
                updateOnlineUsersUI();
            })
            .subscribe(async (status, err) => {
                console.log('Subscription status:', status);
                if (err) {
                    console.error('Subscription error:', err);
                    showError('Real-time connection error. Messages may not update automatically.');
                }
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to real-time updates!');
                    // Track presence
                    await realtimeChannel.track({
                        email: currentUser.email,
                        joined_at: new Date().toISOString()
                    });
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Channel error - real-time updates may not work');
                }
                if (status === 'TIMED_OUT') {
                    console.error('⏱️ Subscription timed out');
                }
            });
    }

    async function sendMessage() {
        const content = messageInput.value.trim();

        if (!content) {
            return;
        }

        const message = {
            room_code: currentRoomCode,
            user_email: currentUser.email,
            content: content,
            user_id: currentUser.id
        };

        // Clear input immediately for better UX
        messageInput.value = '';

        const { error } = await supabase
            .from('messages')
            .insert([message]);

        if (error) {
            showError('Error sending message: ' + error.message);
            // Restore message on error
            messageInput.value = content;
        }
    }

    function displayMessage(message, isUpdate = false, insertBeforeNode = null) {
        const messageDiv = document.createElement('div');
        const isMine = message.user_email === currentUser.email;
        const avatarUrl = getAvatarUrl(message.user_email);

        const escapedContent = escapeHtml(message.content);
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
                    <!-- Emoji Picker Popup (hidden by default) -->
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
            imageHtml = `<img src="${message.image_url}" class="message-image" alt="Attachment" />`;
        }
        
        let reactionsHtml = '';
        if (message.reactions && Object.keys(message.reactions).length > 0 && !message.is_deleted) {
            const pills = Object.entries(message.reactions).map(([emoji, users]) => {
                if(users.length === 0) return '';
                return `<span class="reaction-pill reaction-click" data-id="${message.id}" data-emoji="${emoji}">${emoji} ${users.length}</span>`;
            }).join('');
            reactionsHtml = `<div class="reactions-container">${pills}</div>`;
        }

        const editedTag = message.edited_at ? '<span class="edited-tag">(edited)</span>' : '';
        
        let readReceiptHtml = '';
        if (isMine && !message.is_deleted) {
            const othersOnline = Object.keys(onlineUsers).length > 1; // Assuming currentUser is at least 1
            if (othersOnline) {
                readReceiptHtml = '<i class="fas fa-check-double" style="color:var(--neon-cyan); margin-left: 6px; font-size:10px;" title="Read"></i>';
            } else {
                readReceiptHtml = '<i class="fas fa-check" style="color:var(--text-secondary); margin-left: 6px; font-size:10px;" title="Sent"></i>';
            }
        }

        messageDiv.innerHTML = `
        <img src="${avatarUrl}" alt="Avatar" class="message-avatar" />
        <div class="message-content-wrapper">
            <div class="message-sender">${message.user_email}</div>
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
        
        if(!isUpdate) checkEmptyState();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }

    function leaveRoom() {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
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
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthForms();
    });

    // Allow Enter key for login/signup
    loginPassword.addEventListener('keypress', (e) => {
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

    // Typing indicator
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
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${currentRoomCode}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, file);
            
        if (uploadError) {
            hideLoading();
            showError('Error uploading image: ' + uploadError.message);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);
            
        const imageUrl = publicUrlData.publicUrl;

        const message = {
            room_code: currentRoomCode,
            user_email: currentUser.email,
            content: '*Sent an image*',
            user_id: currentUser.id,
            image_url: imageUrl
        };

        const { error: dbError } = await supabase.from('messages').insert([message]);
        
        hideLoading();
        if (dbError) {
            showError('Error saving message record: ' + dbError.message);
        }
    });

    // Edit, Delete, React Message Actions
    messagesWrapper.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const reactBtn = e.target.closest('.react-btn');
        const emojiOpt = e.target.closest('.emoji-option');
        const reactionPill = e.target.closest('.reaction-click');

        // Close all other pickers
        if (!reactBtn && !emojiOpt) {
            document.querySelectorAll('.emoji-picker-popup').forEach(p => p.classList.add('hidden'));
        }

        if (reactBtn) {
            const messageId = reactBtn.getAttribute('data-id');
            const picker = document.getElementById(`picker-${messageId}`);
            if (picker) {
                // Toggle this specific picker
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
                const { error } = await supabase
                    .from('messages')
                    .update({ is_deleted: true, content: 'This message was deleted' })
                    .eq('id', messageId);
                if (error) showError('Failed to delete message: ' + error.message);
            }
        }

        if (editBtn) {
            const messageId = editBtn.getAttribute('data-id');
            const newContent = prompt('Edit your message:');
            if (newContent !== null && newContent.trim() !== '') {
                const { error } = await supabase
                    .from('messages')
                    .update({ 
                        content: newContent.trim(), 
                        edited_at: new Date().toISOString() 
                    })
                    .eq('id', messageId);
                if (error) showError('Failed to edit message: ' + error.message);
            }
        }
    });

    leaveRoomBtn.addEventListener('click', leaveRoom);
    logoutBtnChat.addEventListener('click', handleLogout);

    // =====================================================
    // Initialize App
    // =====================================================

    async function initializeApp() {
        showLoading();

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        hideLoading();

        if (session) {
            currentUser = session.user;
            showLobby();
        } else {
            showScreen(authScreen);
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                currentUser = null;
                showScreen(authScreen);
            }
        });
    }

    // Start the app
    initializeApp();

})(); // Close IIFE
