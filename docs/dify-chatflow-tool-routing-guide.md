# Dify Chatflow 工具调用判断设计

本文聚焦一个问题：

> 在 `Chatflow` 里，如何判断这一轮是否需要调用工具，以及应该调用哪个工具。

适用前提：

- 你已经把“数据抽取 workflow”和“日建议 workflow”封装成了工具
- 你希望聊天页主链路改为 `Chatflow`
- 你希望减少不必要的工具调用和整体延迟

## 1. 一句话结论

不要把“是否调用工具”完全交给大模型自由决定。

推荐做法是把判断拆成两层：

1. 用 `Question Classifier` 判断这一轮消息属于哪类意图
2. 用 `If-Else` 根据结构化结果决定是否继续调用下一个工具

也就是说：

- 先做路由
- 再做条件判断
- 最后才调用工具

而不是每轮都直接丢给 `Agent` 自由发挥。

## 2. 为什么不建议每轮都交给 Agent

如果你的工具只有两个：

- `extract_record_tool`
- `daily_advice_tool`

那么意图边界其实已经比较清楚。

这时候如果每轮都走：

`User Input -> Agent -> Agent 自己决定调不调工具 -> Answer`

会有几个问题：

- 延迟不稳定
- 工具调用不可控
- 追问场景容易多走一步
- 健康场景下难做安全约束
- 很难排查“为什么这一轮调了工具”

更稳的做法是：

`Start -> If/Question Classifier -> Tool -> If-Else -> LLM -> Answer`

## 3. 推荐总流程

推荐把 Chatflow 设计成下面这个结构：

```text
Start
-> If-Else: pending_followup ?
   -> yes:
      -> extract_record_tool
      -> If-Else
         -> needs_followup = true: Answer(继续追问)
         -> risk_level = high: Answer(安全文案)
         -> should_refresh_advice = true: daily_advice_tool -> LLM -> Answer
         -> else: LLM -> Answer

   -> no:
      -> Question Classifier
         -> chitchat
            -> LLM
            -> Answer
         -> record_only
            -> extract_record_tool
            -> If-Else
         -> record_and_advise
            -> extract_record_tool
            -> If-Else
         -> advise_only
            -> daily_advice_tool
            -> LLM
            -> Answer
         -> risk
            -> Answer(安全文案)
```

这个结构的核心思想是：

- 不先问“能不能调工具”
- 而是先问“这条消息是什么类型”

## 4. 建议的意图分类

`Question Classifier` 建议至少分成 5 类。

### 4.1 `chitchat`

定义：

- 打招呼
- 感谢
- 能力咨询
- 闲聊
- 不包含明确健康记录或建议请求

典型输入：

- `你好`
- `谢谢`
- `你能帮我做什么`
- `今天状态一般`

工具策略：

- 不调用工具
- 直接让 LLM 简短回复

### 4.2 `record_only`

定义：

- 用户在上报今天的数据
- 重点是记录，不是让系统分析和建议

典型输入：

- `晚饭吃了面和蛋糕，大概 700 kcal`
- `今天走了 8000 步`
- `昨晚睡了 6 小时`
- `刚测血糖 7.8`

工具策略：

- 调用 `extract_record_tool`
- 默认不调用 `daily_advice_tool`
- 只有当抽取结果显示状态明显变化时，再决定要不要补调建议工具

### 4.3 `record_and_advise`

定义：

- 用户既在上报数据，也明确要求建议

典型输入：

- `晚饭吃多了，今天该怎么调`
- `刚测餐后血糖 9.2，要不要多运动一下`
- `今天只睡了 5 小时，帮我看看要注意什么`

工具策略：

- 先调用 `extract_record_tool`
- 再根据抽取结果调用 `daily_advice_tool`

### 4.4 `advise_only`

定义：

- 用户这一轮没有提供新的记录
- 只是想问当前该如何调整、总结、分析

典型输入：

- `今天整体该怎么安排`
- `帮我总结一下今天的问题`
- `现在最需要注意什么`

工具策略：

- 直接调用 `daily_advice_tool`
- 不必先调抽取工具

### 4.5 `risk`

定义：

- 用户描述明显高风险或紧急情况

典型输入：

- `头晕冒冷汗，感觉快站不住了`
- `血糖特别低，人发抖`
- `胸闷很厉害`

工具策略：

- 不走普通建议链路
- 直接返回固定安全文案

## 5. 第一层判断：什么时候完全不需要调用工具

下面几种情况建议直接不调用任何工具：

- 闲聊
- 问候
- 感谢
- 询问产品能力
- 对上一轮的非结构化回应，如 `好的`、`明白了`

推荐规则：

如果消息既不包含新的健康记录，也不包含建议请求，也不是上一轮追问的补充回答，那么就不调用工具。

## 6. 第二层判断：什么时候需要调用 `extract_record_tool`

以下场景应该调用 `extract_record_tool`：

- 用户在描述饮食
- 用户在描述运动
- 用户在描述睡眠
- 用户在描述血糖/血压/心率等指标
- 用户在描述症状
- 用户在回答上一轮系统追问

### 6.1 强规则

只要满足以下任一条件，就调用 `extract_record_tool`：

- `pending_followup = true`
- 当前意图为 `record_only`
- 当前意图为 `record_and_advise`

### 6.2 为什么追问场景一定要调抽取工具

因为用户补充回答时常常非常短，例如：

- `7.8`
- `晚饭后测的`
- `大概 30 分钟`

这种消息单看几乎无法分类，但放在“上一轮在追问”的上下文里就很明确。

所以：

- 不要只看当前文本
- 一定要结合 `pending_followup`

## 7. 第二层判断：什么时候需要调用 `daily_advice_tool`

`daily_advice_tool` 不应该在每次记录后都调用。

推荐只在下面几类场景调用：

- 当前意图为 `advise_only`
- 当前意图为 `record_and_advise`
- 抽取工具返回 `should_refresh_advice = true`
- 抽取结果显示风险或状态有明显变化，需要更新建议

### 7.1 不建议调用建议工具的场景

以下情况建议只确认记录成功，不要顺手补一段建议：

- 普通的饮食记录
- 普通的步数记录
- 普通的睡眠记录
- 用户没有主动求建议
- 抽取结果没有显示明显变化

这样可以显著降低平均延迟。

## 8. 工具输出必须结构化

要做好判断，工具输出必须可判断，不能只有自然语言。

### 8.1 `extract_record_tool` 推荐输出

```json
{
  "is_health_record": true,
  "record_types": ["diet", "glucose"],
  "structured_data": {
    "diet": {
      "meal_type": "晚餐",
      "food_name": "面和蛋糕",
      "calories": 700
    },
    "glucose": {
      "glucose_mmol": 9.2,
      "measurement_context": "餐后"
    }
  },
  "missing_fields": [],
  "needs_followup": false,
  "followup_question": "",
  "state_changed": true,
  "risk_level": "medium",
  "should_refresh_advice": true,
  "confidence": 0.92
}
```

### 8.2 `daily_advice_tool` 推荐输出

```json
{
  "advice_text": "今晚优先控制后续加餐，并安排一次轻量步行，观察餐后状态变化。",
  "priority": "diet_control",
  "reason": "本轮摄入偏高，且餐后波动风险上升。",
  "next_action": "饭后步行 15-20 分钟并记录下一次监测值。",
  "requires_safe_notice": false
}
```

## 9. If-Else 条件建议

在 `extract_record_tool` 后，建议接一组顺序明确的 `If-Else`。

优先级建议如下：

1. `needs_followup = true`
2. `risk_level = high`
3. `should_refresh_advice = true`
4. 默认仅记录确认

也就是：

```text
if needs_followup == true:
  直接追问
elif risk_level == "high":
  返回安全文案
elif should_refresh_advice == true:
  调用 daily_advice_tool
else:
  仅确认已记录
```

注意这个顺序不要反过来。

如果已经需要追问，就不要先给建议。

如果已经是高风险，也不要走普通建议文案。

## 10. Conversation Variables 建议

`Chatflow` 里不要只依赖上下文窗口，建议明确保存会话变量。

至少建议保存这些变量：

```json
{
  "today_state": {},
  "pending_followup": false,
  "pending_slots": [],
  "last_intent": "",
  "last_advice": "",
  "risk_level": "low",
  "focus_date": "",
  "user_id": ""
}
```

### 10.1 关键变量说明

`today_state`

- 保存今天已经确认的记录摘要
- 后续建议工具直接用这个对象，而不是整段聊天历史

`pending_followup`

- 标记上一轮是否在追问
- 如果是，下一轮优先走抽取工具

`pending_slots`

- 保存还缺哪些字段
- 例如 `["meal_type", "glucose_context"]`

`last_intent`

- 便于分析链路和排查路由问题

## 11. Variable Assigner 应该怎么用

推荐在工具调用后用 `Variable Assigner` 更新会话变量。

### 11.1 抽取后更新

如果 `extract_record_tool` 成功：

- 更新 `today_state`
- 更新 `risk_level`
- 更新 `pending_followup`
- 更新 `pending_slots`

### 11.2 建议后更新

如果 `daily_advice_tool` 成功：

- 更新 `last_advice`

这样下一轮用户问：

- `那现在最重要的是哪个`
- `我照这个做就行吗`

就可以参考上一轮建议而不是从头分析。

## 12. 回复节点怎么设计

不要把工具原始输出直接展示给用户。

推荐让最后一个 `LLM` 只负责“说人话”，不要负责重新判断业务。

### 12.1 记录确认回复模板

适用：

- 调用了 `extract_record_tool`
- 不需要追问
- 不需要刷新建议

回复目标：

- 确认已记录什么
- 语气简洁
- 不额外展开长建议

示例：

`已记录今晚饮食和血糖信息。如果你愿意，我可以继续基于今天的数据帮你看下一步怎么调。`

### 12.2 追问回复模板

适用：

- `needs_followup = true`

回复目标：

- 一次只问一个问题
- 不要把多个缺失字段混成一长串

示例：

`这次血糖是空腹测的，还是餐后测的？`

### 12.3 建议回复模板

适用：

- 调用了 `daily_advice_tool`

回复目标：

- 先确认当前变化
- 再给一个最优先建议
- 最多补一个下一步动作

示例：

`这轮记录已经补全。结合今天的摄入和餐后波动，今晚更优先控制后续加餐，并安排 15 到 20 分钟轻量步行。之后如果方便，再补一条餐后监测值，我可以继续帮你判断。`

## 13. 推荐的分类提示词

可用于 `Question Classifier` 的分类描述：

### `chitchat`

消息主要是问候、感谢、闲聊、能力咨询，未提供明确健康记录，也未明确索要健康建议。

### `record_only`

消息主要是在描述饮食、运动、睡眠、血糖、症状等健康相关记录，重点是上报数据，没有明显请求分析或建议。

### `record_and_advise`

消息既包含新的健康记录，又明确请求分析、建议、调整方案或风险判断。

### `advise_only`

消息没有明显提供新的健康记录，主要是在请求总结、分析、提醒或当下建议。

### `risk`

消息包含明显的急性不适、严重风险、紧急情况或需要优先安全提醒的表达。

## 14. 推荐的工具调用策略总结

可以直接记住下面这张表。

| 场景 | 调用抽取工具 | 调用建议工具 |
| --- | --- | --- |
| 闲聊/问候 | 否 | 否 |
| 仅记录 | 是 | 否，除非状态明显变化 |
| 记录并求建议 | 是 | 是 |
| 仅求建议 | 否 | 是 |
| 上一轮在追问，本轮是补充回答 | 是 | 视抽取结果而定 |
| 高风险 | 否 | 否，直接安全文案 |

## 15. 几个真实例子

### 15.1 例子一：只记录

用户输入：

`今天走了 9000 步`

流程：

1. 分类为 `record_only`
2. 调用 `extract_record_tool`
3. 返回 `needs_followup = false`
4. 返回 `should_refresh_advice = false`
5. 只做记录确认

### 15.2 例子二：记录并求建议

用户输入：

`晚饭吃多了，大概 800 kcal，今晚怎么调`

流程：

1. 分类为 `record_and_advise`
2. 调用 `extract_record_tool`
3. 返回 `should_refresh_advice = true`
4. 调用 `daily_advice_tool`
5. 输出整合后的建议

### 15.3 例子三：追问补充

上一轮：

`这次血糖是空腹还是餐后测的？`

用户输入：

`餐后两小时`

流程：

1. 因为 `pending_followup = true`，跳过分类，直接调 `extract_record_tool`
2. 更新 `today_state`
3. 若信息补全且需要刷新建议，则调用 `daily_advice_tool`

### 15.4 例子四：闲聊

用户输入：

`你现在能做什么`

流程：

1. 分类为 `chitchat`
2. 不调工具
3. 直接回复能力边界说明

### 15.5 例子五：高风险

用户输入：

`我现在头晕、冒汗、手抖，感觉不太对`

流程：

1. 分类为 `risk`
2. 不调普通工具
3. 直接返回固定安全文案

## 16. 不推荐的设计

### 16.1 不推荐：每轮都调抽取工具

问题：

- 闲聊也会增加延迟
- 工具消耗不必要

### 16.2 不推荐：每次记录后都调建议工具

问题：

- 回复容易啰嗦
- 平均延迟升高
- 用户只是在记账时会被频繁“教育”

### 16.3 不推荐：抽取工具直接输出给用户

问题：

- 文案不自然
- 不利于后续编排
- 结构化字段和面向用户的话术会耦合

### 16.4 不推荐：完全依赖聊天记忆

问题：

- 追问容易丢上下文
- 很难稳定识别短句补充回答

## 17. 最终推荐方案

对于当前项目，推荐采用下面这套原则：

1. 先用 `pending_followup` 判断是否进入追问补充模式
2. 再用 `Question Classifier` 判断消息意图
3. 只有 `record_*` 场景才调 `extract_record_tool`
4. 只有 `advise_*` 场景或状态明显变化时才调 `daily_advice_tool`
5. 高风险场景直接走固定安全文案
6. 用 `Conversation Variables` 存状态，不依赖模型自己记忆
7. 最终回复由独立 LLM 节点整理成人话，不直接展示工具结果

如果你希望下一步继续细化，建议继续补这三份内容：

- `Question Classifier` 的完整标签文案
- `extract_record_tool` / `daily_advice_tool` 的输入输出 schema
- 一份 Dify 画布节点清单

## 18. 相关官方文档

- Workflow / Chatflow 概念：<https://docs.dify.ai/en/use-dify/build/workflow-chatflow>
- Question Classifier：<https://docs.dify.ai/versions/3-0-x/en/user-guide/workflow/node/question-classifier>
- Variables：<https://docs.dify.ai/versions/3-0-x/en/user-guide/workflow/variables>
- Variable Assigner：<https://docs.dify.ai/en/use-dify/nodes/variable-assigner>
- Agent：<https://docs.dify.ai/en/use-dify/nodes/agent>
- Answer：<https://docs.dify.ai/en/use-dify/nodes/answer>

