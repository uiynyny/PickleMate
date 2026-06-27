# PickleMate Engineering Design Document & Development Roadmap

This document outlines the complete system design, technical architecture, database schemas, and development roadmap for **PickleMate**—a cross-platform pickleball social app inspired by [Pickleheads Play](https://apps.apple.com/cn/app/pickleheads-play-pickleball/id6448714446). PickleMate enables users to discover courts on a map, book matches, invite players, and chat with the community.

---

## 1. System Overview & Core Features

### 1.1 Inspired by Pickleheads Play
PickleMate delivers four core pillars:

| Feature | Description |
|---------|-------------|
| **User Management** | Profile system with skill level (self-assessed or DUPR), avatar, stats, match history, and ratings |
| **Court Discovery on Map** | Interactive map showing nearby pickle courts with details, availability, and user reviews |
| **Match Booking & Invitations** | Create sessions, set skill requirements, invite specific players or open to public sign-ups |
| **Real-Time Chat** | Group chats per session/court, direct messages, threaded conversations, polls, and push notifications |

### 1.2 Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   PickleMate Client                    │
│          (uni-app [Vue 3 + TypeScript + Pinia])        │
└────────────┬───────────────────┬──────────────────┬────┘
             │                   │                  │
             ▼                   ▼                  ▼
      WeChat Mini Program     iOS App           Android App
         (WXML / WXSS)       (Swift VM)         (Kotlin VM)
             │                   │                  │
             └─────────────┬─────┴──────────────────┘
                           │ HTTPS / WebSockets
                           ▼
              ┌─────────────────────────┐
              │      NestJS Server      │
              │   (TypeScript Engine)   │
              └────────────┬────────────┘
                           │ Prisma ORM
                           ▼
              ┌─────────────────────────┐
              │      PostgreSQL DB      │
              │    (PostGIS Enabled)    │
              └─────────────────────────┘
```

### Technology Highlights
*   **Frontend:** **uni-app (Vue 3 + TypeScript)**. Compiles to iOS/Android native views and WeChat-native `WXML/WXSS`. Uses **Pinia** for state management and **Sass** for styling.
*   **Backend:** **NestJS (TypeScript)**. Modular framework with built-in guards, validation pipes, Swagger docs, and WebSocket gateway support.
*   **Real-Time:** **WebSockets (via NestJS Gateway)** for chat messages, session updates, and push notifications.
*   **Database:** **PostgreSQL + PostGIS**. Relational system with spatial indexing (`GiST`) for geospatial queries.
*   **ORM:** **Prisma**. Type-safe queries, transactions, and automatic migrations.

---

## 1. System Overview

PickleMate is structured as a modern monorepo separating a high-performance REST/WebSocket backend and an adaptive, cross-platform frontend that targets iOS, Android, and WeChat Mini Programs using a single unified codebase.

```
┌────────────────────────────────────────────────────────┐
│                   PickleMate Client                    │
│          (uni-app [Vue 3 + TypeScript + Pinia])        │
└────────────┬───────────────────┬──────────────────┬────┘
             │                   │                  │
             ▼                   ▼                  ▼
      WeChat Mini Program     iOS App           Android App
         (WXML / WXSS)       (Swift VM)         (Kotlin VM)
             │                   │                  │
             └─────────────┬─────┴──────────────────┘
                           │ HTTPS / WebSockets
                           ▼
              ┌─────────────────────────┐
              │      NestJS Server      │
              │   (TypeScript Engine)   │
              └────────────┬────────────┘
                           │ Prisma ORM
                           ▼
              ┌─────────────────────────┐
              │      PostgreSQL DB      │
              │    (PostGIS Enabled)    │
              └─────────────────────────┘
```

### Technology Highlights
*   **Frontend:** **uni-app (Vue 3 + TypeScript)**. Compiles to iOS/Android native views using local render-engines and compiles directly to WeChat-native `WXML/WXSS`. Uses **Pinia** for state management and **Sass** for styling.
*   **Backend:** **NestJS (TypeScript)**. Highly modular framework built on top of Express/Fastify. Provides built-in support for guards (Auth), validation pipes, and Swagger documentation.
*   **Database:** **PostgreSQL + PostGIS**. Robust relational system utilizing PostGIS's spatial index (`GiST`) for geographical location calculations.
*   **ORM:** **Prisma**. Provides type-safe queries, transaction handles, and automatic migration utilities.

---

## 2. System Architecture & Core Modules

### 2.1 Geospatial Core (Court Finder)
To calculate distance and coordinate clustering, the system stores geographic coordinates in a database using PostGIS's spherical geography projection system (SRID 4326).
*   **Geographical coordinates:** Longitude ($x$) and Latitude ($y$).
*   **Calculations:** Computes spherical distances (meters) on-the-fly and filters elements inside a specific viewport / bounding box.

### 2.2 iOS-First & Unified Auth Model
Because the application prioritizes iOS native deployment first, followed by Android native adaptation, and later WeChat Mini Programs, PickleMate implements a modular and unified authentication scheme:
*   **Phone OTP Authentication (iOS / Android):** The primary and most direct login method on native devices, using SMS verification codes.
*   **Apple Sign-In (iOS-Specific):** Provides a seamless, single-tap authentication experience for iOS users, required for App Store approval when other social logins are present.
*   **WeChat OpenID & UnionID (WeChat Adaptation Phase):** Identifies a unique user within and across WeChat applications. Once WeChat is supported, the UnionID allows seamless account linking with existing native app accounts.
*   **Account Merging:** If a user registers on the iOS app with a phone number and later opens the WeChat Mini Program, linking UnionIDs or verified Phone Numbers merges their profile instantly.

```
User registers via Phone OTP / Apple Sign-In (iOS) ──> Sent to NestJS Backend
                                                            │
                                                            ▼
                                             Generate JWT token (Log In)
                                                            │
                                                            ▼
                             (Later Phase) Link WeChat UnionID / OpenID:
                             Merge WeChat profiles with existing Phone accounts
```

---

## 3. Database Schema Mapping (Prisma)

Here is the finalized database schema representing all models and relationships:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id             String        @id @default(uuid())
  nickname       String
  avatarUrl      String?       @map("avatar_url")
  skillLevel     Float?        @map("skill_level") // Self-assessed or DUPR rating (2.0 - 5.5)
  bio            String?       @map("bio")         // User profile description
  wechatOpenId   String?       @unique @map("wechat_openid")
  wechatUnionId  String?       @unique @map("wechat_unionid")
  phone          String?       @unique
  email          String?       @unique
  isVerified     Boolean       @default(false) @map("is_verified") // Email/phone verified
  
  // Relations
  courtsCreated  Court[]       @relation("CreatedCourts")
  checkIns       CheckIn[]
  bulletinPosts  BulletinPost[]
  playSessions   PlaySession[] @relation("SessionMembers")
  hostedSessions PlaySession[] @relation("HostSessions")
  sentInvites    SessionInvite[] @relation("SentInvites")
  receivedInvites SessionInvite[] @relation("ReceivedInvites")
  chatMessages   ChatMessage[] @relation("UserMessages")
  dmConversations DmConversation[] @relation("DmParticipants")
  
  createdAt      DateTime      @default(now()) @map("created_at")

  @@map("users")
}

model Court {
  id          String        @id @default(uuid())
  name        String
  address     String
  city        String?       @map("city")
  isIndoor    Boolean       @default(false) @map("is_indoor")
  hasLights   Boolean       @default(false) @map("has_lights")
  numCourts   Int           @default(1) @map("num_courts")
  netType     String?       @map("net_type") // permanent, portable
  surfaceType String?       @map("surface_type") // asphalt, acrylic, wood, concrete
  
  // Ratings & reviews
  avgRating   Float?        @default(0) @map("avg_rating")
  reviewCount Int           @default(0) @map("review_count")
  
  isVerified  Boolean       @default(false) @map("is_verified")
  createdBy   User?         @relation("CreatedCourts", fields: [createdById], references: [id])
  createdById String?       @map("created_by_id")
  checkIns    CheckIn[]
  posts       BulletinPost[]
  sessions    PlaySession[]
  
  createdAt   DateTime      @default(now()) @map("created_at")

  // Note: The PostGIS location (GEOGRAPHY(Point, 4326)) is added via raw SQL migration
  // and queried using Prisma's $queryRaw to keep searches fast.
  @@map("courts")
}

model CheckIn {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String   @map("user_id")
  court     Court    @relation(fields: [courtId], references: [id])
  courtId   String   @map("court_id")
  startTime DateTime @map("start_time")
  endTime   DateTime? @map("end_time")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("check_ins")
}

model BulletinPost {
  id        String   @id @default(uuid())
  content   String
  images    String[] @default([]) // Court condition photos
  user      User     @relation(fields: [userId], references: [id])
  userId    String   @map("user_id")
  court     Court    @relation(fields: [courtId], references: [id])
  courtId   String   @map("court_id")
  likes     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("bulletin_posts")
}

model PlaySession {
  id          String            @id @default(uuid())
  title       String
  description String?
  status      SessionStatus     @default(PENDING) // PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
  
  court       Court             @relation(fields: [courtId], references: [id])
  courtId     String            @map("court_id")
  host        User              @relation("HostSessions", fields: [hostId], references: [id])
  hostId      String            @map("host_id")
  
  // Players who joined (not invited)
  players     User[]            @relation("SessionMembers")
  
  maxPlayers  Int               @default(4)   @map("max_players")
  skillMin    Float?            @map("skill_min")
  skillMax    Float?            @map("skill_max")
  isPublic    Boolean           @default(true) @map("is_public") // Public sign-up or invite-only
  
  playTime    DateTime          @map("play_time")
  createdAt   DateTime          @default(now()) @map("created_at")
  
  invites     SessionInvite[]
  chatRoom    ChatRoom?         @relation("SessionChat")

  @@map("play_sessions")
}

enum SessionStatus {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model SessionInvite {
  id        String      @id @default(uuid())
  session   PlaySession @relation(fields: [sessionId], references: [id])
  sessionId String      @map("session_id")
  
  // Sender (usually the host)
  sender    User        @relation("SentInvites", fields: [senderId], references: [id])
  senderId  String      @map("sender_id")
  
  // Recipient
  recipient User        @relation("ReceivedInvites", fields: [recipientId], references: [id])
  recipientId String    @map("recipient_id")
  
  status    InviteStatus @default(PENDING) // PENDING, ACCEPTED, DECLINED, EXPIRED
  
  sentAt    DateTime    @default(now())   @map("sent_at")
  respondedAt DateTime? @map("responded_at")

  @@map("session_invites")
}

enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

model ChatRoom {
  id        String         @id @default(uuid())
  
  // Either a session or a court group chat
  sessionId String?        @map("session_id")
  session   PlaySession?   @relation("SessionChat", fields: [sessionId], references: [id])
  
  courtId   String?        @map("court_id")
  court     Court?         @relation(fields: [courtId], references: [id])
  
  name      String?        // Group chat display name
  
  participants User[]      @relation("ChatParticipants")
  
  messages  ChatMessage[]
  
  createdAt DateTime       @default(now()) @map("created_at")

  @@map("chat_rooms")
}

model DmConversation {
  id        String         @id @default(uuid())
  
  participants User[]      @relation("DmParticipants")
  
  messages  ChatMessage[]
  
  createdAt DateTime       @default(now()) @map("created_at")

  @@map("dm_conversations")
}

model ChatMessage {
  id        String   @id @default(uuid())
  content   String
  type      MessageType @default(TEXT) // TEXT, IMAGE, POLL, SYSTEM
  
  user      User     @relation("UserMessages", fields: [userId], references: [id])
  userId    String   @map("user_id")
  
  // Belongs to either a chat room or DM conversation
  roomId    String?  @map("room_id")
  room      ChatRoom? @relation(fields: [roomId], references: [id])
  
  dmId      String?  @map("dm_id")
  dm        DmConversation? @relation(fields: [dmId], references: [id])
  
  // For threaded replies
  parentId  String?  @map("parent_id")   // Reply to message ID
  parent    ChatMessage? @relation("MessageReplies", fields: [parentId], references: [id])
  replies   ChatMessage[]                  @relation("MessageReplies")
  
  // Poll data (when type is POLL)
  pollOptions String? @map("poll_options") // JSON array of options
  
  isDeleted Boolean  @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at")
  
  createdAt DateTime @default(now()) @map("created_at")

  @@map("chat_messages")
}

enum MessageType {
  TEXT
  IMAGE
  POLL
  SYSTEM
}
```

---

## 4. Key Endpoints Design

### 4.1 User Management
*   **Register/Login:** `POST /auth/register`, `POST /auth/login` (Phone OTP + Apple Sign-In)
*   **Profile:** `GET/PUT /users/me` — View and update profile, skill level, avatar, bio
*   **Search Users:** `GET /users/search?q=keyword&skillMin=X&skillMax=Y`

### 4.2 Court Discovery (Map-Based)
*   **Nearby Courts:** `GET /courts/nearby?lat=&lng=&radius=` — Returns courts within radius sorted by distance using PostGIS queries:
    ```sql
    SELECT id, name, address, is_indoor, has_lights, net_type, num_courts, avg_rating, review_count,
           ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
    FROM courts
    WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance ASC;
    ```
*   **Court Details:** `GET /courts/:id` — Full court info, reviews, upcoming sessions, bulletin posts
*   **Create Court:** `POST /courts` — Submit new court with map pin coordinates

### 4.3 Match Booking & Invitations
*   **Create Session:** `POST /sessions` — Host creates a play session (set time, max players, skill range, public/invite-only)
*   **Join Session:** `POST /sessions/:id/join` — Player joins open session (transactional lock check for capacity)
*   **Invite Players:** `POST /sessions/:id/invite` — Host sends invitations to specific users:
    1. Validate host permission on session
    2. Create `SessionInvite` records with `PENDING` status
    3. Emit WebSocket event to recipients for real-time notification
*   **Respond to Invite:** `POST /invites/:id/respond` — Accept/Decline invitation:
    * On ACCEPT: add recipient to session players list, update invite status
    * On DECLINE: update invite status, notify host via WebSocket
*   **List My Sessions:** `GET /users/me/sessions?tab=hosting|joined|invited`

### 4.4 Real-Time Chat (WebSocket)
*   **Session/Court Group Chats:** WebSocket rooms per session or court for live messaging
    * Events: `chat:message`, `chat:typing`, `chat:userJoined`, `chat:userLeft`
*   **Direct Messages:** WebSocket-based DM between two users
    * Events: `dm:message`, `dm:typing`
*   **Chat Features Supported:**
    * Text messages with markdown support
    * Image attachments (stored in cloud storage)
    * Threaded replies on messages
    * Poll creation and voting within chat
    * Message read receipts

### 4.5 Check-In & Bulletin Board
*   **Check In:** `POST /courts/:id/checkin` — Start a check-in at a court
*   **End Check In:** `PUT /checkins/:id/end` — End the session
*   **Bulletin Posts:** `GET/POST /courts/:id/bulletin` — Post court conditions, photos, and comments

---

## 5. Development Roadmap

The development lifecycle is divided into 7 major milestones, prioritizing core user management and court discovery first, then adding matchmaking, invitations, chat, and finally native platform releases.

```
                    ┌──────────────────────────────┐
                    │ Phase 1: Base Architecture   │ (COMPLETED)
                    │  - NestJS & Prisma Base      │
                    │  - uni-app Scaffolding       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 2: User Management     │ (NEXT)
                    │  - Auth (OTP/Apple/WeChat)   │
                    │  - Profiles & Skill Levels   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 3: Court Discovery     │
                    │  - Map with PostGIS Courts   │
                    │  - Court Details & Reviews   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 4: Match Booking       │
                    │  - Create/Join Sessions      │
                    │  - Invite System             │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 5: Real-Time Chat      │
                    │  - Group Chats (Session/Court)│
                    │  - Direct Messages            │
                    │  - Polls & Threads           │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 6: Native Releases     │
                    │  - iOS TestFlight / App Store│
                    │  - Android APK/AAB           │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 7: WeChat Adaptation   │
                    │  - wx.login / UnionID Auth   │
                    │  - Tencent Map & Subpackages │
                    └──────────────────────────────┘
```

### Phase 1: Base Architecture & Setup (COMPLETED ✅)
*   [x] Set up unified workspace directories.
*   [x] Initialize NestJS backend with configurations and modules.
*   [x] Establish PostgreSQL database entities with type-safe Prisma Schema.
*   [x] Initialize Vue 3, TS, Vite, Pinia, and Sass frontend compile chains.
*   [x] Create primary tab layout: Map discovery view and profile view.
*   [x] Build validation check: H5 compile and WeChat Mini Program compile successful.

### Phase 2: User Management System (NEXT)
*   **Task 2.1:** Create PostgreSQL migration script to activate `postgis` extension and add geography column to `courts` table.
*   **Task 2.2:** Build NestJS user registration and SMS-based phone OTP authentication pipeline.
*   **Task 2.3:** Integrate Apple Sign-In on the NestJS backend and uni-app client for seamless iOS single-tap auth.
*   **Task 2.4:** Implement JWT token management with refresh tokens and secure storage in Pinia store.
*   **Task 2.5:** Build user profile CRUD API (avatar, bio, skill level, DUPR integration).
*   **Task 2.6:** Add user search endpoint with keyword, skill range, and location filters.

### Phase 3: Court Discovery on Map
*   **Task 3.1:** Integrate native iOS Map component inside uni-app `<map>` (Apple Maps / AMaps configured for iOS execution).
*   **Task 3.2:** Implement PostGIS-powered geosearch endpoint returning courts within viewport bounds.
*   **Task 3.3:** Build interactive map UI with court markers, cluster grouping, and tap-to-reveal detail cards.
*   **Task 3.4:** Create slide-up court detail drawer showing distance, amenities, ratings, upcoming sessions, and bulletin posts.
*   **Task 3.5:** Add search bar with filters (indoor/outdoor, lights, surface type) and radius slider.
*   **Task 3.6:** Implement court creation form with map pin drop and address autocomplete.

### Phase 4: Match Booking & Invitations
*   **Task 4.1:** Build session CRUD endpoints — create, update, cancel, complete play sessions.
*   **Task 4.2:** Implement join/leave session logic with transactional capacity checks (prevent overflow).
*   **Task 4.3:** Create invitation system: host sends invites → recipient accepts/declines → auto-add to players list on accept.
*   **Task 4.4:** Build WebSocket events for invite notifications (`invite:sent`, `invite:accepted`, `invite:expired`).
*   **Task 4.5:** Add session listing pages — "My Sessions" (hosting, joined, invited) with status tabs.
*   **Task 4.6:** Implement skill-matching suggestions when creating sessions (recommend players at similar level).

### Phase 5: Real-Time Chat Platform
*   **Task 5.1:** Set up NestJS WebSocket gateway with room-based messaging architecture.
*   **Task 5.2:** Build session group chat — auto-create chat room when session is created, participants join automatically.
*   **Task 5.3:** Implement court group chat — persistent chat per court for ongoing community discussion.
*   **Task 5.4:** Add direct messaging between two users with conversation list and unread badges.
*   **Task 5.5:** Support message types: text, images (cloud storage), polls (create + vote), threaded replies.
*   **Task 5.6:** Implement typing indicators, read receipts, and online status presence.
*   **Task 5.7:** Add push notifications for new messages, invites, and session updates (APNs iOS / FCM Android).

### Phase 6: Native Platform Releases
*   **Task 6.1:** Run performance benchmarking on iOS devices — optimize map rendering, WebSocket reconnection, and database queries.
*   **Task 6.2:** Generate iOS Distribution Profiles, build via Xcode, distribute to TestFlight for closed-beta testing.
*   **Task 6.3:** Compile Android-native builds — port map dependencies to Google Maps, push to FCM.
*   **Task 6.4:** Prepare production app bundles (IPA for App Store submission, APK/AAB for Google Play and Android markets).
*   **Task 6.5:** Set up crash reporting (Sentry) and analytics (Mixpanel/Amplitude) for both platforms.

### Phase 7: WeChat Mini Program Adaptation & Release
*   **Task 7.1:** Build WeChat silent login (`wx.login`) and phone-number decryption inside NestJS auth module.
*   **Task 7.2:** Link WeChat UnionID with existing native app accounts for seamless cross-platform identity.
*   **Task 7.3:** Adapt map components to Tencent Maps within the WeChat Mini Program container.
*   **Task 7.4:** Implement uni-app subpackaging to stay under 2MB initial package limit.
*   **Task 7.5:** Configure WeChat subscription messages (`wx.requestSubscribeMessage`) for session and chat alerts.
*   **Task 7.6:** Submit compiled Mini Program package to WeChat Admin console for review and public launch.

---

## 6. Local Environmental Variables Configuration

Create a `.env` file in `/backend` to establish active connections:

```ini
PORT=3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/picklemate?schema=public"
JWT_SECRET="YOUR_SUPER_SECRET_KEY"
WECHAT_APPID="YOUR_WECHAT_MINI_APP_ID"
WECHAT_SECRET="YOUR_WECHAT_SECRET"
```

To configure your WeChat Mini Program compilation parameters, insert your active Mini Program AppID in `/frontend/src/manifest.json`:

```json
"mp-weixin": {
  "appid": "YOUR_WECHAT_MINI_APP_ID",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "postcss": true,
    "minified": true
  }
}
```
