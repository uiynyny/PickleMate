# PickleMate 开发者本地搭建与开发指南 (DEV_GUIDE)

本指南旨在帮助研发团队成员快速在本地搭建 **PickleMate** 的前后端开发环境。

---

## 1. 准备工作 (Prerequisites)

开始之前，请确保您的本地计算机已安装以下基础设施：

*   **Node.js:** `v18.x` 或 `v20.x` (建议使用 LTS 版本)。
*   **npm:** `v9.x` 或以上 (随 Node.js 一起安装)。
*   **PostgreSQL:** `v14.x` 或更高版本，并且必须安装 **PostGIS** 空间扩展插件。
    *   *macOS 用户推荐使用:* `brew install postgis`（自动附带 PostgreSQL 与 PostGIS）。
    *   *Windows 用户推荐使用:* [EnterpriseDB 官方安装包](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) 并在 StackBuilder 中勾选 Spatial Extensions (PostGIS)。
*   **Xcode & iOS SDK:** iOS 本地调试与模拟器运行必选（通过 Mac App Store 或苹果开发者官网下载，附带 Command Line Tools、iOS Simulator、APNs 推送调试等支持）。
*   **HBuilderX / VS Code (含 iOS App 编译链):** 原生 App 编译与基座调试首选 IDE [官方下载地址](https://www.dcloud.io/hbuilderx.html)。
*   **微信开发者工具 (后续阶段):** [官方下载地址](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（用于后续微信小程序适配调试）。

---

## 2. 后端开发环境搭建 (Backend Setup)

后端基于 **NestJS** 框架与 **Prisma ORM** 开发，连接 PostgreSQL 数据库。

### 步骤 2.1: 安装依赖
打开终端，进入 `/backend` 目录，执行依赖安装：
```bash
cd backend
npm install
```

### 步骤 2.2: 环境变量配置
在 `backend/` 目录下创建一个名为 `.env` 的文件，复制并根据本地数据库凭证修改以下内容：
```ini
PORT=3000

# 格式: postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=public
# 示例：
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/picklemate?schema=public"

# JWT 无状态令牌加密秘钥
JWT_SECRET="picklemate_development_secret_key_99"

# 微信小程序凭证（本地开发若没有，可先保持默认，部分微信接口将使用 Mock 返回）
WECHAT_APPID="wx_mock_appid_12345"
WECHAT_SECRET="mock_secret_abcde"
```

### 步骤 2.3: 空间数据库迁移与 Prisma 初始化
1.  **启动本地 PostgreSQL**，并创建一个名为 `picklemate` 的空白数据库。
2.  确保 PostGIS 扩展可用。
3.  在 `backend` 目录下，运行 Prisma 迁移指令，这会自动在 PostgreSQL 中激活 PostGIS、创建所有的物理表并生成类型安全的 Prisma 绑定代码：
    ```bash
    # 运行数据库迁移
    npx prisma migrate dev --name init
    
    # 手动触发客户端类型生成（通常迁移完会自动执行）
    npx prisma generate
    ```

### 步骤 2.4: 启动后端服务
```bash
# 开发环境启动（支持热重载，代码修改后自动重构）
npm run start:dev

# 生产环境编译编译
npm run build

# 生产环境启动
npm run start:prod
```
启动成功后，服务端将在本地 `http://localhost:3000` 侦听请求。
*   **健康检查接口:** 浏览器访问 `http://localhost:3000/health`，若返回 `{"status":"ok","timestamp":"..."}` 说明后端运行完好。

---

## 3. 前端开发环境搭建 (Frontend Setup)

前端基于 **uni-app + Vue 3 (Composition API) + TypeScript** 架构开发。

### 步骤 3.1: 安装依赖
打开终端，进入 `/frontend` 目录，执行依赖安装：
```bash
cd frontend
npm install
```

### 步骤 3.2: 绑定微信 AppID
若需在**微信开发者工具**中调试：
1.  打开 `frontend/src/manifest.json`。
2.  找到 `"mp-weixin"` 节点，修改 `"appid"` 为您自己在微信公众平台申请的小程序 AppID（如果没有，可先填写 `"touristappid"` 开启游客模式）：
    ```json
    "mp-weixin": {
      "appid": "您的微信小程序APPID",
      "setting": {
        "urlCheck": false
      }
    }
    ```

### 步骤 3.3: 启动本地开发编译
uni-app 采用命令行编译器。根据您需要调试的目标平台，运行对应的命令：

#### A. 在浏览器中调试 (H5 网页版)
```bash
npm run dev:h5
```
*   控制台会输出本地 Web 地址（如 `http://localhost:5173`），在 Chrome 浏览器中打开即可通过控制台（F12）进行响应式调试。

#### B. 在微信开发者工具中调试 (微信小程序版)
```bash
npm run dev:mp-weixin
```
1.  运行该命令后，编译器会在物理磁盘上创建 `/frontend/dist/dev/mp-weixin` 目录。
2.  启动 **微信开发者工具**，点击 **导入项目**。
3.  项目目录选择上述编译出的 `/frontend/dist/dev/mp-weixin` 文件夹。
4.  AppID 选择您在步骤 3.2 中配置的 ID。
5.  点击导入后，即可在微信模拟器中进行实时热更新开发。

#### C. 真机/模拟器调试 (iOS & Android App 版)
在命令行中输入：
```bash
# 本地编译出 App Plus 核心包
npm run dev:app
```
编译产物位于 `frontend/dist/dev/app-plus`。推荐使用 **HBuilderX** 直接点击 “运行到 Android 模拟器” 或 “运行到 iOS 基座”，IDE 会自动完成底层打包加载。

---

## 4. 前后端联调规范与最佳实践

为了保障代码质量与协同效率，请所有团队成员遵守以下开发约束：

### 4.1 接口请求封装
*   前端所有 HTTP 请求必须通过统一封装的 `src/services/` 层进行分发。
*   基准 API 地址配置在统一入口中（开发环境指向 `http://localhost:3000`，生产环境指向 HTTPS 域名）。

### 4.2 坐标系标准说明 (重要 ⚠️)
*   中国境内球场选点和地图测距必须统一使用 **GCJ-02 国测局坐标系**（俗称火星坐标系），否则在微信小程序内置地图上标点会产生数百米的物理偏移。
*   `uni.getLocation` 必须指定坐标系类型：
    ```typescript
    uni.getLocation({
      type: 'gcj02', // 严禁使用默认的 wgs84
      success: (res) => { ... }
    });
    ```

### 4.3 WebSocket 实时通信开发 (新增 ⚡)
*   **后端:** NestJS 使用 `@nestjs/websockets` + `@socket.io/adapter-redis`（生产环境）实现 WebSocket Gateway。
    *   入口文件: `backend/src/chat/chat.gateway.ts`
    *   认证中间件通过 JWT guard 验证用户身份后加入对应房间（场次群聊 / 球场群聊 / 私信）。
*   **前端:** uni-app 端使用 `uni.connectSocket` 建立 WebSocket 连接，Pinia store 管理消息队列和房间订阅状态。
    *   事件命名规范: `chat:message`, `dm:message`, `invite:sent`, `session:update`
    *   断线重连策略: 指数退避重试（1s → 2s → 4s → max 30s），最多 5 次。

### 4.4 Git 提交流程
*   严禁将含有物理数据库密码、微信 Secret 密钥的本地 `.env` 文件提交至代码仓库。
*   提交代码前请确保在本地运行一次编译流程（`npm run build`），确保无 TypeScript 静态类型报错后再进行 Stage 和 Push。

---

## 5. API 接口文档与测试 (API Documentation)

### 5.1 Swagger 文档生成
后端启动后，访问 `http://localhost:3000/api` 可查看自动生成的 Swagger API 文档，包含所有接口的请求参数、响应格式和示例。

### 5.2 核心端点速查表

| 模块 | 方法 | 端点 | 说明 |
|------|------|------|------|
| **用户** | POST | `/auth/register` | 手机OTP注册 |
| **用户** | POST | `/auth/login` | 手机OTP登录 |
| **用户** | GET/PUT | `/users/me` | 个人资料查询/更新 |
| **球场** | GET | `/courts/nearby?lat=&lng=&radius=` | PostGIS附近球场搜索 |
| **球场** | GET | `/courts/:id` | 球场详情（含评价） |
| **场次** | POST | `/sessions` | 创建约战场次 |
| **场次** | POST | `/sessions/:id/join` | 加入公开场次 |
| **邀请** | POST | `/sessions/:id/invite` | 发送邀请 |
| **邀请** | POST | `/invites/:id/respond` | 接受/拒绝邀请 |
| **聊天** | WS | `wss://...` | WebSocket 实时通信 |

### 5.3 Postman / Insomnia 集合
项目根目录提供 `PickleMate_API.postman_collection.json`，可直接导入进行接口测试。包含所有认证流程（OTP登录获取JWT token）和预置环境变量。

---

## 6. 新增环境变量 (Environment Variables)

在 `.env` 文件中可能需要添加以下变量以支持新功能：

```ini
# ==================== 新增: 聊天与推送 ====================
# Redis 连接（WebSocket房间持久化 + 会话存储）
REDIS_URL="redis://localhost:6379"

# 云存储服务（图片/文件上传 - 阿里云OSS / AWS S3 / 腾讯云COS）
CLOUD_STORAGE_PROVIDER="aliyun"        # aliyun | aws | tencent
CLOUD_STORAGE_BUCKET="picklemate-assets"
CLOUD_STORAGE_REGION="oss-cn-shanghai"
CLOUD_STORAGE_ACCESS_KEY="your_key"
CLOUD_STORAGE_SECRET_KEY="your_secret"

# 推送通知（iOS APNs / Android FCM）
APNS_CERT_PATH="./certs/apns.p12"      # Apple Push Notification 证书路径
FCM_SERVER_KEY="your_fcm_server_key"   # Firebase Cloud Messaging Server Key

# 短信服务（阿里云/腾讯云 SMS）
SMS_PROVIDER="aliyun"                   # aliyun | tencent
SMS_APP_ID="your_sms_app_id"
SMS_SIGN_NAME="PickleMate"

# JWT 刷新令牌过期时间（毫秒，默认7天）
JWT_REFRESH_EXPIRATION="604800000"

# 邀请链接过期时间（小时）
INVITE_EXPIRE_HOURS=24
```
