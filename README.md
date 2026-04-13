# 生命卫士 MVP

一个面向健康管理场景的 monorepo。当前重点是 Android 移动端与 Spring Boot 后端联调，产品形态已经从传统日常打卡改为 `Chat-as-Interface`。

## 当前产品形态

- 移动端日常记录入口只有 `AI 交流页`，饮食、运动、睡眠等不再通过表单逐项录入。
- 首次进入时保留 `初始建档向导`，用于采集疾病标签、基线指标、用药与照护重点。
- 首页展示压缩后的今日 AI 建议，以及热量、运动时长、血糖趋势等只读指标。
- 个人页支持编辑昵称、头像和基础健康资料。
- 支持自定义头像，从系统相册选择后保存到当前设备本地资料。
- 登录 / 注册 / 本地会话已接通；后端不可用时，移动端会回退到本地离线模式继续演示。

## 目录结构

```text
.
├─ mobile/      Expo + React Native + TypeScript 移动端
├─ server/      Spring Boot 后端
├─ web/         Web 侧原型目录
├─ scripts/     常用启动脚本
├─ docker-compose.yml
└─ README.md
```

## 技术栈

### Mobile

- Expo 55
- React Native 0.83
- TypeScript
- React Navigation
- `expo-image-picker`
- `react-native-svg`
- `@expo/vector-icons`

### Server

- Spring Boot 3
- Java 17
- Spring Security + JWT
- Spring Data JPA
- MySQL 8
- Redis
- Dify API

## 当前移动端能力

- `Onboarding Wizard`
  - 首次建档
  - 编辑昵称、头像、疾病标签、目标、基线指标、用药与备注
- `Dashboard`
  - 今日 AI 建议摘要卡
  - 环形进度与血糖趋势可视化
  - 点击进入二级详情页查看完整建议
- `AI Chat`
  - 唯一日常输入入口
  - 文本发送可用
  - 语音按钮已预留入口，后续可接录音与转写
- `Profile`
  - 头像、昵称、基础信息展示与编辑
  - 最近 7 日统计概览
  - 登录同步入口

## 已知限制

- 自定义头像目前保存在移动端本地资料中，后端暂未提供头像上传与跨设备同步字段。
- 当后端接口不可用时，移动端会自动回退到本地离线数据。
- `web/` 目录不是当前主交付面，主要交付仍是 Android App。

## 环境变量

根目录 `.env.example` 用于后端和 Docker Compose：

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DB`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `DIFY_BASE_URL`
- `DIFY_API_KEY`
- `DIFY_WORKFLOW_ID`
- `REDIS_HOST`
- `REDIS_PORT`
- `SPRING_PROFILES_ACTIVE`

移动端单独使用 `mobile/.env.example`：

- `EXPO_PUBLIC_API_BASE_URL`

常见取值：

- Android 模拟器：`http://10.0.2.2:8080`
- Android 真机：`http://<你的局域网 IP>:8080`

## 本地启动

### 1. 准备环境变量

```bash
cp .env.example .env
cp mobile/.env.example mobile/.env
```

### 2. 启动数据库与缓存

```bash
docker compose up -d mysql redis
```

或使用脚本：

```bash
./scripts/dev-setup.sh
```

Windows PowerShell 可使用：

```powershell
.\scripts\dev-all.ps1
```

### 3. 启动后端

```bash
cd server
./mvnw spring-boot:run
```

Windows PowerShell：

```powershell
cd server
.\mvnw.cmd spring-boot:run
```

### 4. 启动移动端

```bash
cd mobile
npm install
npm run android
```

如果已经生成原生工程并使用 dev client，也可以：

```bash
cd mobile
npm run start:dev-client
```

## Docker Compose

当前 `docker-compose.yml` 会启动：

- MySQL
- Redis
- Server

启动方式：

```bash
cp .env.example .env
docker compose up --build
```

默认后端地址：

- `http://localhost:8080`

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

- `scripts/dev-mobile.sh`
- `scripts/dev-mobile.ps1`
- `scripts/dev-server.sh`
- `scripts/dev-server.ps1`
- `scripts/dev-all.ps1`

## 当前开发重点

- 完善移动端与后端的真实接口映射
- 接入语音录音与转写
- 补齐头像等资料字段的后端同步
- 继续优化医疗风格视觉与适老化体验
