# 生命卫士 MVP

生命卫士是一个面向健康管理场景的 monorepo，当前主交付是 Android 移动端和 Spring Boot 后端。产品已经从传统的多表单打卡切换到 `Chat-as-Interface`：饮食、运动、睡眠、血糖等日常信息优先通过自然语言对话进入系统，再由后端归档并驱动每日建议刷新。

## 当前状态

- Android App 是当前主交付，`web/` 仅保留为原型目录
- 支持登录 / 注册 / 访客模式；后端不可用时会回退到本地离线演示数据
- Dashboard 会展示今日 AI 建议、热量和运动概览、血糖趋势与 8 小时预测
- AI Chat 是唯一的日常输入入口，文本发送可用，语音入口已预留
- 后端会尝试从对话里抽取饮食、运动、护理、睡眠和血糖信息并落库
- Dify 当前主要用于“每日 AI 建议”和“记录抽取增强”，聊天页还不是完整的 Dify 多轮对话

## 目录结构

```text
.
├─ mobile/      Expo + React Native + TypeScript 移动端
├─ server/      Spring Boot 后端
├─ docs/        补充设计 / 接入文档
├─ scripts/     常用启动脚本
├─ web/         Web 原型目录
├─ docker-compose.yml
└─ README.md
```

## 技术栈

### Mobile

- Expo 55
- React 19
- React Native 0.83
- TypeScript
- React Navigation
- AsyncStorage
- `expo-image-picker`
- `react-native-svg`

### Server

- Spring Boot 3.3
- Java 17
- Spring Security + JWT
- Spring Data JPA
- MySQL 8 / H2
- Redis
- springdoc-openapi
- Dify Workflow API

## 当前能力

### 移动端

- `Onboarding Wizard`
  - 首次建档
  - 编辑昵称、头像、疾病标签、阶段目标、基础指标、用药与照护重点
- `Dashboard`
  - 今日 AI 建议摘要卡
  - 热量和运动环形概览
  - 血糖趋势或 8 小时预测图
  - 方案详情页，展示推演依据、系统观察和参考指标
- `AI Chat`
  - 统一的自然语言记录入口
  - 文本发送可用
  - 发送后会触发后端归档和建议刷新
  - 语音按钮已预留，后续可接录音与转写
- `Profile`
  - 头像、昵称和基础健康档案编辑
  - 最近 7 日统计概览
  - 登录同步 / 退出登录
- `Auth & Fallback`
  - 登录 / 注册
  - 访客模式与本地离线回退

### 后端接口

- `/api/auth/*` 登录与注册
- `/api/profile` 健康档案查询和更新
- `/api/dashboard/summary` 与 `/api/dashboard/snapshot` 仪表盘数据
- `/api/dashboard/adjustment-feedback` 建议反馈
- `/api/interaction/thread` 与 `/api/interaction/messages` 对话线程和消息提交
- `/api/advice/daily` 每日建议
- `/api/records/*` 饮食、运动、护理记录
- Swagger UI：`http://localhost:8080/swagger-ui.html`
- OpenAPI JSON：`http://localhost:8080/v3/api-docs`

## 快速开始

### 推荐方式：Windows + Android 本地开发

先准备环境变量文件：

```powershell
Copy-Item .env.example .env
Copy-Item mobile/.env.example mobile/.env
```

确认 `mobile/.env` 中的 `EXPO_PUBLIC_API_BASE_URL` 指向后端：

- Android 模拟器：`http://10.0.2.2:8080`
- Android 真机：`http://<你的局域网 IP>:8080`

然后直接运行：

```powershell
.\scripts\dev-all.ps1
```

这个脚本会分别打开两个窗口：

- `scripts/dev-server.ps1`
  - 会读取根目录 `.env`
  - 如果没有设置 `SPRING_PROFILES_ACTIVE`，默认使用 `local`
  - `local` 模式使用 H2 文件数据库，不依赖 MySQL / Redis
- `scripts/dev-mobile.ps1`
  - 自动检查 Android SDK / Java
  - 启动模拟器
  - 安装 Android debug app
  - 启动 Metro dev client

### 手动启动

#### 1. 启动后端

如果你想走本地最轻量模式：

```powershell
Copy-Item .env.example .env
$env:SPRING_PROFILES_ACTIVE = "local"
cd server
.\mvnw.cmd spring-boot:run
```

如果你想连 MySQL / Redis，先启动依赖：

```powershell
Copy-Item .env.example .env
docker compose up -d mysql redis
cd server
.\mvnw.cmd spring-boot:run
```

#### 2. 启动移动端

```powershell
Copy-Item mobile/.env.example mobile/.env
cd mobile
npm install
npm run android
```

如果已经生成原生工程并使用 dev client，也可以：

```powershell
cd mobile
npm run start:dev-client
```

### Docker Compose 全栈启动

`docker-compose.yml` 当前会启动：

- MySQL
- Redis
- Server

启动方式：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

默认后端地址：

- `http://localhost:8080`

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

### 瘦身版 Release APK

推荐只打 `arm64-v8a`，并开启混淆与资源压缩：

```powershell
cd mobile\android
.\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a' '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pandroid.enableShrinkResourcesInReleaseBuilds=true'
```

当前项目实测：

- 通用 APK 约 `77 MB`
- 瘦身后的 arm64 APK 约 `25 MB`

## 常用脚本

- `scripts/dev-all.ps1`
- `scripts/dev-server.ps1`
- `scripts/dev-mobile.ps1`
- `scripts/dev-server.sh`
- `scripts/dev-mobile.sh`
- `scripts/dev-setup.sh`

## 已知限制

- 自定义头像目前只保存在移动端本地资料中，后端暂未提供头像上传与跨设备同步
- AI Chat 当前仍是“业务输入入口 + 归档刷新”，不是完整的大模型多轮对话
- 语音按钮目前只保留入口，尚未接入录音与转写
- 后端不可用时虽然可以离线演示，但离线数据不会自动回写到云端
- `web/` 目录不是当前主交付面

## 相关文档

- Dify 接入说明：`docs/dify-integration-guide.md`
- 移动端补充说明：`mobile/README.md`
