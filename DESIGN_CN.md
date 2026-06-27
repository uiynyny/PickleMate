# PickleMate 项目系统设计说明书与研发路线图 (DESIGN & ROADMAP)

本文件详尽记录了 **PickleMate** — 一款灵感来自 [Pickleheads Play](https://apps.apple.com/cn/app/pickleheads-play-pickleball/id6448714446) 的匹克球社交应用。PickleMate 提供四大核心功能：**用户管理系统**、**地图球场发现**、**约战邀请系统**、以及**实时聊天平台**。文件涵盖完整系统架构设计、数据库实体关系、核心模块技术方案、以及分阶段详细研发路线图。

---

## 1. 系统架构设计 (System Architecture)

PickleMate 采用现代的前后端分离 (Monorepo) 架构，确保一套核心代码能够同时完美发布至 **iOS、Android 客户端** 以及 **微信小程序**，后端使用极速且类型安全的 NestJS 企业级框架。

```
┌────────────────────────────────────────────────────────┐
│                  PickleMate 跨端前端                    │
│          (uni-app [Vue 3 + TypeScript + Pinia])        │
└────────────┬───────────────────┬──────────────────┬────┘
             │                   │                  │
             ▼                   ▼                  ▼
          微信小程序            iOS App           Android App
         (WXML / WXSS)       (Swift 容器)        (Kotlin 容器)
             │                   │                  │
             └─────────────┬─────┴──────────────────┘
                           │ 安全 HTTPS / WebSocket 协议
                           ▼
              ┌─────────────────────────┐
              │      NestJS 接口服务     │
              │  (TypeScript 模块化引擎)  │
              └────────────┬────────────┘
                           │ Prisma ORM 
                           ▼
              ┌─────────────────────────┐
              │  PostgreSQL + PostGIS   │
              │   (地理信息空间索引数据库)   │
              └─────────────────────────┘
```

### 1.1 四大核心功能 (Core Features)

| 功能 | 说明 |
|------|------|
| **用户管理系统** | 个人资料、技能等级（自评或DUPR）、头像、统计数据、比赛历史与评分 |
| **地图球场发现** | 交互式地图展示附近匹克球场地，含详情、可用状态和用户评价 |
| **约战邀请系统** | 创建场次、设定技能要求、邀请特定玩家或开放公开报名 |
| **实时聊天平台** | 每场次/球场群聊、私信、线程回复、投票和推送通知 |

### 1.2 技术栈选型优势
*   **前端:** **uni-app (Vue 3 + TS)**。借助于 DCloud 的多端编译技术，Vue 3 代码在微信端会转化为原生的 `WXML/WXSS`，极大地保障了渲染流畅度。在 App 端，则支持使用原生渲染引擎，保障了操作体验与流畅的转场动画。
*   **后端:** **NestJS (TypeScript)**。利用控制反转（IoC）和依赖注入（DI）的模块化开发范式，天然适应团队协同，代码规范性极强。**内置 WebSocket Gateway 支持**，用于实时聊天、会话更新和推送通知。
*   **数据库:** **PostgreSQL + PostGIS 插件**。这是目前最强大、最高效的开源地理空间数据库方案，能够以亚毫秒级延迟处理数十万球场的地理围栏和距离排序查询。
*   **ORM:** **Prisma**。类型安全查询、事务处理和自动迁移工具。

---

## 2. 数据库实体关系与空间查询 (Database & PostGIS)

由于常规 ORM 对 PostGIS 空间几何列的直接支持有限，我们通过 Prisma 管理常规字段关系，并在数据库迁移阶段通过**原生 SQL** 开启 PostGIS 支持并建立 `GiST`（广义搜索树）空间索引，从而大幅提升范围检索性能。

### 2.1 数据库结构设计 (`prisma/schema.prisma`)

以下是完整的 Prisma Schema，包含所有核心模型和关系：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==================== 用户管理 ====================
model User {
  id             String        @id @default(uuid())
  nickname       String
  avatarUrl      String?       @map("avatar_url")
  skillLevel     Float?        @map("skill_level") // 自评或DUPR等级 (2.0 - 5.5)
  bio            String?       @map("bio")         // 用户简介
  wechatOpenId   String?       @unique @map("wechat_openid")
  wechatUnionId  String?       @unique @map("wechat_unionid")
  phone          String?       @unique
  email          String?       @unique
  isVerified     Boolean       @default(false) @map("is_verified") // 邮箱/手机验证状态
  
  // 关联关系
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

// ==================== 球场管理 ====================
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
  
  // 评分与评价
  avgRating   Float?        @default(0) @map("avg_rating")
  reviewCount Int           @default(0) @map("review_count")
  
  isVerified  Boolean       @default(false) @map("is_verified")
  createdBy   User?         @relation("CreatedCourts", fields: [createdById], references: [id])
  createdById String?       @map("created_by_id")
  checkIns    CheckIn[]
  posts       BulletinPost[]
  sessions    PlaySession[]
  
  createdAt   DateTime      @default(now()) @map("created_at")

  // PostGIS location (GEOGRAPHY(Point, 4326)) 通过原生SQL迁移添加
  @@map("courts")
}

// ==================== 签到系统 ====================
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

// ==================== 留言板 ====================
model BulletinPost {
  id        String   @id @default(uuid())
  content   String
  images    String[] @default([]) // 球场状况照片
  user      User     @relation(fields: [userId], references: [id])
  userId    String   @map("user_id")
  court     Court    @relation(fields: [courtId], references: [id])
  courtId   String   @map("court_id")
  likes     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("bulletin_posts")
}

// ==================== 约战拼场 ====================
model PlaySession {
  id          String            @id @default(uuid())
  title       String
  description String?
  status      SessionStatus     @default(PENDING) // PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
  
  court       Court             @relation(fields: [courtId], references: [id])
  courtId     String            @map("court_id")
  host        User              @relation("HostSessions", fields: [hostId], references: [id])
  hostId      String            @map("host_id")
  
  // 加入的玩家（非邀请）
  players     User[]            @relation("SessionMembers")
  
  maxPlayers  Int               @default(4)   @map("max_players")
  skillMin    Float?            @map("skill_min")
  skillMax    Float?            @map("skill_max")
  isPublic    Boolean           @default(true) @map("is_public") // 公开报名或仅邀请
  
  playTime    DateTime          @map("play_time")
  createdAt   DateTime          @default(now()) @map("created_at")
  
  invites     SessionInvite[]
  chatRoom    ChatRoom?         @relation("SessionChat")

  @@map("play_sessions")
}

enum SessionStatus {
  PENDING      // 待确认
  CONFIRMED    // 已确认
  IN_PROGRESS  // 进行中
  COMPLETED    // 已完成
  CANCELLED    // 已取消
}

// ==================== 邀请系统 ====================
model SessionInvite {
  id        String      @id @default(uuid())
  session   PlaySession @relation(fields: [sessionId], references: [id])
  sessionId String      @map("session_id")
  
  sender    User        @relation("SentInvites", fields: [senderId], references: [id])
  senderId  String      @map("sender_id")
  
  recipient User        @relation("ReceivedInvites", fields: [recipientId], references: [id])
  recipientId String    @map("recipient_id")
  
  status    InviteStatus @default(PENDING) // PENDING, ACCEPTED, DECLINED, EXPIRED
  
  sentAt    DateTime    @default(now())   @map("sent_at")
  respondedAt DateTime? @map("responded_at")

  @@map("session_invites")
}

enum InviteStatus {
  PENDING    // 待处理
  ACCEPTED   // 已接受
  DECLINED   // 已拒绝
  EXPIRED    // 已过期
}

// ==================== 聊天系统 ====================
model ChatRoom {
  id        String         @id @default(uuid())
  
  sessionId String?        @map("session_id")
  session   PlaySession?   @relation("SessionChat", fields: [sessionId], references: [id])
  
  courtId   String?        @map("court_id")
  court     Court?         @relation(fields: [courtId], references: [id])
  
  name      String?        // 群聊显示名称
  
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
  
  roomId    String?  @map("room_id")
  room      ChatRoom? @relation(fields: [roomId], references: [id])
  
  dmId      String?  @map("dm_id")
  dm        DmConversation? @relation(fields: [dmId], references: [id])
  
  // 线程回复
  parentId  String?  @map("parent_id")
  parent    ChatMessage? @relation("MessageReplies", fields: [parentId], references: [id])
  replies   ChatMessage[]                  @relation("MessageReplies")
  
  pollOptions String? @map("poll_options") // JSON数组格式投票选项
  
  isDeleted Boolean  @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at")
  
  createdAt DateTime @default(now()) @map("created_at")

  @@map("chat_messages")
}

enum MessageType {
  TEXT   // 文本消息
  IMAGE  // 图片消息
  POLL   // 投票消息
  SYSTEM // 系统通知
}
```

**核心模型说明：**
1. **User**: 玩家实体，支持微信 OpenID/UnionID、手机号、邮箱登录，含技能等级和验证状态。
2. **Court**: 球场实体，地理坐标通过 PostGIS GEOGRAPHY 类型存储，含评分和评价计数。
3. **CheckIn**: 签到记录，支持开始/结束时间追踪。
4. **BulletinPost**: 留言板帖子，支持图片和点赞。
5. **PlaySession**: 约战场次，含状态机（待确认→进行中→已完成/取消）。
6. **SessionInvite**: 邀请系统，跟踪发送者、接收者和接受/拒绝状态。
7. **ChatRoom**: 群聊房间，关联场次或球场。
8. **DmConversation**: 私信对话，双向参与者关系。
9. **ChatMessage**: 消息实体，支持文本、图片、投票、线程回复。

### 2.2 核心地理空间查询原理
当用户打开首页地图时，前端会获取当前手机的 GPS 坐标（如经度 $116.40$、纬度 $39.90$）。NestJS 后端通过 Prisma 的 `$queryRaw` 执行原生 PostGIS SQL：

```sql
-- 查询半径 5公里（5000米）范围内的球场，并按实际距离升序排列
SELECT id, name, address, is_indoor, has_lights, num_courts,
       ST_Distance(location, ST_MakePoint(116.40, 39.90)::geography) AS distance_meters
FROM courts
WHERE ST_DWithin(location, ST_MakePoint(116.40, 39.90)::geography, 5000)
ORDER BY distance_meters ASC;
```

---

## 3. API 接口设计 (API Endpoints Design)

### 3.1 用户管理
*   **注册/登录:** `POST /auth/register`, `POST /auth/login`（手机OTP + Apple Sign-In）
*   **个人资料:** `GET/PUT /users/me` — 查看和更新资料、技能等级、头像、简介
*   **搜索用户:** `GET /users/search?q=keyword&skillMin=X&skillMax=Y`

### 3.2 球场发现（地图驱动）
*   **附近球场:** `GET /courts/nearby?lat=&lng=&radius=` — 使用 PostGIS 查询返回半径内按距离排序的球场：
    ```sql
    SELECT id, name, address, is_indoor, has_lights, net_type, num_courts, avg_rating, review_count,
           ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance
    FROM courts
    WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
    ORDER BY distance ASC;
    ```
*   **球场详情:** `GET /courts/:id` — 完整球场信息、评价、即将开始的场次、留言板帖子
*   **创建球场:** `POST /courts` — 提交新球场及地图坐标

### 3.3 约战邀请系统
*   **创建场次:** `POST /sessions` — 主持人创建约战场次（时间、人数上限、技能范围、公开/仅邀请）
*   **加入场次:** `POST /sessions/:id/join` — 玩家加入公开场次（事务锁检查容量）
*   **发送邀请:** `POST /sessions/:id/invite` — 主持人向特定用户发送邀请：
    1. 验证主持人在场次中的权限
    2. 创建 `SessionInvite` 记录，状态为 `PENDING`
    3. 通过 WebSocket 向接收者发送实时通知事件
*   **回复邀请:** `POST /invites/:id/respond` — 接受/拒绝邀请：
    * 接受时：将接收者加入场次玩家列表，更新邀请状态
    * 拒绝时：更新邀请状态，通过 WebSocket 通知主持人
*   **我的场次:** `GET /users/me/sessions?tab=hosting|joined|invited`

### 3.4 实时聊天（WebSocket）
*   **场次/球场群聊:** 每个场次或球场的 WebSocket 房间用于实时消息传递
    * 事件: `chat:message`, `chat:typing`, `chat:userJoined`, `chat:userLeft`
*   **私信:** 两个用户之间的 WebSocket 私信
    * 事件: `dm:message`, `dm:typing`
*   **聊天功能支持:**
    * 支持 Markdown 的文本消息
    * 图片附件（云存储）
    * 消息线程回复
    * 群内投票创建与参与
    * 消息已读回执

### 3.5 签到与留言板
*   **签到:** `POST /courts/:id/checkin` — 在球场开始签到
*   **结束签到:** `PUT /checkins/:id/end` — 结束签到时段
*   **留言板帖子:** `GET/POST /courts/:id/bulletin` — 发布球场状况、照片和评论

---

## 4. 详细研发路线图与时间表 (Roadmap & Timeline)

项目整体研发计划分为 **7 个主要阶段**，优先完成核心用户管理和球场发现功能，然后依次添加约战邀请、实时聊天，最后进行原生平台发布。

```
              第 1 周           第 2-3 周          第 4-5 周          第 6-7 周           第 8-9 周         第 10-11 周      后续阶段
         ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
         │  Phase 1:    │   │  Phase 2:    │   │  Phase 3:    │   │  Phase 4:    │   │  Phase 5:    │   │  Phase 6:    │   │  Phase 7:    │
         │ 基础框架搭建 │──>│ 用户管理系统 │──>│ 地图球场发现 │──>│ 约战邀请系统 │──>│ 实时聊天平台 │──>│ 原生平台发布 │──>│ 微信小程序端 │
         │  (已完成 ✅)  │   │  (14天)      │   │  (14天)      │   │  (14天)      │   │  (14天)      │   │  (14天)      │   │  (14天)      │
         └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

---

### Phase 1: 基础架构与多端编译验证 (第 1 周) — [已完成 ✅]
*   **研发目标:** 搭建标准的 Monorepo 代码仓库，解决 Vue 3 + TypeScript 的多端编译配置。
*   **具体步骤与细节:**
    *   **步骤 1.1:** 配置 NestJS 服务端环境，设置基础路由模块，引入 Prisma ORM 并成功绑定本地数据库。
    *   **步骤 1.2:** 使用 Vite 构建工具初始化 Vue 3 uni-app，配置 Pinia 状态管理库和 Sass 编译环境。
    *   **步骤 1.3:** 编写基础双页面模板（球场发现地图主页、个人中心页），并解决微信小程序 TabBar 的原生资源依赖（透明占位图生成）。
    *   **步骤 1.4:** 运行编译检查：
        *   运行 `npm run build`（后端成功编译出 JS 产物）。
        *   运行 `npm run build:h5`（前端成功构建出 Web H5 静态资源）。
        *   运行 `npm run build:mp-weixin`（前端成功构建出合规的微信小程序包）。
*   **里程碑产物:** 完美的 Monorepo 脚手架代码、零警告的多端编译工具流。

---

### Phase 2: 用户管理系统 (第 2 - 3 周) — [下一步]
*   **研发目标:** 实现完整的用户认证体系（手机OTP / Apple Sign-In / 微信UnionID）、个人资料管理和技能等级系统。
*   **详细分解步骤:**
    *   **步骤 2.1: PostGIS 激活与数据库空间字段迁移 (时间: 2 天)**
        *   编写并运行数据库迁移 SQL 脚本，激活扩展：`CREATE EXTENSION IF NOT EXISTS postgis;`。
        *   在 `courts` 物理表中增加几何列：`SELECT AddGeometryColumn('courts', 'location', 4326, 'POINT', 2);`。
        *   在 location 字段上添加高效率的空间索引：`CREATE INDEX courts_location_gix ON courts USING GIST (location);`。
    *   **步骤 2.2: iOS 手机号 OTP 短信登录 (时间: 4 天)**
        *   针对 iOS 端首发开发手机号 + 短信验证码登录，集成阿里云/腾讯云 SMS 服务。
        *   后端建立短信速率限制 (Rate Limiting)，设计滑窗限流，防止短信接口被恶意刷取。
    *   **步骤 2.3: Apple Sign-In 原生登录对接 (时间: 4 天)**
        *   在 NestJS 端开发 Apple OAuth 2.0 验证逻辑，接收并验证 iOS 客户端回传的 Identity Token (JWT)。
        *   实现用户资料静默创建与多渠道关联：支持用户用手机号或 Apple Sign-In 登录，并实现两者的绑定与账户合并。
    *   **步骤 2.4: 地理围栏高并发检索 API 开发 (时间: 4 天)**
        *   开发 `/courts/nearby` 检索接口，实现带有安全参数校验的 `ST_DWithin` 地理计算。
        *   支持按照球场标签（Indoor-室内、hasLights-灯光、netType-球网类型）进行多重布尔过滤组合。
        *   设计高性能球场排序逻辑：就近距离 + 用户评分权重。使用 Redis 缓存热点检索，减轻高并发下数据库负担。
*   **里程碑产物:** 完美跑通的 iOS 手机/Apple 登录、亚毫秒级响应的球场发现核心 API、完整的 Swagger API 文档。

---

### Phase 3: iOS 原生交互式地图界面与自助入驻系统 (第 4 - 5 周)
*   **研发目标:** 针对 iOS 原生地图内核（Apple Maps / 高德）进行深度适配，实现流畅的标点渲染和高颜值的底部滑出抽屉面板。
*   **详细分解步骤:**
    *   **步骤 3.1: iOS 原生地图深度适配 (时间: 4 天)**
        *   使用 uni-app 原生 `<map>` 组件，配置并调用 iOS 系统内置地图（Apple Maps，国内环境下自动适配为高德/天地图数据源）。
        *   获取 iOS 原生定位权限，实现经纬度转换，高精度纠偏，并在地图上渲染自定义 Lime Green 匹克球标点。
    *   **步骤 3.2: 首页底部滑出抽屉 (Active Court Sheet) 开发 (时间: 3 天)**
        *   设计完全贴合 iOS 系统触感与视觉逻辑的半屏滑出抽屉（Sheet View）。
        *   轻触地图标点，抽屉优雅弹出，展示球场距离、当前打卡人数热度，并一键调起 iOS 系统高德、百度或苹果内置地图进行导航。
    *   **步骤 3.3: 匹克球场入驻登记系统 (时间: 4 天)**
        *   开发入驻申请页面 `pages/court-register/register`。
        *   支持在原生地图上拖拽选点（Map Pin Dragging）并精确定位经纬度。
        *   对接云存储服务（OSS/COS），实现图片直传，提供 iOS 相册与相机的高清多图上传组件。
    *   **步骤 3.4: 审核机制与球场状态过滤 (时间: 3 天)**
        *   后台管理面板支持管理员一键审核通过。未过审的球场仅对创建者本人可见，过审后对全平台公开。
*   **里程碑产物:** iOS 深度适配的原生地图页面、完全符合 iOS 设计规范的抽屉交互、流畅的球场入驻表单。

---

### Phase 4: 约战邀请系统 (第 6 - 7 周)
*   **研发目标:** 实现场次创建/加入、邀请系统和实时通知。
*   **详细分解步骤:**
    *   **步骤 4.1: 场次 CRUD API (时间: 3 天)**
        *   创建、更新、取消、完成约战场次，含权限校验（仅主持人可编辑）。
    *   **步骤 4.2: 加入/退出场次逻辑 (时间: 3 天)**
        *   事务锁检查容量防止超卖，技能等级匹配验证。
        *   支持玩家主动退场，主持人管理踢人功能。
    *   **步骤 4.3: 邀请系统 (时间: 5 天)**
        *   主持人向特定用户发送邀请 → 接收者接受/拒绝 → 自动加入玩家列表。
        *   邀请过期机制（如24小时未响应自动标记 EXPIRED）。
    *   **步骤 4.4: WebSocket 邀请通知 (时间: 3 天)**
        *   事件: `invite:sent`, `invite:accepted`, `invite:expired`。
        *   iOS APNs / Android FCM 推送提醒新邀请。
    *   **步骤 4.5: "我的场次"页面 (时间: 2 天)**
        *   Tab 切换：正在主持 / 已加入 / 收到邀请，含状态标签。
    *   **步骤 4.6: 技能匹配推荐 (时间: 3 天)**
        *   创建场次时根据技能范围推荐相似水平的玩家。
*   **里程碑产物:** 完整的约战拼场引擎、邀请系统、WebSocket 实时通知。

---

### Phase 5: 实时聊天平台 (第 8 - 9 周)
*   **研发目标:** 实现群聊（场次/球场）、私信、投票和线程回复。
*   **详细分解步骤:**
    *   **步骤 5.1: NestJS WebSocket Gateway 搭建 (时间: 3 天)**
        *   基于 Socket.IO 或原生 WebSocket，房间制消息架构。
        *   认证中间件：验证 JWT token 后加入对应房间。
    *   **步骤 5.2: 场次群聊 (时间: 4 天)**
        *   创建场次时自动创建关联 ChatRoom，参与者自动加入。
        *   事件: `chat:message`, `chat:typing`, `chat:userJoined`, `chat:userLeft`。
    *   **步骤 5.3: 球场群聊 (时间: 3 天)**
        *   每个球场持久化聊天室，供社区持续讨论。
        *   支持历史消息加载和分页。
    *   **步骤 5.4: 私信系统 (时间: 4 天)**
        *   两个用户间的 DmConversation，含对话列表和未读徽章。
        *   事件: `dm:message`, `dm:typing`。
    *   **步骤 5.5: 消息类型支持 (时间: 5 天)**
        *   文本（Markdown）、图片（云存储上传）、投票（创建+投票）、线程回复。
        *   消息已读回执、在线状态检测。
*   **里程碑产物:** 实时聊天平台（群聊/私信/投票/线程）、WebSocket 推送闭环。

---

### Phase 6: 原生平台发布 (第 10 - 11 周)
*   **研发目标:** iOS TestFlight / App Store 提审，Android APK/AAB 打包发布。
*   **详细分解步骤:**
    *   **步骤 6.1: iOS 真机性能调优 (时间: 4 天)**
        *   地图渲染优化、WebSocket 重连机制、数据库查询性能分析。
        *   Sentry 崩溃报告 + Mixpanel/Amplitude 数据分析集成。
    *   **步骤 6.2: iOS TestFlight / App Store (时间: 5 天)**
        *   Xcode 真机联调，生成 Distribution Profile，上传至 App Store Connect。
        *   TestFlight 内测分发，收集首批用户反馈。
    *   **步骤 6.3: Android 原生适配 (时间: 5 天)**
        *   Google Maps SDK 集成、FCM 推送通道配置。
        *   兼容小米/华为/OPPO/vivo 等国内厂商推送。
    *   **步骤 6.4: 双端发布包准备 (时间: 3 天)**
        *   IPA（App Store）、APK/AAB（Google Play + 安卓市场）。
*   **里程碑产物:** TestFlight 内测包、iOS 提审版 IPA、Android 优化发布包。

---

### Phase 7: 微信小程序适配与公测发布 (后续迭代)
*   **研发目标:** 将已有的高品质原生 App 体验，平滑向下兼容适配至微信小程序端，拓展流量入口。
*   **详细分解步骤:**
    *   **步骤 7.1: 微信静默登录与 UnionID 映射 (时间: 3 天)**
        *   开发 NestJS 端 `/auth/wechat-mp`，接收小程序 `wx.login` 获取的 `code`。
        *   换取微信 `openid` 与统一 `unionid`。若 UnionID 匹配到已注册的 App 手机账户，则自动实现免密登录和数据平滑互通。
    *   **步骤 7.2: 微信内置腾讯地图与定位组件替换 (时间: 3 天)**
        *   前端条件编译：在微信小程序环境下，将原生 iOS 地图切换为腾讯地图内核，使用 `uni.createMapContext` 进行交互控制。
    *   **步骤 7.3: 小程序物理体积调优与分包 (时间: 4 天)**
        *   微信要求小程序单个分包不超过 2MB。在 `manifest.json` 中配置分包机制 (Subpackages)，将球场创建、约战拼局等非首页模块划归到分包，确保首页加载首包体积 $\le$ 1MB，确保加载速度。
        *   开启代码压缩与图片静态资源的 CDN 托管。
    *   **步骤 7.4: 微信订阅消息接入与上架提审 (时间: 4 天)**
        *   使用 `wx.requestSubscribeMessage` 调起微信原生提醒授权，替换 App 端的 APNs 推送，完成微信小程序的发布公测。
*   **里程碑产物:** 完美打通数据、完全合规分包、体验丝滑的微信小程序线上正式版。

---

## 5. 研发团队配置建议 (Recommended Team)

为确保该 **11周+** 开发路线图的顺利实施，推荐团队配置如下：
1.  **全栈开发工程师 (1名):** 负责 NestJS 接口编写、Prisma ORM 调试、PostgreSQL/PostGIS 空间 SQL 维护以及 WebSocket Gateway 搭建。
2.  **跨端前端工程师 (1名):** 负责 uni-app (Vue 3 + TS) 开发，深度负责高德/微信原生地图调优、TabBar 动效、打包分包及聊天 UI 实现。
3.  **UI/UX 兼产品测试 (1名):** 负责 Lime Green 活力主题的设计产出，管理各阶段交付产物的 E2E 功能测试与用户体验打磨。
