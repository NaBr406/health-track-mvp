# 生命卫士 MVP

`生命卫士` 是一个面向健康管理场景的 monorepo，当前主交付为 Android 移动端和 Spring Boot 后端。项目把日常记录入口尽量收敛到聊天式界面：饮食、运动、睡眠、血糖等信息优先通过 `AI Chat` 录入，再由后端归档、刷新仪表盘，并生成每日建议。

## 当前状态

- 主交付为 `mobile/` Android App 和 `server/` API 服务，`web/` 为历史原型目录，当前不维护
- 支持登录、注册和游客模式；游客态与登录态使用独立的数据作用域
- Dashboard 会展示今日 AI 建议、热量/运动概览、真实步数、血糖趋势和 8 小时预测
- `AI Chat` 是统一记录入口，文本发送可用；语音按钮已预留，但当前仍走文本提交通道
- 后端会把聊天内容解析为饮食、运动、护理、睡眠和血糖记录，并刷新当天建议
- 当前已经接通的步数链路是 Android 设备步数传感器；Health Connect 相关依赖已预埋，但还不是当前 UI 的主同步入口
- Dify 当前主要用于两类能力：每日 AI 建议、聊天记录结构化抽取；未配置时会自动回退到本地 mock/规则逻辑

## 仓库结构

```text
.
|-- mobile/                Expo + React Native Android 客户端
|-- server/                Spring Boot 后端
|-- docs/                  Dify 接入和设计文档
|-- scripts/               常用启动脚本
|-- web/                   历史 Web 原型
|-- docker-compose.yml     MySQL / Redis / Server 联调
`-- README.md
```

## 移动端目录约定

移动端代码现在按 feature 收敛，页面文件尽量只负责“状态编排 + 页面组合”，把展示组件、模型推导和交互 hook 拆回各自目录。

```text
mobile/src/
|-- components/            跨 feature 复用组件
|-- features/
|   |-- auth/
|   |-- chat/
|   |   |-- api/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- model/
|   |   `-- screens/
|   |-- dashboard/
|   |   |-- api/
|   |   |-- components/
|   |   |-- model/
|   |   `-- screens/
|   |-- onboarding/
|   |   |-- components/
|   |   |-- model/
|   |   `-- screens/
|   |-- profile/
|   |   |-- api/
|   |   |-- components/
|   |   |-- model/
|   |   `-- screens/
|   `-- steps/
|       `-- api/
|-- lib/                   设备能力、本地存储、mock 与通用工具
|-- navigation/            导航与沉浸式 tab bar 行为
|-- screens/               仍保留的跨 feature 入口页（如登录）
|-- shared/api/            通用 API client / identity 能力
|-- theme/                 Design tokens
`-- types.ts               全局业务类型
```

当前几个主要 feature 的推荐职责边界：

- `api/`: 只放接口调用和协议适配
- `components/`: 只放展示组件，不直接持有页面级副作用
- `hooks/`: 放页面行为、键盘联动、提交流程等交互状态
- `model/`: 放纯函数、派生数据、UI metadata 组装
- `screens/`: 保留路由入口和顶层编排

## 技术栈

### Mobile

- Expo `~55.0.13`
- React `19.2.0`
- React Native `0.83.4`
- TypeScript
- React Navigation
- AsyncStorage
- `expo-build-properties`
- `expo-health-connect`
- `expo-image-picker`
- `react-native-health-connect`
- `react-native-svg`

### Server

- Spring Boot `3.3.5`
- Java `17`
- Spring Security + JWT
- Spring Data JPA
- MySQL 8 / H2
- Redis
- springdoc-openapi
- Dify Workflow API

## 已实现能力

### 移动端

- `Onboarding Wizard`
  - 三步式健康档案引导
  - 支持昵称、头像、健康状态、目标、基线指标、用药与护理重点编辑
- `Dashboard`
  - 今日 AI 建议卡片
  - 热量、运动、步数概览
  - 血糖历史趋势与 8 小时预测
  - 建议详情与反馈
  - 设备步数的本地实时更新与已登录账号的延迟同步
- `AI Chat`
  - 统一自然语言记录入口
  - 发送后会触发后端归档和建议刷新
  - 游客态也可使用，登录后切换到账号数据空间
- `Profile`
  - 基础健康档案查看与编辑
  - 资料详情页、设置页、退出登录
  - 数据与步数同步状态查看
- `Device Step Sync`
  - 当前基于 Android `Step Counter` 传感器
  - 首次授权后支持步数读取、手动同步和 Dashboard 实时刷新
  - 后台通过 WorkManager 按 15 分钟间隔采样，登录后可同步到服务端
- `Fallback`
  - 后端不可用时自动回退本地 mock 数据
  - 游客态记录和登录态记录彼此隔离

### 后端接口

- `/api/auth/*` 登录与注册
- `/api/profile` 健康档案读取与更新
- `/api/dashboard/summary` / `/api/dashboard/snapshot` 仪表盘数据
- `/api/dashboard/adjustment-feedback` 建议反馈
- `/api/interaction/thread` / `/api/interaction/messages` 聊天线程与消息提交
- `/api/advice/daily` 每日建议
- `/api/records/diet`
- `/api/records/exercise`
- `/api/records/steps`
- `/api/records/steps/sync`
- `/api/records/care`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## 步数同步说明

当前项目里与步数相关的能力分成两层：

1. 已上线链路
   - Android 设备步数传感器
   - 首次开启后申请 `ACTIVITY_RECOGNITION` 权限
   - Dashboard 会订阅实时步数更新
   - 登录态会把步数写入后端 `step_records`
   - 游客态只保留本地显示，不写入服务器
2. 预埋但未作为主入口的能力
   - Health Connect 依赖与权限
   - 当前尚未在设置页开放完整的 Health Connect 配置流程

如果设备或模拟器没有 `stepcounter` / `stepdetector` 传感器，应用仍可运行，但步数同步会显示为不可用。

## 快速开始

### 推荐方式：Windows + Android 本地开发

建议先准备好：

- Node.js 与 npm
- Java 17
- Android SDK
- Android 8.0+ 模拟器或真机
- 一个名为 `HealthTrack_Pixel_35` 的 Android Emulator
- PowerShell

> `scripts/dev-mobile.ps1` 当前会直接尝试启动名为 `HealthTrack_Pixel_35` 的模拟器；如果你本地 AVD 名称不同，需要先改脚本里的 `$avdName`。

#### 1. 准备后端环境变量

```powershell
Copy-Item .env.example .env
```

把根目录 `.env` 里的 `SPRING_PROFILES_ACTIVE` 改成下面其一：

- `local`
  - 推荐本地快速体验
  - 使用 H2 文件数据库
  - 不依赖 MySQL / Redis
- `dev`
  - 使用 MySQL + Redis
  - 需要先执行 `docker compose up -d mysql redis`

#### 2. 准备移动端环境变量

仓库当前没有提交 `mobile/.env.example`，请直接创建 `mobile/.env`：

```powershell
Set-Content mobile\.env "EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080"
```

常见地址如下：

- Android 模拟器：`http://10.0.2.2:8080`
- Android 真机：`http://<你的局域网 IP>:8080`

> 如果不显式设置 `EXPO_PUBLIC_API_BASE_URL`，开发环境会回退到代码里写死的远端地址 `http://150.158.117.174`，本地联调时不建议依赖这个默认值。

#### 3. 一键启动

```powershell
.\scripts\dev-all.ps1
```

这个脚本会打开两个独立窗口：

- `scripts/dev-server.ps1`
  - 读取根目录 `.env`
  - 如果未设置 `SPRING_PROFILES_ACTIVE`，默认使用 `local`
  - 自动准备 Maven 运行环境
- `scripts/dev-mobile.ps1`
  - 自动检测 Android SDK / Java
  - 启动模拟器
  - 安装 Android debug app
  - 启动 Metro dev client（端口 `8081`）

## 手动启动

### 1. 启动后端

#### 轻量本地模式：`local`

```powershell
Copy-Item .env.example .env
cd server
$env:SPRING_PROFILES_ACTIVE = "local"
.\mvnw.cmd spring-boot:run
```

启动后可访问：

- Server: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- H2 Console: `http://localhost:8080/h2-console`

#### MySQL + Redis 联调模式：`dev`

```powershell
Copy-Item .env.example .env
docker compose up -d mysql redis
cd server
$env:SPRING_PROFILES_ACTIVE = "dev"
.\mvnw.cmd spring-boot:run
```

### 2. 启动移动端

```powershell
Set-Content mobile\.env "EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080"
cd mobile
npm install
npm run android
```

如果你已经完成过原生工程构建，也可以直接启动 dev client：

```powershell
cd mobile
npm run start:dev-client
```

首次在设备中使用步数同步时，还需要：

- 在 App 内开启“设备计步”
- 授予 `ACTIVITY_RECOGNITION` 权限
- 等待一段采样时间，设备步数基线才会逐渐稳定

## Docker Compose

`docker-compose.yml` 当前会启动：

- MySQL
- Redis
- Server

使用方式：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

默认服务地址：

- Server: `http://localhost:8080`

## Demo 账号

在数据库为空且 `app.seed.enabled=true` 时，后端会自动灌入演示数据。默认账号：

- 邮箱：`demo@healthtrack.local`
- 密码：`Demo123456!`

这个逻辑位于 [server/src/main/java/com/healthtrack/mvp/config/SeedDataInitializer.java](server/src/main/java/com/healthtrack/mvp/config/SeedDataInitializer.java)。

## 环境变量

### 根目录 `.env`

数据库：

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DB`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

鉴权：

- `JWT_SECRET`

Dify 每日建议：

- `DIFY_BASE_URL`
- `DIFY_API_KEY`
- `DIFY_WORKFLOW_ID`
- `DIFY_INPUT_VARIABLE`
- `DIFY_INPUT_STRINGIFY`

Dify 记录抽取：

- `DIFY_EXTRACTOR_BASE_URL`
- `DIFY_EXTRACTOR_API_KEY`
- `DIFY_EXTRACTOR_WORKFLOW_ID`
- `DIFY_EXTRACTOR_INPUT_VARIABLE`
- `DIFY_EXTRACTOR_PROFILE_INPUT_VARIABLE`

缓存与运行环境：

- `REDIS_HOST`
- `REDIS_PORT`
- `SPRING_PROFILES_ACTIVE`

### 移动端 `mobile/.env`

- `EXPO_PUBLIC_API_BASE_URL`

## Android 与权限要求

- 当前移动端为 Android-only
- `mobile/app.json` 已将 Android `minSdkVersion` 配置为 `26`
- Manifest 已声明：
  - `android.permission.ACTIVITY_RECOGNITION`
  - `android.permission.health.READ_STEPS`
  - `android.hardware.sensor.stepcounter`
  - `android.hardware.sensor.stepdetector`
- Health Connect 权限当前主要用于后续扩展，现阶段主流程还是设备传感器计步

## Android APK 打包

### 通用 Release APK

```powershell
cd mobile\android
.\gradlew.bat assembleRelease
```

输出文件：

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 更小的 arm64 Release APK

```powershell
cd mobile\android
.\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a' '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pandroid.enableShrinkResourcesInReleaseBuilds=true'
```

> 当前 `release` 仍使用 debug keystore 签名，只适合内部验证；如果要正式分发，需要先修改 [mobile/android/app/build.gradle](mobile/android/app/build.gradle) 中的签名配置。

## 已知限制

- `AI Chat` 目前是“聊天外观 + 业务归档入口”，还不是完整的 Dify 多轮对话
- 语音按钮当前仅保留入口，尚未接入录音与转写
- 步数同步当前主链路仅使用 Android `Step Counter` 传感器，Health Connect UI 仍未开放
- 部分模拟器和设备没有步数传感器时，计步能力不可用
- `dev-mobile.ps1` 对本地 Android 模拟器名称有硬编码依赖
- `web/` 目录不是当前主交付面

## 相关文档

- [docs/dify-integration-guide.md](docs/dify-integration-guide.md)
- [docs/dify-chatflow-tool-routing-guide.md](docs/dify-chatflow-tool-routing-guide.md)
- [mobile/README.md](mobile/README.md)
