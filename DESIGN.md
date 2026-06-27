# PickleMate Engineering Design Document & Development Roadmap

This document outlines the complete system design, technical architecture, database schemas, and development roadmap for **PickleMate**—a cross-platform application for finding, registering, and organizing pickleball courts, with integrated light social matchmaking.

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
  wechatOpenId   String?       @unique @map("wechat_openid")
  wechatUnionId  String?       @unique @map("wechat_unionid")
  phone          String?       @unique
  courtsCreated  Court[]       @relation("CreatedCourts")
  checkIns       CheckIn[]
  bulletinPosts  BulletinPost[]
  playSessions   PlaySession[] @relation("SessionMembers")
  hostedSessions PlaySession[] @relation("HostSessions")
  createdAt      DateTime      @default(now()) @map("created_at")

  @@map("users")
}

model Court {
  id          String        @id @default(uuid())
  name        String
  address     String
  isIndoor    Boolean       @default(false) @map("is_indoor")
  hasLights   Boolean       @default(false) @map("has_lights")
  numCourts   Int           @default(1) @map("num_courts")
  netType     String?       @map("net_type") // permanent, portable
  surfaceType String?       @map("surface_type") // asphalt, acrylic, wood, concrete
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
  endTime   DateTime @map("end_time")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("check_ins")
}

model BulletinPost {
  id        String   @id @default(uuid())
  content   String
  user      User     @relation(fields: [userId], references: [id])
  userId    String   @map("user_id")
  court     Court    @relation(fields: [courtId], references: [id])
  courtId   String   @map("court_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("bulletin_posts")
}

model PlaySession {
  id          String   @id @default(uuid())
  title       String
  description String?
  court       Court    @relation(fields: [courtId], references: [id])
  courtId     String   @map("court_id")
  host        User     @relation("HostSessions", fields: [hostId], references: [id])
  hostId      String   @map("host_id")
  players     User[]   @relation("SessionMembers")
  maxPlayers  Int      @default(4) @map("max_players")
  skillMin    Float?   @map("skill_min")
  skillMax    Float?   @map("skill_max")
  playTime    DateTime @map("play_time")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("play_sessions")
}
```

---

## 4. Key Endpoints Design

### 4.1 Geosearch (Discover Nearest Courts)
*   **Endpoint:** `GET /courts/nearby`
*   **Query Params:** `lat` (latitude), `lng` (longitude), `radius` (radius in meters, default 5000), `filters` (JSON string of active filters)
*   **Implementation logic (PostgreSQL SQL):**
    ```sql
    SELECT id, name, address, is_indoor, has_lights, net_type, num_courts,
           ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
    FROM courts
    WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance ASC;
    ```

### 4.2 Play Matchmaking (Join Game)
*   **Endpoint:** `POST /sessions/:id/join`
*   **Security:** Requires Bearer JWT Token
*   **Logic:**
    1.  Fetch the PlaySession by ID, load the current player list.
    2.  Check if current players count $\ge$ `maxPlayers`. If yes, throw a `400 Bad Request` ("Session is full").
    3.  Check if user's verified skill level satisfies `skillMin` and `skillMax`.
    4.  Insert relationship, increment counter, return success.

---

## 5. Development Roadmap

The development lifecycle is divided into 6 major milestones, prioritizing native iOS development first, followed by Android native porting, and finally WeChat Mini Program adaptation.

```
                    ┌──────────────────────────────┐
                    │ Phase 1: Base Architecture   │ (COMPLETED)
                    │  - NestJS & Prisma Base      │
                    │  - uni-app Scaffolding       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 2: Core API & iOS Auth │
                    │  - PostgreSQL + PostGIS      │
                    │  - Phone & Apple Sign-In     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 3: iOS Native Map UI   │
                    │  - Apple Maps / Native Map   │
                    │  - Slide-up Court Drawer     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 4: Social & iOS Push   │
                    │  - Play Matchmaking & Check  │
                    │  - Native APNs Notification  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 5: iOS App & Android   │
                    │  - TestFlight / App Store    │
                    │  - Android Native Porting    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 6: WeChat Adaptation   │
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

### Phase 2: Geolocation API & iOS-First Authentication
*   **Task 2.1:** Create PostgreSQL migration script to activate `postgis` extension and add geography column to `courts` table.
*   **Task 2.2:** Build NestJS user registration and SMS-based phone OTP authentication pipeline.
*   **Task 2.3:** Integrate Apple Sign-In on the NestJS backend and uni-app client to support seamless, single-tap authentication for iOS users.
*   **Task 2.4:** Write geospatial NestJS controller supporting distance queries, ratings, and court tags.
*   **Task 2.5:** Build user profile update API (editing DUPR levels, preferred schedules).

### Phase 3: iOS Native Interactive Court Discovery UI
*   **Task 3.1:** Integrate native iOS Map (utilizing Apple Maps / AMaps inside the uni-app `<map>` component, configured for native iOS execution).
*   **Task 3.2:** Request user location coordinates via native iOS permissions (`uni.getLocation`) and translate to map markers.
*   **Task 3.3:** Build a fluid slide-up "Active Court Drawer" sheet displaying distance and checked-in players, designed to match iOS native sheet behavior.
*   **Task 3.4:** Implement tactile search and swipe filter components for Light / Indoor court conditions.
*   **Task 3.5:** Add dynamic court registration forms with native map coordinate selection.

### Phase 4: Social Matching, Bulletin Board & iOS Push Notifications
*   **Task 4.1:** Code the Check-in scheduling panel enabling users to book times.
*   **Task 4.2:** Implement asynchronous "Bulletin Board" chat feed for court conditions (net status, lost paddles).
*   **Task 4.3:** Build "Doubles/Singles Matchmaking Sessions" where hosts post game slots and players tap "Join" (using transactional lock checks to avoid session overflow).
*   **Task 4.4:** Integrate native iOS APNs (Apple Push Notification service) or JPush SDK on iOS to alert players when matches are full or rescheduled.

### Phase 5: iOS Production Compilation, TestFlight & Android Native Porting
*   **Task 5.1:** Run extensive native performance benchmarking on iOS devices, resolving memory overheads or slow database queries.
*   **Task 5.2:** Generate iOS Distribution Profiles, build native release archive via Xcode, and distribute to TestFlight for closed-beta testing.
*   **Task 5.3:** Compile and test Android-native builds, porting native map and notification dependencies to Google Maps / Android push services.
*   **Task 5.4:** Prepare production app bundles (IPA for App Store submission, APK/AAB for Google Play Store and local Android markets).

### Phase 6: WeChat Mini Program Adaptation & Release
*   **Task 6.1:** Build WeChat silent login (`wx.login`) and secure phone-number sharing decryption inside the NestJS authentication module.
*   **Task 6.2:** Adapt frontend Map components to target Tencent Maps inside the WeChat Mini Program container context.
*   **Task 6.3:** Address the strict WeChat 2MB package size limit using uni-app subpackaging configurations and image asset tree-shaking.
*   **Task 6.4:** Configure native WeChat subscription notifications (`wx.requestSubscribeMessage`) for game alerts.
*   **Task 6.5:** Submit compiled WeChat Mini Program package to WeChat Mini Program Admin console for review and public launch.

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
