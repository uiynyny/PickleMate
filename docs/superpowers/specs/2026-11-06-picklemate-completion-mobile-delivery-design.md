# PickleMate Project Completion & Cross-Platform Mobile App Delivery Design

- **Date:** 2026-11-06
- **Status:** Approved
- **Sizing:** Project (Full Written Design)

---

## 1. Intent and Why

**PickleMate** is a cross-platform social and matchmaking application for pickleball players (`User`), connecting players, physical courts (`Court`), activity declarations (`Check-In`), and scheduled games (`Play Session`).

Phases 1–3 and the core of Phase 4 are already implemented in the repository. The goal of this work is to **finish the remaining product features (Phase 4 completion + Phase 5 Real-Time Chat)**, unify the frontend state/service layer, and **deliver the application as a cross-platform mobile app** using the existing `uni-app` (Vue 3 + TypeScript + Pinia + Sass) architecture targeting:
1. **App-Plus** (`dist/build/app` — native iOS/Android container bundle for HBuilderX / App packager)
2. **WeChat Mini Program** (`dist/build/mp-weixin`)
3. **Installable Mobile H5 / PWA** (`dist/build/h5` with Web App Manifest, service worker, and mobile safe-area layout)

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Complete Phase 4 (Play Sessions, Invitations, Favorites & User Profile):**
   - **Court Detail (`pages/court/detail.vue`):**
     - Add `Favorite` toggle button (`POST /favorites/:courtId`, `DELETE /favorites/:courtId`, `GET /favorites/:courtId/check`).
     - Add an "Upcoming Sessions (球局)" tab displaying upcoming `Play Session` items at that `Court` with one-tap navigation to session details.
     - Add a "Court Chat (球场群聊)" action button that opens the court's persistent group chat room.
   - **Play Session Invitations & Discovery (`pages/play-session/list.vue` & `pages/play-session/detail.vue`):**
     - Add inline **Accept (接受)** and **Decline (拒绝)** buttons on pending invitations in the "Invites (邀请)" tab of `pages/play-session/list.vue` (`POST /play-sessions/invites/:inviteId/respond`).
     - Add automatic expiration of stale pending `SessionInvite` records (invites older than 24 hours or whose `PlaySession.playTime` has passed are transitioned to `EXPIRED`).
     - Add a skill-matching player recommendation endpoint (`GET /play-sessions/:sessionId/recommendations`) and user search integration in `pages/play-session/detail.vue`'s Invite Modal so hosts can invite recommended or searched `User`s with a single tap instead of typing raw UUIDs.
     - Add a "Session Chat (球局群聊)" button on `pages/play-session/detail.vue` for session hosts and joined players.
   - **User Profile & Two-Stage Activation (`pages/profile/profile.vue`):**
     - Return accurate user statistics from `GET /users/profile` (`checkInsCount`, `favoriteCourtsCount`, `hostedSessionsCount`, `joinedSessionsCount`).
     - Allow editing profile fields (`nickname`, `bio`, `skillLevel`, `avatarUrl`) persisted via `PATCH /users/profile`.
     - Display the user's `Favorite` courts with tap-to-navigate to `pages/court/detail`.
     - Support phone OTP login and `Inactive User` -> `Active User` phone binding (`POST /auth/phone/link`) directly from `pages/profile/profile.vue` in compliance with [ADR-0001](../../adr/0001-unified-auth-activation-flow.md).
2. **Complete Phase 5 (Real-Time Chat Platform):**
   - **Database Schema (`backend/prisma/schema.prisma`):**
     - Add `ChatRoom` (linked to either `courtId` or `sessionId`), `DmConversation` (1-on-1 between two `User`s), and `ChatMessage` (`TEXT`, `IMAGE`, `POLL`, `SYSTEM`, `parentId` threaded replies, and `pollOptions` JSON storing poll choices and voter IDs).
   - **Backend (`backend/src/chat/`):**
     - Implement `ChatModule` (`ChatService`, `ChatController`, `ChatGateway`).
     - Lazily provision `ChatRoom` rows when a court or session chat room is requested (and auto-provision on new `PlaySession` creation) so pre-existing courts and sessions work without manual data backfilling.
     - Expose REST endpoints for listing conversations, fetching room/DM messages, sending messages, voting on polls, and starting DMs, paired with Socket.IO real-time broadcasts (`chat:message`, `chat:pollUpdated`, `dm:message`, `chat:typing`).
   - **Frontend (`frontend/src/pages/chat/list.vue` & `frontend/src/pages/chat/room.vue`):**
     - Upgrade bottom `tabBar` in `frontend/src/pages.json` to 4 tabs: **Find Courts (`pages/index/index`)**, **Sessions (`pages/play-session/list`)**, **Messages (`pages/chat/list`)**, and **Profile (`pages/profile/profile`)**.
     - Build `pages/chat/list.vue` with tabs for Joined Group Chats (Court & Session rooms) and Direct Messages (`DmConversation`).
     - Build `pages/chat/room.vue` supporting real-time messaging, threaded reply quoting (`parentId`), interactive poll creation and voting (`POLL`), image URL attachments (`IMAGE`), and direct messaging entry points from player lists.
3. **Complete Cross-Platform Mobile App Delivery (Option A):**
   - Create a centralized API & WebSocket service (`frontend/src/services/api.ts` and `frontend/src/services/socket.ts`) and Pinia stores (`frontend/src/stores/user.ts`, `frontend/src/stores/chat.ts`) with environment-aware base URL configuration.
   - Add mobile PWA support (`frontend/index.html` viewport/apple-mobile-web-app meta tags, `frontend/public/manifest.webmanifest`) and cross-platform build scripts (`build:h5`, `build:mp-weixin`, `build:app`) in `frontend/package.json`.
   - Update [CONTEXT.md](../../../CONTEXT.md) with the domain terms `聊天室 (Chat Room)` and `私信会话 (DM Conversation)`.

### Non-Goals
- Generating signed Apple App Store `.ipa` binaries (requires macOS + Xcode + paid Apple Developer certificates) or signed Google Play `.aab` bundles.
- Integrating live paid third-party cloud credentials for SMS (Aliyun/Tencent), OSS object storage, or APNs/FCM push certificates; local/simulated providers and environment variable hooks remain the default for development and verification.

### Anti-Goals
- **Violating [ADR-0001](../../adr/0001-unified-auth-activation-flow.md):** Never block `Inactive User` or unauthenticated visitors from browsing courts, viewing sessions, or reading public court/session information. Conversely, never allow an `Inactive User` (where `phone` is null) to perform write operations (`ActiveUserGuard` must guard court creation, check-ins, bulletin posts, session creation/join/invite, favorites, and sending chat messages/polls).
- **Relying exclusively on raw Socket.IO client protocol for mutations:** WeChat Mini Program (`mp-weixin`) and mobile web containers can drop WebSocket frames or block custom Socket.IO handshakes; all chat writes must work via standard REST requests while broadcasting real-time updates over WebSocket.

---

## 3. Constraints

1. **Domain Vocabulary ([CONTEXT.md](../../../CONTEXT.md)):** Code symbols, API responses, and UI labels must consistently use `User` (用户), `Inactive User` (未激活用户), `Active User` (激活用户), `Court` (球场), `Check-In` (签到), `Play Session` (球局), `Favorite` (收藏), `Chat Room` (聊天室), and `DM Conversation` (私信会话).
2. **Coordinate System:** All `uni.getLocation` calls must continue using `gcj02` as mandated by `DEV_GUIDE_CN.md`.
3. **uni-app TabBar Constraint:** In `uni-app` and WeChat Mini Programs, every page referenced in `tabBar.list` **must** be declared in the root `pages` array of `pages.json` and generated PNG icons must exist in `frontend/src/static/tabbar/`.

---

## 4. Approaches Considered

### Approach 1 (Selected): Hybrid REST + WebSocket Gateway with Lazy Room Provisioning & 4-Tab Mobile Shell
- **Description:**
  - `ChatModule` provides full REST endpoints for room resolution, history pagination, message creation (text/image/poll/thread reply), and poll voting, and emits real-time events via Socket.IO (`ChatGateway`) and `NotificationsGateway`.
  - `ChatRoom` records for `Court` and `PlaySession` are lazily created via `upsert` on first access (and created eagerly when a new `PlaySession` is created), ensuring compatibility with all existing database records.
  - Frontend uses a unified `api.ts` + Pinia store layer and a lightweight cross-platform WebSocket listener (`socket.ts`) with automatic polling/REST fallback so `h5`, `mp-weixin`, and `app-plus` share 100% of the codebase.
- **Trade-offs:** Slightly more backend controller endpoints than a WebSocket-only design, in exchange for rock-solid reliability across WeChat Mini Program, H5/PWA, and App-Plus.

### Approach 2 (Rejected): Pure Socket.IO Event-Only Chat with Eager SQL Backfill
- **Description:**
  - All chat operations (history, send, reply, poll vote) run exclusively through Socket.IO client events, and migrations backfill `ChatRoom` rows for existing tables.
- **Why Rejected:** `socket.io-client` polling/upgrade handshakes frequently fail inside WeChat Mini Program (`uni.connectSocket`) without brittle third-party adapters, and a dropped socket connection prevents users from sending messages or loading history.

---

## 5. Detailed Technical Design

### 5.1 Database Schema Extensions (`backend/prisma/schema.prisma`)

Add the following models and relations while preserving all existing models (`User`, `RefreshToken`, `Court`, `CheckIn`, `BulletinPost`, `Favorite`, `PlaySession`, `SessionInvite`):

```prisma
model ChatRoom {
  id           String        @id @default(uuid())
  name         String?
  courtId      String?       @unique
  court        Court?        @relation("CourtChatRoom", fields: [courtId], references: [id], onDelete: Cascade)
  sessionId    String?       @unique
  session      PlaySession?  @relation("SessionChatRoom", fields: [sessionId], references: [id], onDelete: Cascade)
  participants User[]        @relation("ChatRoomParticipants")
  messages     ChatMessage[]
  createdAt    DateTime      @default(now())

  @@map("chat_rooms")
}

model DmConversation {
  id           String        @id @default(uuid())
  userAId      String
  userA        User          @relation("DmUserA", fields: [userAId], references: [id], onDelete: Cascade)
  userBId      String
  userB        User          @relation("DmUserB", fields: [userBId], references: [id], onDelete: Cascade)
  messages     ChatMessage[]
  updatedAt    DateTime      @updatedAt
  createdAt    DateTime      @default(now())

  @@unique([userAId, userBId])
  @@map("dm_conversations")
}

model ChatMessage {
  id          String          @id @default(uuid())
  content     String
  type        MessageType     @default(TEXT)
  userId      String
  user        User            @relation("UserChatMessages", fields: [userId], references: [id], onDelete: Cascade)
  roomId      String?
  room        ChatRoom?       @relation(fields: [roomId], references: [id], onDelete: Cascade)
  dmId        String?
  dm          DmConversation? @relation(fields: [dmId], references: [id], onDelete: Cascade)
  parentId    String?
  parent      ChatMessage?    @relation("MessageReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies     ChatMessage[]   @relation("MessageReplies")
  pollOptions String?         // JSON string: Array<{ id: string, text: string, voterIds: string[] }>
  isDeleted   Boolean         @default(false)
  createdAt   DateTime        @default(now())

  @@index([roomId, createdAt])
  @@index([dmId, createdAt])
  @@map("chat_messages")
}

enum MessageType {
  TEXT
  IMAGE
  POLL
  SYSTEM
}
```

- **DM Canonical Ordering (Builder Call):** `DmConversation` stores `userAId` and `userBId` sorted lexicographically (`[min(id1, id2), max(id1, id2)]`) so `@@unique([userAId, userBId])` guarantees at most one DM conversation per pair of users.
- **Poll Data Structure (Builder Call):** `pollOptions` is serialized JSON of `Array<{ id: string; text: string; voterIds: string[] }>`. Voting toggles or switches the user's vote across options and broadcasts `chat:pollUpdated`.

### 5.2 Backend API Additions & Enhancements

1. **`UsersModule` (`backend/src/users/`):**
   - `GET /users/profile`: Enhance response to include `stats: { checkInsCount, favoriteCourtsCount, hostedSessionsCount, joinedSessionsCount }` alongside user fields (`id`, `nickname`, `avatarUrl`, `skillLevel`, `bio`, `phone`, `email`, `isVerified`, `isActive: Boolean(user.phone)`).
2. **`PlaySessionModule` (`backend/src/play-session/`):**
   - **Auto-Expiration of Invites:** When querying `getUserInvites` or `respondToInvite`, automatically mark any `PENDING` invite as `EXPIRED` if `Date.now() - invite.sentAt.getTime() > 24 * 60 * 60 * 1000` or `invite.session.playTime <= new Date()`.
   - **`GET /play-sessions/:sessionId/recommendations`** (Protected: `JwtAuthGuard`):
     - Returns up to 20 active `User`s whose `skillLevel` is within `[session.skillMin, session.skillMax]` (or null if no skill filter match, ordered by closeness to the midpoint), excluding `session.hostId`, already-joined `players`, and users with a `PENDING` invite for that session. Supports optional `?keyword=` query parameter to search by nickname.
3. **`ChatModule` (`backend/src/chat/`):**
   - `POST /chat/rooms/court/:courtId` (Protected: `JwtAuthGuard`): Lazily gets or creates the `ChatRoom` for `courtId`, adds the user to `participants` if authenticated, and returns room details.
   - `POST /chat/rooms/session/:sessionId` (Protected: `JwtAuthGuard`): Lazily gets or creates the `ChatRoom` for `sessionId`, adds the user to `participants`, and returns room details.
   - `GET /chat/rooms` (Protected: `JwtAuthGuard`): Lists all `ChatRoom`s the user participates in (or hosts/joined via `PlaySession`), with latest message preview.
   - `GET /chat/rooms/:roomId/messages?page=1&limit=30` (Public/Optional Auth): Returns paginated messages for the room (including `user`, `parent` reply snippet, and parsed `pollOptions`).
   - `POST /chat/rooms/:roomId/messages` (Protected: `JwtAuthGuard`, `ActiveUserGuard`): Sends a `TEXT`, `IMAGE`, or `POLL` message (with optional `parentId` for threaded replies), saves to DB, ensures user is in `participants`, and emits `chat:message` to the room via WebSocket.
   - `POST /chat/messages/:messageId/vote` (Protected: `JwtAuthGuard`, `ActiveUserGuard`): Records/toggles the user's vote on `optionId` in a `POLL` message and emits `chat:pollUpdated`.
   - `POST /chat/dm/:targetUserId` (Protected: `JwtAuthGuard`, `ActiveUserGuard`): Gets or creates a `DmConversation` between current user and `targetUserId`.
   - `GET /chat/dm` (Protected: `JwtAuthGuard`): Lists user's `DmConversation`s with the other participant's profile and latest message.
   - `GET /chat/dm/:dmId/messages?page=1&limit=30` (Protected: `JwtAuthGuard`): Lists messages in a `DmConversation` (validating the requester is `userAId` or `userBId`).
   - `POST /chat/dm/:dmId/messages` (Protected: `JwtAuthGuard`, `ActiveUserGuard`): Sends a message in a `DmConversation` (supporting `TEXT`, `IMAGE`, and `parentId` replies) and emits `dm:message` to the recipient via `NotificationsGateway`.

### 5.3 Frontend Architecture & Cross-Platform Mobile UI (`frontend/`)

1. **Service & Store Layer:**
   - `frontend/src/services/api.ts`: Centralized `request<T>()` wrapper around `uni.request` reading base URL from `import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'`, automatically attaching `Authorization: Bearer <token>`, and handling 401 token refresh (`POST /auth/refresh`).
   - `frontend/src/stores/user.ts`: Pinia store managing `token`, `refreshToken`, `user`, `isLoggedIn`, `isActiveUser` (`Boolean(user?.phone)`), OTP request/verify, phone linking, and profile refresh.
   - `frontend/src/stores/chat.ts`: Pinia store managing active chat rooms, DM conversations, real-time socket events, and message actions.
2. **4-Tab Mobile Navigation (`frontend/src/pages.json`):**
   - Generate matching PNG icons in `frontend/src/static/tabbar/` (`sessions.png`, `sessions-active.png`, `chat.png`, `chat-active.png` alongside existing `home` and `profile` icons).
   - Configure 4 tabs:
     1. `pages/index/index` — "球场 (Courts)"
     2. `pages/play-session/list` — "球局 (Sessions)"
     3. `pages/chat/list` — "消息 (Messages)"
     4. `pages/profile/profile` — "我的 (Profile)"
   - Secondary pages in `pages.json`:
     - `pages/court/detail`
     - `pages/play-session/create`
     - `pages/play-session/detail`
     - `pages/chat/room`
3. **Page Enhancements:**
   - `pages/court/detail.vue`:
     - Header favorite button (`♥ 已收藏` / `♡ 收藏`).
     - "💬 球场群聊" action button alongside "📍 立即打卡" and "🎾 发起球局".
     - 3 content tabs: `活跃打卡`, `即将开局 (Play Sessions)`, `留言板`.
   - `pages/play-session/list.vue`:
     - In the "邀请 (Invites)" tab, display inviter nickname and inline **接受 (Accept)** / **拒绝 (Decline)** action buttons on each pending invite card.
     - Add a floating or header "+ 发起球局" shortcut that lets users pick a court if navigating directly from the Sessions tab.
   - `pages/play-session/detail.vue`:
     - Add "💬 球局群聊" button to open the session's `ChatRoom`.
     - Tap on any player row (other than self) offers a "发私信 (Message)" action that opens a 1-on-1 DM in `pages/chat/room.vue`.
     - Replace raw User ID text box in Invite Modal with a skill-matched recommended players list (`GET /play-sessions/:id/recommendations`) + nickname search bar and one-tap "邀请" buttons.
   - `pages/chat/list.vue` & `pages/chat/room.vue`:
     - `list.vue`: Switches between "群聊 (Group Chats — Court & Session)" and "私信 (Direct Messages)", showing room title, last message snippet, and timestamp.
     - `room.vue`: Displays message stream, reply banner when quoting a message (`parentId`), "+ 发起投票" modal to post interactive multi-option polls, one-tap poll voting bars with live counts, and text input bar.
   - `pages/profile/profile.vue`:
     - Displays real `checkInsCount`, `favoriteCourtsCount`, and `hostedSessionsCount`.
     - Displays "我的收藏球场 (Favorite Courts)" section with quick navigation.
     - Supports OTP login modal, `Inactive User` phone-binding banner (`POST /auth/phone/link`), and profile editing (`nickname`, `bio`, `skillLevel`) saved via `PATCH /users/profile`.
4. **Cross-Platform Mobile Packaging:**
   - Add `dev:app` and `build:app` (`uni build -p app`) scripts in `frontend/package.json` alongside `build:h5` and `build:mp-weixin`.
   - Add `frontend/public/manifest.webmanifest` and mobile PWA meta tags in `frontend/index.html` (`apple-mobile-web-app-capable`, `viewport-fit=cover`).
   - Verify clean builds across all three targets (`build:h5`, `build:mp-weixin`, `build:app`) and full backend unit/integration test suites.

---

## 6. What Is Left to the Builder

- Exact SCSS spacing, animations, and icon pixel art for the new tabBar PNG icons (matching the `#121212` dark background and `#C1F80A` lime-green accent palette).
- Internal helper structuring inside `ChatService` and `PlaySessionService`.
- Test fixture data in unit/e2e specs.
