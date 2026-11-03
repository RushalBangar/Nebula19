# 🌌 Nebula19 — The Covert & Aesthetic Secret Chat Space

> **"Real-time messaging reimagined for absolute privacy, discretion, and aesthetic immersion."**

---

## 🎯 Vision & Purpose

**Nebula19** is an ultra-private, covert web chat space created for people who require **discreet, secure, and confidential communication**. 

### 🛡️ Why Nebula19?
When someone snoops through a phone or laptop, they invariably check mainstream messaging platforms: **WhatsApp, Instagram Direct, Telegram, iMessage, and Phone Logs**. 

**Nebula19 operates completely off that radar:**
* **Stealth in Plain Sight**: It runs as a sleek, private browser space without leaving chat logs in mainstream apps.
* **Secure Room Codes**: Two or more people can connect secretly anywhere in the world by agreeing on a private room code (e.g. `ALPHA-9`, `PROJECT-X`, `COVERT-7`).
* **Zero Leakage**: Conversations stay locked inside the room; no public directories, no user discovery feeds, and no social graph tracking.
* **Instant Discretion**: If anyone picks up the device, Nebula19 leaves no notification badges or typical chat app breadcrumbs.

---

## 🎨 UI/UX Design & Aesthetic Powers

Nebula19 combines uncompromising privacy with a **cutting-edge Cyberpunk & Glassmorphism design system**:

* **Deep Slate & Ambient Glow**: Ultra-dark OLED-friendly background (`#0f172a`) energized by three floating, blurring neon gradient orbs (**Electric Violet**, **Neon Cyan**, **Hot Pink**).
* **Frosted Crystal Glass**: Multi-layered backdrop blurs (`backdrop-filter: blur(16px)`), subtle translucent borders, and glowing button physics.
* **Fluid Micro-Interactions**: Smooth screen transitions, springy action bars, floating unread indicators, and interactive emoji reaction pills.
* **Clean Micro-Typography**: Rendered in the modern **Outfit** typeface with high-contrast readability and Markdown formatting support.

---

## ⚡ Current Features

### 🔐 1. Private Room Architecture
* **Code-Based Rooms**: Enter any custom channel code to create or join a private room.
* **Recent Rooms Memory**: Quickly hop back into favorite rooms with 1-click chips stored locally.
* **Shareable Secret Links**: Copy direct invite links (`?room=ROOM_CODE`) that auto-fill the destination room.
* **1-Click Guest Sign-In**: Instant test mode for rapid multi-tab secret testing without tedious registration forms.

### 💬 2. Real-Time Chat Engine
* **Instant 0ms Messaging**: Optimistic local rendering paints your messages in 0ms, backed by Firebase real-time synchronization.
* **Batch Document Rendering**: Optimized query limits (`limitToLast(50)`) and single-reflow batch rendering for peak performance.
* **Consecutive Message Grouping**: Cleans up repetitive sender tags and avatars when the same user sends consecutive thoughts.
* **Date Separators**: Clean temporal dividers (*Today*, *Yesterday*, *Date stamps*).
* **Delivery & Read Receipts**: Live single check (`✓`) and neon cyan double checks (`✓✓`) when room participants are online.

### 🖼️ 3. Media & File Sharing
* **Clipboard Image Paste (`Ctrl + V`)**: Copy any screenshot (`Win + Shift + S`) and paste directly into the chat to upload instantly.
* **Drag-and-Drop**: Drag image files straight onto the chat window with a glowing dropzone overlay.
* **Client-Side Image Auto-Compression**: Compresses multi-megabyte photos to balanced web resolution (~200KB) in <50ms for lightning-fast uploads.
* **Click-to-Zoom Lightbox Modal**: View images full-screen with backdrop blur and direct download buttons (`Esc` to close).

### 👥 4. Live Presence & Interactive Extras
* **Live Online Users Sidebar**: Heartbeat tracking displays active room participants in real time.
* **Live Waveform & Indicator**: Pulsing status lights indicating active connection.
* **Live Typing Broadcast**: Ephemeral typing indicator notifying when a partner is typing.
* **Emoji Reactions**: React with `👍`, `❤️`, `😂`, `🎉`, `🚀` on any message with real-time reaction pills.
* **Edit & Soft Delete**: Edit sent messages with `(edited)` badges or soft-delete messages.
* **Audio Chimes**: Subtle audio notifications with a one-click mute/unmute toggle in the header.
* **Glassmorphism Toasts**: Non-blocking neon toast alerts replacing annoying browser popups.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: Vanilla HTML5, CSS3 Custom Design System (Glassmorphism), JavaScript (ES6+ Module Architecture).
* **Backend as a Service**: **Firebase (Modular / UMD Compat)**
  * **Authentication**: Firebase Auth (Email/Password & Anonymous Guest Sessions).
  * **Database**: Cloud Firestore (Real-time subcollections: `rooms/{roomCode}/messages`, `presence`, `typing`).
  * **Storage**: Firebase Cloud Storage (`chat-images/{roomCode}/`).
* **Icons & Fonts**: FontAwesome 6.4.0 & Google Fonts (`Outfit`).

---

## 🔒 Security & Privacy Guidelines

To preserve total privacy:
1. **Agree on Secret Room Codes**: Use non-obvious room codes (e.g. `STG-8821` instead of `TEST`).
2. **Clear History / Delete**: Use the message deletion feature or clear recent rooms before closing the session.
3. **Session Purge on Logout**: Clicking **Logout** purges all in-memory and session credentials immediately.

---

## 🔮 Privacy Roadmap (Future Enhancements)

- [ ] **End-to-End Client-Side Encryption (E2EE)**: Encrypting message payloads via Web Crypto API (AES-256-GCM) with the room code as key before sending to Firebase.
- [ ] **Self-Destructing / Ephemeral Messages**: Auto-deletion timers (e.g. destroy after 5 minutes / 1 hour / 24 hours).
- [ ] **Panic Button / Camouflage Mode**: Pressing `Esc` or a discrete icon instantly disguises the tab as a clean calculator or notepad screen.
- [ ] **Screenshot Blocker / Blur on Tab Switch**: Automatically blur chat contents when the browser window loses focus.

---

## 👨‍💻 Author & Credits

* **Creator**: Built with ❤️ by **Rushal Bangar**
* **Repository**: [https://github.com/RushalBangar/Nebula19](https://github.com/RushalBangar/Nebula19)
