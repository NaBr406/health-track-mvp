# Dify 接入指南（结合 `health-track-mvp` 项目）

本文按当前仓库的真实结构来写，目标是让你能把 Dify 作为 AI 后端接进这个项目，并清楚知道：

- 现在项目里哪些能力已经接到了 Dify
- 现有代码和 Dify Workflow 应该怎么对上
- 本地怎么配置、怎么联调、怎么验收
- 如果后面想把 `AI Chat` 改成真正的 Dify 多轮对话，应该怎么演进

## 1. 先说结论：这个项目现在是怎么接 Dify 的

当前项目采用的是推荐的服务端代理模式：

`React Native App -> Spring Boot Server -> Dify`

这条链路是对的，因为：

- Dify API Key 只保存在服务端，不会暴露到移动端
- 移动端只关心自己的业务接口，不直接耦合 Dify
- 后续如果从 Dify 换成别的模型平台，移动端基本不用改

## 2. 当前代码里的 Dify 接入点

### 2.1 已经接到 Dify 的部分

目前真正调用 Dify 的地方只有“每日 AI 建议”这一块：

- `server/src/main/java/com/healthtrack/mvp/integration/dify/DifyClient.java`
- `server/src/main/java/com/healthtrack/mvp/service/AdviceService.java`

调用链路如下：

1. 移动端进入首页，或发送一条新的互动消息
2. 服务端计算当日数据汇总
3. `AdviceService` 组装健康上下文 payload
4. `DifyClient` 调用 Dify Workflow
5. 返回建议文本，写入 `ai_advice_logs`
6. 首页 `Dashboard` 展示最新建议

对应的主要接口：

- `GET /api/dashboard/snapshot`
- `GET /api/advice/daily`
- `POST /api/interaction/messages`

### 2.2 还没有真正接到 Dify 的部分

`AI Chat` 页面现在不是“Dify 聊天机器人”，而是“业务输入入口 + 服务端解析”：

- `mobile/src/screens/app/AIChatScreen.tsx`
- `mobile/src/lib/api.ts`
- `server/src/main/java/com/healthtrack/mvp/service/InteractionService.java`

当前行为是：

1. 用户在聊天页输入“今天走了 6000 步”“晚饭 700 kcal”“血糖 8.2”之类内容
2. 服务端用正则和规则把它解析成饮食、运动、护理记录
3. 刷新当日建议
4. 再返回一条服务端拼接出来的回复文本

也就是说：

- 现在的 `AI Chat` 是“聊天外观”
- 但背后仍然是“规则解析 + 数据入库 + 刷新建议”
- 它还不是 Dify 的多轮大模型对话

这个区分非常重要，后面做联调时不要误以为聊天页已经在直接调用 Dify。

## 3. 当前项目最适合接哪种 Dify 应用

### 3.1 当前代码最适合：`Workflow`

因为 `DifyClient` 现在调用的是 Workflow API，而不是 Chat API。

服务端当前逻辑：

- 组装一份结构化健康上下文
- 调用工作流
- 从工作流输出中抽取一段最终建议文本

所以最稳的配置方式是：

1. 在 Dify 创建一个 `Workflow` 应用
2. 让工作流的输入变量与 `AdviceService.buildPayload(...)` 生成的数据结构对齐
3. 在结束节点输出一个明确的文本字段

### 3.2 不是当前主路径：`Chat App` / `Chatflow`

如果你想让聊天页直接变成真正的大模型多轮对话，才需要新增：

- Dify Chatflow 或 Chat App
- `conversation_id` 管理
- 服务端聊天消息转发
- 历史会话持久化

这部分本文后面会单独给建议，但它不是当前项目已经走通的路径。

## 4. 服务端现在传给 Dify 的输入长什么样

`AdviceService.buildPayload(...)` 当前会构造出下面这类 JSON：

```json
{
  "date": "2026-04-14",
  "user": {
    "email": "demo@example.com",
    "nickname": "Alice"
  },
  "profile": {
    "healthGoal": "控制体重",
    "dailyCalorieGoal": 1600,
    "weeklyExerciseGoalMinutes": 150,
    "careFocus": "餐后血糖",
    "weightKg": 70.5,
    "targetWeightKg": 65.0
  },
  "summary": {
    "dietCount": 2,
    "exerciseCount": 1,
    "careCount": 1,
    "totalCalories": 1280,
    "totalExerciseMinutes": 35,
    "totalCareMinutes": 10
  },
  "dietRecords": [
    {
      "mealType": "午餐",
      "foodName": "米饭/主食描述",
      "calories": 650,
      "note": "午饭吃了米饭和鸡胸肉"
    }
  ],
  "exerciseRecords": [
    {
      "activityName": "步行",
      "durationMinutes": 35,
      "caloriesBurned": 140,
      "intensity": "中"
    }
  ],
  "careRecords": [
    {
      "category": "监测",
      "itemName": "血糖记录",
      "durationMinutes": 0,
      "status": "reported"
    }
  ]
}
```

这就是你在 Dify 工作流里需要消费的核心上下文。

## 5. 在 Dify 里应该怎么建这个 Workflow

## 5.1 创建应用

建议名称：

- `health-track-daily-advice`

建议类型：

- `Workflow`

## 5.2 Start 节点输入

零改代码时，建议尽量与当前服务端 payload 对齐，至少覆盖这些输入：

- `date`
- `user`
- `profile`
- `summary`
- `dietRecords`
- `exerciseRecords`
- `careRecords`

推荐做法：

- `date` 用文本
- `user`、`profile`、`summary` 用对象
- 记录列表如果你的 Dify 版本支持数组/对象结构输入，就直接按结构接
- 如果你所用的 Dify 版本对数组输入支持有限，最稳妥的替代方案是把这些记录改成 JSON 字符串输入，再在工作流里解析

如果你想让兼容性更稳，后续可以把服务端重构成只传一个总对象，例如：

- `health_context`

这样 Workflow Start 节点只需要一个对象变量，维护成本更低。

## 5.3 LLM 节点提示词建议

你这个项目是健康管理场景，建议把提示词写成“结构化输入 -> 简明生活建议”，而不是开放闲聊。

建议约束：

- 只基于输入数据给建议，不编造不存在的监测值
- 输出简洁、可执行、偏生活方式，不输出诊断结论
- 避免绝对化医疗判断
- 最好包含：
  - 今日概览
  - 一个优先调整点
  - 一个可执行动作
  - 一句提醒

可参考的系统提示思路：

```text
你是健康管理 MVP 的每日建议助手。

请基于用户当天的饮食、运动、护理和档案信息，输出一段简短、可执行、风险克制的中文建议。

要求：
1. 不要编造未提供的数据。
2. 不要给出诊断、用药调整、急救结论。
3. 优先输出生活方式建议，如饮食结构、活动量、睡眠、记录习惯。
4. 用语简洁，适合直接显示在移动端首页。
5. 最终只输出最终建议正文，不要输出 JSON，不要输出标题前缀。
```

## 5.4 End 节点输出

当前项目的 `DifyClient.extractAdviceText(...)` 会优先读取这些字段：

- `data.outputs.text`
- `data.outputs.advice`
- `data.outputs.answer`
- `data.output.text`
- `answer`

所以最推荐你在 Workflow 的结束节点统一输出：

- `text`

这样最不容易出错。

如果输出字段名对不上，服务端虽然会调用成功，但拿不到最终建议文本。

## 6. 本项目里要改的环境变量

根目录 `.env` 需要配置这些 Dify 相关变量：

```env
DIFY_BASE_URL=https://api.dify.ai
DIFY_API_KEY=app-xxxxxxxxxxxxxxxx
DIFY_WORKFLOW_ID=
```

说明如下：

- `DIFY_BASE_URL`
  - 如果你用 Dify Cloud，填 `https://api.dify.ai`
  - 如果你用自部署，填你的服务根地址
  - 当前代码会自己拼 `/v1/...`
  - 所以这里不要额外再写 `/v1`

- `DIFY_API_KEY`
  - 使用应用级 API Key
  - 从 Dify 应用发布后的 API Access 页面获取
  - 只能放在服务端，不能放到移动端

- `DIFY_WORKFLOW_ID`
  - 当前项目里建议先留空
  - 因为当前官方推荐的 Workflow 运行接口是 `POST /v1/workflows/run`
  - 项目代码在这个变量有值时会改走 `/v1/workflows/{workflowId}/run`
  - 如果你没有明确的网关或兼容层要求，不建议填它

## 7. 本地启动顺序

### 7.1 准备环境变量

```powershell
Copy-Item .env.example .env
```

移动端如果还没有自己的环境文件，再准备：

```powershell
Copy-Item mobile/.env.example mobile/.env
```

并确认：

- 根目录 `.env` 里 Dify 变量已填好
- `mobile/.env` 里的 `EXPO_PUBLIC_API_BASE_URL` 指向后端

Android 模拟器常用：

```text
http://10.0.2.2:8080
```

### 7.2 启动数据库和 Redis

```powershell
docker compose up -d mysql redis
```

### 7.3 启动服务端

```powershell
cd server
.\mvnw.cmd spring-boot:run
```

### 7.4 启动移动端

```powershell
cd mobile
npm install
npm run android
```

## 8. 这个项目里 Dify 的真实调用链路

### 8.1 首页加载时

移动端会调用：

- `GET /api/dashboard/snapshot`

服务端内部过程：

1. `InteractionService.getDashboardSnapshot(...)`
2. `AdviceService.getDailyAdvice(...)`
3. 查询当天是否已有建议日志
4. 没有则调用 `generateAndSaveAdvice(...)`
5. `DifyClient.generateDailyAdvice(...)` 请求 Dify
6. 将请求体、响应体、建议文本存到 `ai_advice_logs`

### 8.2 聊天页发送消息时

移动端会调用：

- `POST /api/interaction/messages`

服务端内部过程：

1. `InteractionService.sendMessage(...)`
2. 先把消息解析成饮食/运动/护理记录
3. 数据落库
4. 调用 `AdviceService.refreshDailyAdvice(...)`
5. 再次请求 Dify，生成新的每日建议
6. 返回新的消息线程和 dashboard snapshot

所以聊天页虽然没有直接调 Dify 聊天 API，但它会间接触发 Dify 的“每日建议重算”。

## 9. 怎么验证 Dify 已经真正接通

最简单的验证分成 4 步。

### 9.1 先注册或登录，拿到 JWT

注册：

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "demo@example.com",
  "password": "12345678",
  "nickname": "Demo"
}
```

登录：

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "demo@example.com",
  "password": "12345678"
}
```

返回里会有：

- `token`
- `userId`
- `email`
- `nickname`

### 9.2 完成基础档案

更新档案接口：

- `PUT /api/profile`

这一步很重要，因为档案里的这些信息会进 Dify 上下文：

- `healthGoal`
- `careFocus`
- `weightKg`
- `targetWeightKg`
- 目标热量和运动信息

### 9.3 发送一条互动消息

例如：

```http
POST /api/interaction/messages
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "focusDate": "2026-04-14",
  "inputMode": "text",
  "message": "今天走了6000步，晚饭大概700kcal，血糖8.1"
}
```

这一步会同时完成：

- 记录入库
- 刷新每日建议
- 间接调用 Dify Workflow

### 9.4 查看结果

可以从三个地方看：

1. 首页接口返回的 `dashboard.adjustment.summary`
2. `GET /api/advice/daily?date=2026-04-14`
3. 数据库表 `ai_advice_logs`

如果 `ai_advice_logs.source = dify`，说明已经走到真实 Dify。

如果还是 `mock`，说明 Dify 没有真正接通，服务端走了本地兜底逻辑。

## 10. 失败时优先看哪里

### 10.1 返回的是 `mock`

优先检查：

- `.env` 是否真的设置了 `DIFY_BASE_URL` 和 `DIFY_API_KEY`
- 启动后端时是否加载到了正确 profile
- Dify API Key 是否是应用级 Key
- Dify 应用是否已经发布

因为当前 `DifyClient.generateDailyAdvice(...)` 只要：

- `base-url` 为空
- `api-key` 为空
- 请求异常

都会回退到 `AdviceService.buildMockAdvice(...)`。

### 10.2 Dify 调通了，但首页没有显示正确建议

优先检查 Workflow End 节点输出字段名。

当前服务端最稳的约定是输出：

- `text`

如果你输出的是别的名字，服务端可能取不到内容。

### 10.3 401 / 403

区分两类：

- 服务端自己的接口 401：通常是移动端没有带 JWT
- Dify 401：通常是 `DIFY_API_KEY` 无效，或 Key 与应用不匹配

### 10.4 自部署 Dify 访问异常

检查：

- `DIFY_BASE_URL` 是否可从运行服务端的机器访问
- 是否错误地写成了带 `/v1` 的地址
- 是否有反向代理路径重写

## 11. 这个项目当前接 Dify 时的几个关键注意点

### 11.1 `DIFY_WORKFLOW_ID` 先不要急着填

当前代码里：

- 不填时走 `/v1/workflows/run`
- 填了时走 `/v1/workflows/{workflowId}/run`

而官方当前主文档里推荐的是前者。

所以除非你明确知道自己的 Dify 版本或网关支持带 ID 的运行路径，否则建议：

- 先留空

### 11.2 现在的 `AI Chat` 不是 Dify 对话

这会影响预期管理。

如果你现在做完了上面的配置，你能得到的是：

- 首页建议来自 Dify
- 聊天页输入会触发建议刷新

但你还得不到：

- 大模型自由问答
- Dify 多轮上下文记忆
- `conversation_id` 续聊

### 11.3 医疗健康场景要保守输出

你这个产品不是医生工作站，而是健康管理 MVP。

所以 Dify Prompt 最好限制在：

- 生活方式建议
- 记录提醒
- 风险提示

不建议让模型直接输出：

- 诊断
- 药量调整
- 紧急医疗判断

## 12. 如果下一步要把 `AI Chat` 也接到 Dify，推荐怎么做

推荐新开一条聊天集成链路，不要直接把现有 `InteractionService` 全删掉。

建议演进方案：

1. 在 Dify 新建 `Chatflow` 或 `Chat App`
2. 服务端新增一个聊天客户端方法，例如 `sendChatMessage(...)`
3. 在服务端保存 `conversation_id`
4. 让 `POST /api/interaction/messages` 变成两段式处理：
   - 先做结构化记录解析和入库
   - 再把同一条消息转发到 Dify 聊天应用
5. 将 Dify 返回的回答作为聊天页 assistant 消息

推荐保存的额外字段：

- `conversation_id`
- `message_id`
- `focus_date`
- `user_id`
- 原始请求/响应

推荐保存位置：

- MVP 阶段可以先放 MySQL
- 如果希望会话上下文更轻更快，也可以结合 Redis

这样做的好处是：

- 现有“数据入库能力”不丢
- 现有 Dashboard 逻辑不丢
- 聊天页逐步升级为真实 AI 对话，而不是一次性推翻

## 13. 这个项目后续最值得做的 5 个优化

1. 给 `DifyClient` 增加超时、重试和更明确的错误日志。
2. 给 Dify 响应增加状态落库，不只记录 `SUCCESS`。
3. 把当前分散的 payload 收敛为一个统一上下文对象，减少 Workflow 输入维护成本。
4. 为聊天能力新增 Dify Chatflow 集成和 `conversation_id` 持久化。
5. 为健康类输出增加安全规则，例如高风险值时转为固定文案。

## 14. 一条最实用的接入建议

如果你现在的目标是“尽快让 MVP 跑起来”，建议按下面顺序做：

1. 先把首页每日建议接通 Dify Workflow
2. 验证 `ai_advice_logs` 已经记录真实调用
3. 保持聊天页继续承担“记录入口”的角色
4. 等首页链路稳定后，再给聊天页新增 Dify Chatflow

这条路线最稳，也最符合当前仓库已经写好的代码。

## 15. 官方文档参考

以下是接入时最值得看的官方文档：

- Developing with APIs  
  `https://docs.dify.ai/en/use-dify/publish/developing-with-apis`
- Run Workflow  
  `https://docs.dify.ai/api-reference/workflows/run-workflow`
- Send Chat Message  
  `https://docs.dify.ai/api-reference/chats/send-chat-message`
- Get Application Parameters  
  `https://docs.dify.ai/api-reference/application/get-application-parameters-information`
- Upload File  
  `https://docs.dify.ai/api-reference/files/upload-file`

## 16. 和本项目直接相关的文件

- `server/src/main/java/com/healthtrack/mvp/integration/dify/DifyClient.java`
- `server/src/main/java/com/healthtrack/mvp/service/AdviceService.java`
- `server/src/main/java/com/healthtrack/mvp/service/InteractionService.java`
- `server/src/main/resources/application.yml`
- `.env.example`
- `mobile/src/lib/api.ts`
- `mobile/src/screens/app/AIChatScreen.tsx`

如果你愿意继续往下做，下一步最自然的是两种之一：

- 我直接帮你把“Dify Workflow 输入输出”改成更稳的单对象模式
- 我直接帮你把“AI Chat 页面”升级成真正的 Dify Chatflow 对话
