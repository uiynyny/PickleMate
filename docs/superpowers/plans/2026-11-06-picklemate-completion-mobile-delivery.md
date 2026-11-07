# PickleMate Completion & Cross-Platform Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 4 (favorites UI, session invitations, skill-matched player recommendations, two-stage user activation profile) and Phase 5 (real-time group & direct chat with polls and threads) of PickleMate, and deliver compiled cross-platform mobile bundles (`uni-app` App-Plus, WeChat Mini Program `mp-weixin`, and installable mobile H5/PWA).

**Architecture:** The NestJS + Prisma + PostGIS backend is extended with a `ChatModule` (hybrid REST endpoints + Socket.IO `ChatGateway` with lazy `ChatRoom` provisioning and lexicographically ordered `DmConversation` pairs), invite expiration and skill-recommendation logic in `PlaySessionModule`, and enriched profile statistics in `UsersModule`. The `uni-app` (Vue 3 + TypeScript + Pinia + Sass) frontend is unified around a centralized `api.ts` / `socket.ts` service layer and Pinia stores (`user`, `chat`), expanded to a 4-tab mobile layout (**Courts · Sessions · Messages · Profile**), and configured to build `h5` (PWA), `mp-weixin`, and `app` bundles.

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL + PostGIS), Socket.IO 4, Jest 29, uni-app 3 (Vue 3.4, Pinia 2, TypeScript 5, Vite 5, Sass).

**Spec:** `docs/superpowers/specs/2026-11-06-picklemate-completion-mobile-delivery-design.md`

## Global Constraints

- Domain vocabulary from `CONTEXT.md` must be used consistently: `User` (用户), `Inactive User` (未激活用户), `Active User` (激活用户), `Court` (球场), `Check-In` (签到), `Play Session` (球局), `Favorite` (收藏), `Chat Room` (聊天室), `DM Conversation` (私信会话).
- Per `docs/adr/0001-unified-auth-activation-flow.md`, read-only endpoints remain accessible to unauthenticated or `Inactive User` accounts (`user.phone === null`), while all write operations must be protected by `JwtAuthGuard` and `ActiveUserGuard`.
- All `uni.getLocation` calls must specify `type: 'gcj02'`.
- All 4 pages in `tabBar.list` (`pages/index/index`, `pages/play-session/list`, `pages/chat/list`, `pages/profile/profile`) must be declared in the root `pages` array of `frontend/src/pages.json` with valid PNG icons in `frontend/src/static/tabbar/`.

## Review Focus

1. **`Court` raw SQL insert vs Prisma `lng`/`lat` NOT NULL columns:** `CourtsService.createCourt` inserts via raw SQL while `schema.prisma` defines `lng Float` and `lat Float`; if `lng`/`lat` lack defaults or aren't included in `INSERT`, court creation fails at runtime (`Task 1`).
2. **Stale invitation acceptance:** Accepting a `PENDING` `SessionInvite` that was sent > 24 hours ago or whose `PlaySession.playTime` is in the past must transition the invite to `EXPIRED` and throw `BadRequestException` rather than adding the user to the session (`Task 3`).
3. **Duplicate or reversed 1-on-1 DM conversations:** Starting a DM from User B to User A when a conversation already exists from User A to User B must resolve to the same `DmConversation` by sorting `[userAId, userBId]` lexicographically (`Task 4`).
4. **Unauthorized DM message access & self-DM prevention:** A user must not be able to create a DM with themselves (`userId === targetUserId`) or read/post messages in a `DmConversation` where they are neither `userAId` nor `userBId` (`Task 4`).
5. **Poll duplicate voting & invalid option IDs:** Voting on a `POLL` message must remove the user's previous vote across all options before toggling/recording their vote on the target `optionId`, and reject unknown `optionId`s or non-`POLL` messages with `BadRequestException` (`Task 4`).

---

### Task 1: Prisma Schema, PostGIS Migration Reconciliation & Domain Glossary Update

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/migrations/20260801072914_init_with_postgis_fix/migration.sql`
- Modify: `backend/src/courts/courts.service.ts:40-44`
- Modify: `backend/src/courts/courts.service.spec.ts:59-84`
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: Existing Prisma models (`User`, `Court`, `PlaySession`, `SessionInvite`)
- Produces:
  - Prisma models: `ChatRoom`, `DmConversation`, `ChatMessage`, `MessageType` (`TEXT | IMAGE | POLL | SYSTEM`)
  - Updated `Court` schema (`lng Float @default(0)`, `lat Float @default(0)`) and `CourtsService.createCourt` SQL including `"lng", "lat", "location"`

- [ ] **Step 1: Write the failing test in `backend/src/courts/courts.service.spec.ts` pinning `"lng"` and `"lat"` in `createCourt` SQL**

```typescript
it('should include lng, lat, and PostGIS location in the INSERT statement when creating a court', async () => {
  (prisma.$queryRawUnsafe as jest.Mock)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'mock-court-id', ...dto, isVerified: false, createdById: 'u1' }]);
  (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

  await service.createCourt('u1', dto);

  const [sql, ...params] = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
  expect(sql).toContain('"lng"');
  expect(sql).toContain('"lat"');
  expect(sql).toContain('"location"');
  expect(params).toContain(dto.lng);
  expect(params).toContain(dto.lat);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- src/courts/courts.service.spec.ts`
Expected: FAIL with `Expected substring: "\"lng\""`

- [ ] **Step 3: Update `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260801072914_init_with_postgis_fix/migration.sql`, `backend/src/courts/courts.service.ts`, and `CONTEXT.md`**

In `backend/prisma/schema.prisma`:
- Add `@default(0)` to `Court.lng` and `Court.lat`.
- Add relations on `User` (`chatRooms ChatRoom[] @relation("ChatRoomParticipants")`, `chatMessages ChatMessage[] @relation("UserChatMessages")`, `dmConversationsA DmConversation[] @relation("DmUserA")`, `dmConversationsB DmConversation[] @relation("DmUserB")`), `Court` (`chatRoom ChatRoom? @relation("CourtChatRoom")`), and `PlaySession` (`chatRoom ChatRoom? @relation("SessionChatRoom")`).
- Add models `ChatRoom`, `DmConversation`, `ChatMessage`, and enum `MessageType` exactly as specified in Section 5.1 of the spec.
- In `backend/prisma/migrations/20260801072914_init_with_postgis_fix/migration.sql`, ensure `CREATE EXTENSION IF NOT EXISTS postgis;`, `"location" geography(Point, 4326)` + `CREATE INDEX "courts_location_gix" ON "Court" USING GIST ("location");`, and DDL for `MessageType`, `chat_rooms`, `dm_conversations`, `chat_messages`, and `_ChatRoomParticipants` are present.
- In `backend/src/courts/courts.service.ts`, update `createCourt` raw SQL to insert `"lng", "lat", "location"` (`VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10, $11, $12)`).
- In `CONTEXT.md`, append definitions for `聊天室 (Chat Room)` and `私信会话 (DM Conversation)`.

- [ ] **Step 4: Regenerate Prisma Client and run `courts.service.spec.ts`**

Run: `npx --prefix backend prisma generate; npm --prefix backend test -- src/courts/courts.service.spec.ts`
Expected: Prisma Client generated successfully and all tests in `courts.service.spec.ts` PASS.

---

### Task 2: User Profile Statistics & Two-Stage Activation (`UsersModule`)

**Files:**
- Create: `backend/src/users/users.service.spec.ts`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.controller.ts`

**Interfaces:**
- Consumes: `PrismaService`
- Produces:
  - `UsersService.getProfile(userId: string)` returning `{ ...user, isActive: boolean, stats: { checkInsCount: number, favoriteCourtsCount: number, hostedSessionsCount: number, joinedSessionsCount: number } }`
  - `UsersService.updateProfile(userId: string, data: { nickname?: string; avatarUrl?: string; skillLevel?: number; bio?: string; email?: string })` validating `skillLevel` in `[0, 5]`

- [ ] **Step 1: Write the failing unit tests in `backend/src/users/users.service.spec.ts`**

```typescript
describe('UsersService', () => {
  it('returns profile with aggregated stats and isActive=true when phone is set', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: 'Ace',
      phone: '13800138000',
      skillLevel: 3.5,
      _count: {
        checkIns: 4,
        favorites: 2,
        hostedSessions: 3,
        playSessions: 5,
      },
    });

    const profile = await service.getProfile('u1');
    expect(profile.isActive).toBe(true);
    expect(profile.stats).toEqual({
      checkInsCount: 4,
      favoriteCourtsCount: 2,
      hostedSessionsCount: 3,
      joinedSessionsCount: 5,
    });
  });

  it('rejects skillLevel outside [0, 5] in updateProfile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null });
    await expect(service.updateProfile('u1', { skillLevel: 6.0 })).rejects.toThrow(BadRequestException);
    await expect(service.updateProfile('u1', { skillLevel: -0.5 })).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- src/users/users.service.spec.ts`
Expected: FAIL (cannot find module or missing `stats`/`isActive`/`BadRequestException`)

- [ ] **Step 3: Implement `getProfile` stats aggregation and `updateProfile` validation in `backend/src/users/users.service.ts` and `users.controller.ts`**

In `UsersService.getProfile(userId: string)`:
- Query `prisma.user.findUnique` with `include: { _count: { select: { checkIns: true, favorites: true, hostedSessions: true, playSessions: true } } }`.
- Return `{ ...userWithoutCount, isActive: Boolean(user.phone), stats: { checkInsCount: user._count.checkIns, favoriteCourtsCount: user._count.favorites, hostedSessionsCount: user._count.hostedSessions, joinedSessionsCount: user._count.playSessions } }`.
In `UsersService.updateProfile`:
- Throw `BadRequestException('技能评分必须在 0 到 5 之间')` if `data.skillLevel !== undefined && (data.skillLevel < 0 || data.skillLevel > 5)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- src/users/users.service.spec.ts`
Expected: PASS

---

### Task 3: Play Session Invite Auto-Expiration & Skill-Matched Player Recommendations (`PlaySessionModule`)

**Files:**
- Create: `backend/src/play-session/play-session.service.spec.ts`
- Modify: `backend/src/play-session/play-session.service.ts`
- Modify: `backend/src/play-session/play-session.controller.ts`

**Interfaces:**
- Consumes: `PrismaService`, `NotificationsGateway`
- Produces:
  - `PlaySessionService.expireStaleInvites(filter?: { recipientId?: string; sessionId?: string }): Promise<number>`
  - `PlaySessionService.getRecommendations(sessionId: string, keyword?: string): Promise<Array<{ id: string; nickname: string | null; avatarUrl: string | null; skillLevel: number | null; bio: string | null }>>`
  - `GET /play-sessions/:sessionId/recommendations?keyword=` in `PlaySessionController`

- [ ] **Step 1: Write the failing unit tests in `backend/src/play-session/play-session.service.spec.ts`**

```typescript
describe('PlaySessionService', () => {
  it('marks pending invites older than 24h as EXPIRED and rejects respondToInvite', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mockPrisma.sessionInvite.findUnique.mockResolvedValue({
      id: 'inv-1',
      recipientId: 'u2',
      status: 'PENDING',
      sentAt: staleDate,
      sessionId: 's1',
      session: { id: 's1', playTime: new Date(Date.now() + 3600000), maxPlayers: 4, skillMin: 2.5, skillMax: 4.0 },
    });
    mockPrisma.sessionInvite.update.mockResolvedValue({ id: 'inv-1', status: 'EXPIRED' });

    await expect(service.respondToInvite('u2', 'inv-1', 'ACCEPTED')).rejects.toThrow(BadRequestException);
    expect(mockPrisma.sessionInvite.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('returns skill-matched active users excluding host, joined players, and pending invitees', async () => {
    mockPrisma.playSession.findUnique.mockResolvedValue({
      id: 's1',
      hostId: 'host-1',
      skillMin: 3.0,
      skillMax: 4.0,
      players: [{ id: 'joined-1' }],
      invites: [{ recipientId: 'invited-1', status: 'PENDING' }],
    });
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'candidate-1', nickname: 'DinkMaster', avatarUrl: null, skillLevel: 3.5, bio: null },
    ]);

    const recs = await service.getRecommendations('s1', 'Dink');
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe('candidate-1');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['host-1', 'joined-1', 'invited-1'] },
          phone: { not: null },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- src/play-session/play-session.service.spec.ts`
Expected: FAIL (`getRecommendations is not a function` / stale invite not expired)

- [ ] **Step 3: Implement `expireStaleInvites`, stale-invite check in `respondToInvite` / `getUserInvites`, and `getRecommendations` in `play-session.service.ts` and `play-session.controller.ts`**

- In `PlaySessionService`:
  - Add `private static readonly INVITE_TTL_MS = 24 * 60 * 60 * 1000;`.
  - Add `async expireStaleInvites(filter?: { recipientId?: string; sessionId?: string }): Promise<number>` that updates `sessionInvite` where `status: 'PENDING'` and `OR: [{ sentAt: { lt: new Date(Date.now() - PlaySessionService.INVITE_TTL_MS) } }, { session: { playTime: { lte: new Date() } } }]` to `status: 'EXPIRED'`.
  - Call `await this.expireStaleInvites({ recipientId: userId })` at the start of `getUserInvites(userId)`.
  - In `respondToInvite(userId, inviteId, status)`, after verifying `invite.status === 'PENDING'`, check if `Date.now() - new Date(invite.sentAt).getTime() > PlaySessionService.INVITE_TTL_MS || new Date(invite.session.playTime) <= new Date()`. If so, update the invite `status` to `'EXPIRED'`, emit `invite:expired` via `notificationsGateway`, and throw `new BadRequestException('This invitation has expired')`.
  - Add `async getRecommendations(sessionId: string, keyword?: string)` that loads the session with `players: { select: { id: true } }` and `invites: { where: { status: 'PENDING' }, select: { recipientId: true } }`, builds `excludedIds = [session.hostId, ...session.players.map(p => p.id), ...session.invites.map(i => i.recipientId)]`, and queries `prisma.user.findMany` for active users (`phone: { not: null }`, `id: { notIn: excludedIds }`, optional `nickname: { contains: keyword, mode: 'insensitive' }`, and `OR: [{ skillLevel: { gte: session.skillMin, lte: session.skillMax } }, { skillLevel: null }]`), sorting by closeness to `(session.skillMin + session.skillMax) / 2` with skill-matched users first, `take: 20`.
- In `PlaySessionController`:
  - Add `@Get(':sessionId/recommendations') @UseGuards(JwtAuthGuard) async getRecommendations(@Param('sessionId') sessionId: string, @Query('keyword') keyword?: string)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- src/play-session/play-session.service.spec.ts`
Expected: PASS

---

### Task 4: Real-Time Chat & Direct Messaging Platform (`ChatModule`)

**Files:**
- Create: `backend/src/chat/chat.service.spec.ts`
- Create: `backend/src/chat/chat.service.ts`
- Create: `backend/src/chat/chat.controller.ts`
- Create: `backend/src/chat/chat.gateway.ts`
- Create: `backend/src/chat/chat.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `NotificationsGateway`, `JwtAuthGuard`, `ActiveUserGuard`
- Produces:
  - `ChatService`:
    - `getOrCreateCourtRoom(courtId: string, userId?: string)`
    - `getOrCreateSessionRoom(sessionId: string, userId?: string)`
    - `getUserRooms(userId: string)`
    - `getRoomMessages(roomId: string, page?: number, limit?: number)`
    - `sendRoomMessage(userId: string, roomId: string, dto: { content: string; type?: 'TEXT' | 'IMAGE' | 'POLL'; parentId?: string; pollOptions?: string[] })`
    - `votePoll(userId: string, messageId: string, optionId: string)`
    - `getOrCreateDm(userId: string, targetUserId: string)`
    - `getUserDms(userId: string)`
    - `getDmMessages(userId: string, dmId: string, page?: number, limit?: number)`
    - `sendDmMessage(userId: string, dmId: string, dto: { content: string; type?: 'TEXT' | 'IMAGE'; parentId?: string })`
  - REST routes under `/chat` in `ChatController` and WebSocket events in `ChatGateway` (`chat:join`, `chat:leave`, `chat:typing`, `chat:message`, `chat:pollUpdated`, `dm:message`)

- [ ] **Step 1: Write the failing unit tests in `backend/src/chat/chat.service.spec.ts` covering lazy room creation, canonical DM ordering, unauthorized DM access, self-DM rejection, and poll voting**

```typescript
describe('ChatService', () => {
  it('lazily provisions a court chat room via upsert', async () => {
    mockPrisma.court.findUnique.mockResolvedValue({ id: 'c1', name: 'Chaoyang Park' });
    mockPrisma.chatRoom.upsert.mockResolvedValue({ id: 'room-c1', courtId: 'c1', name: 'Chaoyang Park 球场群聊' });

    const room = await service.getOrCreateCourtRoom('c1', 'u1');
    expect(room.id).toBe('room-c1');
    expect(mockPrisma.chatRoom.upsert).toHaveBeenCalled();
  });

  it('orders userAId and userBId lexicographically when creating or finding a DM conversation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-a', nickname: 'Alice' });
    mockPrisma.dmConversation.upsert.mockResolvedValue({ id: 'dm-1', userAId: 'user-a', userBId: 'user-z' });

    await service.getOrCreateDm('user-z', 'user-a');
    expect(mockPrisma.dmConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAId_userBId: { userAId: 'user-a', userBId: 'user-z' } },
      }),
    );
  });

  it('rejects self-DM and unauthorized DM message reads', async () => {
    await expect(service.getOrCreateDm('u1', 'u1')).rejects.toThrow(BadRequestException);

    mockPrisma.dmConversation.findUnique.mockResolvedValue({ id: 'dm-1', userAId: 'u1', userBId: 'u2' });
    await expect(service.getDmMessages('intruder', 'dm-1')).rejects.toThrow(ForbiddenException);
  });

  it('switches user vote across poll options without duplicating voterIds and rejects invalid optionId', async () => {
    const initialPoll = [
      { id: 'opt-1', text: 'Saturday 9am', voterIds: ['u1', 'u2'] },
      { id: 'opt-2', text: 'Sunday 4pm', voterIds: [] },
    ];
    mockPrisma.chatMessage.findUnique.mockResolvedValue({
      id: 'm1',
      type: 'POLL',
      roomId: 'r1',
      pollOptions: JSON.stringify(initialPoll),
    });
    mockPrisma.chatMessage.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'm1', type: 'POLL', roomId: 'r1', pollOptions: data.pollOptions }),
    );

    const updated = await service.votePoll('u1', 'm1', 'opt-2');
    expect(updated.parsedPollOptions).toEqual([
      { id: 'opt-1', text: 'Saturday 9am', voterIds: ['u2'] },
      { id: 'opt-2', text: 'Sunday 4pm', voterIds: ['u1'] },
    ]);

    await expect(service.votePoll('u1', 'm1', 'non-existent')).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- src/chat/chat.service.spec.ts`
Expected: FAIL (`Cannot find module './chat.service'`)

- [ ] **Step 3: Implement `ChatService`, `ChatGateway`, `ChatController`, `ChatModule`, and register `ChatModule` in `backend/src/app.module.ts`**

- In `backend/src/chat/chat.gateway.ts`:
  - Decorate with `@WebSocketGateway({ cors: { origin: '*' } })`.
  - Handle `@SubscribeMessage('chat:join')` (`client.join(data.roomId)`), `@SubscribeMessage('chat:leave')` (`client.leave(data.roomId)`), and `@SubscribeMessage('chat:typing')` (`client.to(data.roomId).emit('chat:typing', data)`).
  - Provide `emitToRoom(roomId: string, event: string, payload: any)` (`this.server?.to(roomId).emit(event, payload)`).
- In `backend/src/chat/chat.service.ts`:
  - Implement all methods defined in **Interfaces** above.
  - Parse `pollOptions` JSON into `parsedPollOptions` on returned messages so clients receive structured poll arrays.
  - When `sendRoomMessage` is called with `type === 'POLL'`, require at least 2 non-empty strings in `dto.pollOptions` and serialize as `Array<{ id: string, text: string, voterIds: string[] }>` (`id: 'opt-' + idx`).
  - Broadcast `chat:message` and `chat:pollUpdated` via `ChatGateway.emitToRoom`, and `dm:message` to the other participant via `NotificationsGateway.sendNotification`.
- In `backend/src/chat/chat.controller.ts`:
  - Map all `/chat` endpoints defined in Section 5.2 of the spec.
- Register `ChatModule` in `backend/src/app.module.ts`.

- [ ] **Step 4: Run all backend unit tests to verify everything passes**

Run: `npm --prefix backend test`
Expected: PASS across `auth.service.spec.ts`, `courts.service.spec.ts`, `users.service.spec.ts`, `play-session.service.spec.ts`, and `chat.service.spec.ts`.

---

### Task 5: Frontend Centralized API/Socket Services, Pinia Stores & 4-Tab Mobile Navigation

**Files:**
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/services/socket.ts`
- Create: `frontend/src/stores/user.ts`
- Create: `frontend/src/stores/chat.ts`
- Create: `frontend/src/static/tabbar/sessions.png`
- Create: `frontend/src/static/tabbar/sessions-active.png`
- Create: `frontend/src/static/tabbar/chat.png`
- Create: `frontend/src/static/tabbar/chat-active.png`
- Modify: `frontend/src/pages.json`

**Interfaces:**
- Consumes: Backend REST endpoints (`/auth`, `/users`, `/courts`, `/favorites`, `/play-sessions`, `/chat`)
- Produces:
  - `frontend/src/services/api.ts`:
    - `BASE_URL: string`
    - `apiRequest<T = any>(options: { url: string; method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; data?: any; auth?: boolean }): Promise<{ statusCode: number; data: T }>`
  - `frontend/src/services/socket.ts`:
    - `realtimeBus`: `{ on(event: string, cb: (payload: any) => void): void; off(event: string, cb: (payload: any) => void): void; emit(event: string, payload: any): void }`
  - `frontend/src/stores/user.ts`: `useUserStore()` Pinia store (`token`, `refreshToken`, `user`, `stats`, `isLoggedIn`, `isActiveUser`, `hydrate()`, `requestOtp()`, `verifyOtp()`, `linkPhone()`, `fetchProfile()`, `updateProfile()`, `logout()`)
  - `frontend/src/stores/chat.ts`: `useChatStore()` Pinia store (`rooms`, `dms`, `activeMessages`, `fetchRooms()`, `fetchDms()`, `openCourtRoom()`, `openSessionRoom()`, `openDm()`, `fetchMessages()`, `sendMessage()`, `votePoll()`)

- [ ] **Step 1: Create tabBar PNG icons and update `frontend/src/pages.json` with the 4-tab layout and chat routes**

- Copy or generate valid PNG icons in `frontend/src/static/tabbar/` (`sessions.png`, `sessions-active.png`, `chat.png`, `chat-active.png`).
- Update `frontend/src/pages.json` so `pages` includes `pages/index/index`, `pages/play-session/list`, `pages/chat/list`, `pages/profile/profile`, `pages/court/detail`, `pages/play-session/create`, `pages/play-session/detail`, and `pages/chat/room`, and `tabBar.list` has the 4 tabs:
  1. `pages/index/index` ("球场")
  2. `pages/play-session/list` ("球局")
  3. `pages/chat/list` ("消息")
  4. `pages/profile/profile` ("我的")

- [ ] **Step 2: Implement `frontend/src/services/api.ts`, `frontend/src/services/socket.ts`, `frontend/src/stores/user.ts`, and `frontend/src/stores/chat.ts`**

- `api.ts`: Wraps `uni.request` in a Promise, attaches `Authorization: Bearer <token>` when `token` exists in `uni.getStorageSync('token')`, and if a 401 response occurs while `refreshToken` is present in storage, attempts `POST /auth/refresh` once before retrying.
- `socket.ts`: Provides a lightweight cross-platform event bus + polling/WebSocket bridge compatible with H5, `mp-weixin`, and `app-plus`.
- `user.ts` & `chat.ts`: Implement the Pinia stores consuming `apiRequest`.

- [ ] **Step 3: Verify TypeScript compilation of services and stores**

Run: `npm --prefix frontend run build:h5` (after stubbing or creating `pages/chat/list.vue` and `pages/chat/room.vue` in Task 7, or verify imports cleanly).

---

### Task 6: Frontend Court Detail, Play Session & Profile Mobile Pages Completion

**Files:**
- Modify: `frontend/src/pages/index/index.vue`
- Modify: `frontend/src/pages/court/detail.vue`
- Modify: `frontend/src/pages/play-session/list.vue`
- Modify: `frontend/src/pages/play-session/detail.vue`
- Modify: `frontend/src/pages/play-session/create.vue`
- Modify: `frontend/src/pages/profile/profile.vue`

**Interfaces:**
- Consumes: `apiRequest` from `frontend/src/services/api.ts`, `useUserStore` from `frontend/src/stores/user.ts`, `useChatStore` from `frontend/src/stores/chat.ts`
- Produces:
  - Complete Phase 4 user flows across Court Detail, Play Sessions List/Detail/Create, and User Profile.

- [ ] **Step 1: Enhance `frontend/src/pages/court/detail.vue` with Favorite toggle, Court Chat entry, and Upcoming Play Sessions tab**

- Check `GET /favorites/:courtId/check` on mount when logged in; add header favorite button (`♥ 已收藏` / `♡ 收藏`) calling `POST /favorites/:courtId` or `DELETE /favorites/:courtId`.
- Add `💬 球场群聊` button calling `chatStore.openCourtRoom(courtId)` and navigating to `/pages/chat/room?roomId=...&title=...`.
- Add `球局 (${courtSessions.length})` tab alongside `活跃打卡` and `留言板`, fetching `GET /play-sessions?courtId=${courtId}` and navigating to `/pages/play-session/detail?id=...` on tap.

- [ ] **Step 2: Enhance `frontend/src/pages/play-session/list.vue` and `frontend/src/pages/play-session/detail.vue` with Invite Accept/Decline, Skill-Matched Recommendations, Session Chat, and Player DM**

- In `pages/play-session/list.vue`:
  - In the `invites` tab, render inline **接受 (Accept)** and **拒绝 (Decline)** buttons on each pending invite card calling `POST /play-sessions/invites/:inviteId/respond` with `{ status: 'ACCEPTED' | 'DECLINED' }`.
- In `pages/play-session/detail.vue`:
  - Add `💬 球局群聊` button opening the session's `ChatRoom` in `/pages/chat/room`.
  - Add a `私信` button on each player row (when `player.id !== currentUserId`) calling `POST /chat/dm/:targetUserId` and navigating to `/pages/chat/room?dmId=...&title=...`.
  - Upgrade the Invite Modal to fetch `GET /play-sessions/:sessionId/recommendations?keyword=...`, displaying recommended/searched players with DUPR badge and a 1-tap `邀请` button calling `POST /play-sessions/:sessionId/invite`.

- [ ] **Step 3: Enhance `frontend/src/pages/profile/profile.vue` with real stats, Favorite Courts list, Profile Editor, OTP login, and `Inactive User` phone-linking**

- Replace hardcoded stats and mock WeChat login with `userStore`:
  - Provide Phone OTP Login modal (`POST /auth/otp/request` + `POST /auth/otp/verify`) and Demo Third-Party (`Inactive User`) login option (`POST /auth/apple/login`).
  - When logged in as an `Inactive User` (`!user.phone`), display an activation banner ("当前为未激活用户（仅浏览权限），绑定手机号即可解锁发帖、约球与群聊") with a Phone Linking modal calling `POST /auth/phone/link`.
  - Display real `stats.checkInsCount`, `stats.favoriteCourtsCount`, and `stats.hostedSessionsCount`.
  - Display the user's `Favorite` courts (`GET /favorites`) with tap-to-open `/pages/court/detail?id=...`.
  - Allow editing `nickname`, `bio`, and `skillLevel` via `PATCH /users/profile`.

- [ ] **Step 4: Update `frontend/src/pages/index/index.vue` and `frontend/src/pages/play-session/create.vue` to use centralized `apiRequest`**

- Replace hardcoded `http://localhost:3000` calls with `apiRequest` from `src/services/api.ts`, and store `refreshToken` on OTP verification.

---

### Task 7: Frontend Real-Time Chat Pages & Cross-Platform Mobile Builds (`h5` PWA, `mp-weixin`, `app`)

**Files:**
- Create: `frontend/src/pages/chat/list.vue`
- Create: `frontend/src/pages/chat/room.vue`
- Create: `frontend/public/manifest.webmanifest`
- Modify: `frontend/index.html`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `useChatStore`, `useUserStore`, `apiRequest`
- Produces:
  - `frontend/src/pages/chat/list.vue` (Group Chats & Direct Messages tabs)
  - `frontend/src/pages/chat/room.vue` (Real-time room/DM view with threaded replies, interactive polls, and image sharing)
  - Cross-platform mobile build outputs: `frontend/dist/build/h5`, `frontend/dist/build/mp-weixin`, `frontend/dist/build/app`

- [ ] **Step 1: Create `frontend/src/pages/chat/list.vue` and `frontend/src/pages/chat/room.vue`**

- `pages/chat/list.vue`:
  - Tabs: `群聊 (球场/球局)` (`GET /chat/rooms`) and `私信` (`GET /chat/dm`).
  - Shows conversation avatar/badge (`球场` vs `球局` vs `私信`), title, latest message preview, and relative timestamp; tapping opens `/pages/chat/room`.
- `pages/chat/room.vue`:
  - Supports both `roomId` (group chat) and `dmId` (1-on-1 DM) via page query parameters.
  - Renders messages with sender avatar, nickname, timestamp, quoted parent message preview (`parent`), image attachments (`type === 'IMAGE'`), and interactive poll cards (`type === 'POLL'`) with option vote bars, percentage/count, and 1-tap voting (`POST /chat/messages/:id/vote`).
  - Long-press or tap `回复` on any message sets `replyingTo` banner (`parentId`).
  - Toolbar provides `+ 投票` modal (for group rooms, allowing 2–4 options) and `+ 图片` URL input, plus message text box and `发送` button.
  - Polls for new messages every 4 seconds while active alongside WebSocket event listener so updates appear in real time across H5, `mp-weixin`, and `app-plus`.

- [ ] **Step 2: Configure mobile PWA manifest, viewport meta tags, and cross-platform build scripts**

- Create `frontend/public/manifest.webmanifest` with `"name": "PickleMate"`, `"short_name": "PickleMate"`, `"display": "standalone"`, `"background_color": "#121212"`, `"theme_color": "#C1F80A"`.
- Update `frontend/index.html` with `<link rel="manifest" href="./manifest.webmanifest" />`, `<meta name="theme-color" content="#121212" />`, `<meta name="apple-mobile-web-app-capable" content="yes" />`, and `viewport-fit=cover`.
- Update `frontend/package.json` scripts to include:
  - `"dev:app": "uni -p app"`
  - `"build:app": "uni build -p app"`
  - `"build:h5": "uni build"`
  - `"build:mp-weixin": "uni build -p mp-weixin"`

- [ ] **Step 3: Build and verify backend + all three cross-platform mobile targets**

Run:
1. `npm --prefix backend run build`
2. `npm --prefix backend test`
3. `npm --prefix frontend run build:h5`
4. `npm --prefix frontend run build:mp-weixin`
5. `npm --prefix frontend run build:app`

Expected:
- Backend compiles cleanly (`dist/`) and all unit test suites PASS.
- Frontend builds succeed with zero errors, producing:
  - `frontend/dist/build/h5` (Mobile Web / PWA bundle)
  - `frontend/dist/build/mp-weixin` (WeChat Mini Program bundle)
  - `frontend/dist/build/app` (iOS/Android App-Plus native container bundle)
