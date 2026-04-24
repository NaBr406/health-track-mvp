# Health Track Mobile

Android 客户端，基于 Expo + React Native，连接仓库中的 `server/` 后端。

## 当前范围

- 登录、注册、游客模式
- Onboarding 健康档案引导
- Dashboard 今日建议、热量/运动/步数概览、血糖趋势与预测
- `AI Chat` 自然语言记录入口
- Profile 与“数据和步数同步”状态页
- 后端不可用时的本地 mock 回退

## 目录结构

移动端现在按 feature 分层，避免把所有逻辑都堆在 `screens/` 里：

```text
mobile/src/
|-- components/            跨页面复用组件
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
|-- lib/                   本地存储、设备能力、mock、工具函数
|-- navigation/            路由与滚动联动
|-- screens/               跨 feature 入口页（当前主要是登录）
|-- shared/api/            通用 API client / identity
|-- theme/                 tokens
`-- types.ts
```

约定上尽量保持：

- `screens/` 只做页面编排
- `components/` 放纯展示组件
- `hooks/` 放交互行为和页面副作用
- `model/` 放纯函数和 UI 派生数据

## 启动方式

### 推荐

```powershell
pwsh ../scripts/dev-server.ps1
pwsh ../scripts/dev-mobile.ps1
```

或者一键启动：

```powershell
pwsh ../scripts/dev-all.ps1
```

`dev-mobile.ps1` 会：

- 自动寻找 Android SDK 与 Java
- 启动名为 `HealthTrack_Pixel_35` 的模拟器
- 安装 debug app
- 在 `8081` 端口启动 Metro dev client
- 重新拉起 App

## 环境变量

仓库当前没有提交 `mobile/.env.example`，请直接创建 `mobile/.env`：

```powershell
Set-Content .env "EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080"
```

常见地址：

- Android 模拟器：`http://10.0.2.2:8080`
- Android 真机：`http://<your-lan-ip>:8080`

如果不设置，开发环境会回退到代码中的默认远端地址。

## 平台要求

- 当前仅支持 Android
- `minSdkVersion = 26`
- 步数同步依赖 Android 设备步数传感器
- 首次使用设备计步需要授予 `ACTIVITY_RECOGNITION` 权限

## 步数同步

当前真正接到页面的是“设备步数传感器”链路：

- 读取 Android `Step Counter` 传感器
- Dashboard 支持实时步数更新
- 后台通过 WorkManager 按 15 分钟间隔采样
- 登录后可同步到服务端 `/api/records/steps/sync`
- 游客态仅保留本地显示

仓库里已经预埋了 Health Connect 相关依赖：

- `expo-health-connect`
- `react-native-health-connect`

但当前版本还没有把 Health Connect 配置流程开放到 UI 主路径里。

## 手动启动

```powershell
cd ..
pwsh .\scripts\dev-server.ps1
cd mobile
npm install
npm run android
```

如果原生工程已经准备好，也可以直接：

```powershell
npm run start:dev-client
```
