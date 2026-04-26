# Dify AI Chat 记录抽取提示词与 JSON Schema

这份文档用于配置 `DifyRecordExtractorClient` 调用的 Dify Workflow。目标是让 AI Chat 的记录抽取稳定使用用户本地时间，并在上一条 8 小时血糖预测仍有效时，以上一条预测曲线的“当前时间节点血糖”作为新一轮预测基线；如果没有有效 8 小时预测，则明确回退到后端给出的基准血糖。

## Start 节点变量

建议在 Dify Workflow 的 Start 节点配置两个输入变量：

- `UserInput`：字符串，用户本次原始消息。
- `UserProfile`：对象，后端传入的用户档案与动态上下文。

后端默认会把 `UserProfile` 作为档案上下文变量名传给 Dify。如果你的 Dify 工作流里变量名不同，可以通过环境变量 `DIFY_EXTRACTOR_PROFILE_INPUT_VARIABLE` 覆盖。

## 新增上下文字段

`UserProfile` 中和本次修改相关的关键字段如下：

- `userTimeZone`：用户 IANA 时区，例如 `Asia/Shanghai`。
- `userCurrentDate`：用户本地当前日期，例如 `2026-04-26`。
- `userCurrentTime`：用户本地当前时间，例如 `18:30:05`。
- `userCurrentDateTime`：带 UTC offset 的用户本地 ISO 时间，例如 `2026-04-26T18:30:05+08:00`。
- `userCurrentUtcOffset`：用户当前 UTC 偏移，例如 `+08:00`。
- `predictionBaselineGlucoseMmol`：后端判定的本轮预测基线血糖。没有本次新实测血糖时，生成 `glucoseForecast8h` 必须从这个值开始。
- `predictionBaselineSource`：预测基线来源，可能是 `active_forecast_current`、`dialog_reported`、`care_record`、`profile_fasting_baseline`、`default_baseline`。
- `defaultGlucoseMmol`：系统默认基准血糖，当前为 `7.2` mmol/L；当用户档案没有可解析的基线时使用。
- `currentGlucoseMmol`：兼容字段，当前与 `predictionBaselineGlucoseMmol` 保持一致；后端会在无有效预测、无实测、无历史记录时填入基准血糖，不再传 `null`。
- `currentGlucoseSource`：当前血糖来源，与 `predictionBaselineSource` 保持一致。`active_forecast_current` 表示来自上一条有效 8 小时预测曲线的当前时间节点。
- `activeForecastCurrentGlucoseMmol`：上一条 8 小时预测仍有效时，按当前时间在曲线上插值得到的血糖值。
- `activeForecastCurrentHourOffset`：当前时间距离上一条预测开始的小时偏移。
- `activeForecastValid`：上一条 8 小时预测是否仍处于有效窗口内。
- `activeForecastStartedAt`：上一条预测开始时间，按用户本地时区格式化。
- `activeForecastExpiresAt`：上一条预测失效时间，按用户本地时区格式化。
- `activeGlucoseForecast8h`：上一条 8 小时预测曲线。
- `activeForecastSource`：上一条预测来源，可能是 `dify` 或 `local`。

## 提示词

可直接复制到 Dify 的 LLM 节点中：

```text
你是健康管理 App 的 AI Chat 记录抽取与血糖 8 小时预测助手。你的任务不是直接聊天，而是把用户消息抽取成后端可归档的结构化 JSON。

输入：
- UserInput：用户本次原始消息。
- UserProfile：用户档案、当前本地时间、当前血糖上下文、上一条有效 8 小时预测上下文。

必须遵守：
1. 所有“现在、今天、今晚、刚才、饭后、稍后”等相对时间，都以 UserProfile.userCurrentDateTime 为准。不要使用 Dify 服务器时间或模型默认时间。
2. 如果用户本次提供了新的实测血糖值，以用户提供的血糖作为本次预测基线，并将 calibrationApplied 设为 true。
3. 如果用户本次没有提供新的实测血糖值，但本次消息包含饮食、热量、活动等足以预测血糖走势的信息，必须使用 UserProfile.predictionBaselineGlucoseMmol 作为本次预测基线生成 glucoseForecast8h。
4. 如果 UserProfile.activeForecastValid 为 true，且 UserProfile.activeForecastCurrentGlucoseMmol 有值，UserProfile.predictionBaselineGlucoseMmol 应等于上一条 8 小时预测曲线的当前时间节点；此时不要使用上一条预测的 hourOffset=0 旧锚点。
5. 如果 UserProfile.activeForecastValid 不是 true，说明没有有效 8 小时预测；此时不要因为 activeForecastCurrentGlucoseMmol 为空而拒绝预测，也不要使用过期预测曲线的旧锚点，必须改用 UserProfile.predictionBaselineGlucoseMmol。该字段通常来自用户档案空腹基线或 defaultGlucoseMmol。
6. 如果 UserProfile.predictionBaselineGlucoseMmol 为空，才允许回退到 UserProfile.defaultGlucoseMmol；如果 defaultGlucoseMmol 也为空，使用 7.2 mmol/L 作为默认基准。
7. 如果用户只提供新的实测血糖，且上一条 8 小时预测仍有效，可以基于该实测值校准后续曲线。
8. 如果用户只是在闲聊、提问或没有明确健康记录，不要编造数据；isHealthRecord 设为 false，其他未知字段用 null 或空数组。
9. 只抽取用户明确表达或可合理换算的内容，不要臆造食物、热量、步数、睡眠、血糖读数。
10. glucoseForecast8h 表示从“用户当前时间/本次事件时间”开始往后 8 小时的预测。需要预测时必须固定输出 6 个节点，hourOffset 必须依次为 0、1、2、4、6、8；不要只输出到 6 小时，hourOffset=8 是必需节点；hourOffset=0 必须等于本次预测基线。
11. 输出必须是一个 JSON 对象，不要输出 Markdown、解释文字或医学诊断。
12. 血糖单位统一为 mmol/L，数值保留 1 位小数；confidence 取 0 到 1。

风险与预测规则：
- glucoseRiskLevel 使用“低”“中”“高”。
- peakGlucoseMmol 为 glucoseForecast8h 中的最高值。
- peakHourOffset 为最高值对应的 hourOffset。
- returnToBaselineHourOffset 为预计回到或接近基线的小时偏移；无法判断则为 null。
- 没有足够饮食、血糖或活动信息时，不要生成 glucoseForecast8h。
- 一旦生成 glucoseForecast8h，就必须包含完整 8 小时窗口：0、1、2、4、6、8 六个点。
```

## 结构化输出 JSON Schema

可直接放到 Dify 结构化输出节点或 LLM 结构化输出配置中：

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "isHealthRecord",
    "calories",
    "exerciseMinutes",
    "steps",
    "glucoseMmol",
    "sleepHours",
    "mealType",
    "foodName",
    "activityName",
    "glucoseRiskLevel",
    "calibrationApplied",
    "peakGlucoseMmol",
    "peakHourOffset",
    "returnToBaselineHourOffset",
    "glucoseForecast8h",
    "needsFollowup",
    "followupQuestion",
    "confidence",
    "normalizedMessage"
  ],
  "properties": {
    "isHealthRecord": {
      "type": "boolean",
      "description": "用户消息是否包含值得归档的健康记录。"
    },
    "calories": {
      "type": ["integer", "null"],
      "minimum": 0,
      "description": "用户明确提供或可合理估算的热量，单位 kcal。"
    },
    "exerciseMinutes": {
      "type": ["integer", "null"],
      "minimum": 0,
      "description": "运动时长，单位分钟。"
    },
    "steps": {
      "type": ["integer", "null"],
      "minimum": 0,
      "description": "步数。"
    },
    "glucoseMmol": {
      "type": ["number", "null"],
      "minimum": 0,
      "description": "用户本次明确上报的实测血糖，单位 mmol/L；没有明确上报时为 null。"
    },
    "sleepHours": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 24,
      "description": "睡眠时长，单位小时。"
    },
    "mealType": {
      "type": ["string", "null"],
      "enum": ["早餐", "午餐", "晚餐", "加餐", "夜宵", null],
      "description": "餐次。"
    },
    "foodName": {
      "type": ["string", "null"],
      "description": "食物名称或简短饮食描述。"
    },
    "activityName": {
      "type": ["string", "null"],
      "description": "运动或活动名称。"
    },
    "glucoseRiskLevel": {
      "type": ["string", "null"],
      "enum": ["低", "中", "高", null],
      "description": "血糖预测风险等级。"
    },
    "calibrationApplied": {
      "type": ["boolean", "null"],
      "description": "本次预测是否使用了用户新上报的实测血糖进行校准。"
    },
    "peakGlucoseMmol": {
      "type": ["number", "null"],
      "minimum": 0,
      "description": "预测曲线中的最高血糖值，单位 mmol/L。"
    },
    "peakHourOffset": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 8,
      "description": "预测峰值出现的小时偏移。"
    },
    "returnToBaselineHourOffset": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 8,
      "description": "预计回到或接近本次基线的小时偏移；无法判断时为 null。"
    },
    "glucoseForecast8h": {
      "type": "array",
      "description": "从用户当前时间或本次事件时间开始的 8 小时血糖预测；需要预测时必须固定输出 hourOffset 0、1、2、4、6、8 六个节点，hourOffset=0 必须等于本次预测基线，hourOffset=8 必须存在；无法可靠预测时返回空数组。",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["hourOffset", "predictedGlucoseMmol", "pointType"],
        "properties": {
          "hourOffset": {
            "type": "integer",
            "minimum": 0,
            "maximum": 8,
            "description": "距离本次预测起点的小时偏移。"
          },
          "predictedGlucoseMmol": {
            "type": "number",
            "minimum": 0,
            "description": "预测血糖值，单位 mmol/L。"
          },
          "pointType": {
            "type": "string",
            "enum": ["measured_anchor", "active_forecast_current", "forecast"],
            "description": "measured_anchor 表示用户本次实测锚点；active_forecast_current 表示上一条有效预测的当前节点；forecast 表示预测点。"
          }
        }
      }
    },
    "needsFollowup": {
      "type": "boolean",
      "description": "是否需要追问关键信息。"
    },
    "followupQuestion": {
      "type": ["string", "null"],
      "description": "需要追问时给出一句简短问题；否则为 null。"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "本次抽取结果置信度。"
    },
    "normalizedMessage": {
      "type": ["string", "null"],
      "description": "对本次健康事件的简短归一化摘要。"
    }
  }
}
```

## 示例输入上下文

```json
{
  "UserInput": "刚吃了晚饭，一碗米饭和鸡胸肉，没有测血糖",
  "UserProfile": {
    "userTimeZone": "Asia/Shanghai",
    "userCurrentDateTime": "2026-04-26T18:30:05+08:00",
    "currentGlucoseMmol": 7.8,
    "currentGlucoseSource": "active_forecast_current",
    "activeForecastValid": true,
    "activeForecastCurrentGlucoseMmol": 7.8,
    "activeForecastCurrentHourOffset": 2.5,
    "activeForecastStartedAt": "2026-04-26T16:00:00+08:00",
    "activeForecastExpiresAt": "2026-04-27T00:00:00+08:00"
  }
}
```

这个场景下，如果 LLM 需要生成新的 `glucoseForecast8h`，应从 7.8 mmol/L 作为当前基线开始预测，而不是使用上一条预测的 hourOffset=0。

## 无有效 8 小时预测时的输入示例

```json
{
  "UserInput": "晚上吃了碗凉皮，喝了一瓶可乐",
  "UserProfile": {
    "userTimeZone": "Asia/Shanghai",
    "userCurrentDateTime": "2026-04-26T20:10:00+08:00",
    "predictionBaselineGlucoseMmol": 7.2,
    "predictionBaselineSource": "default_baseline",
    "defaultGlucoseMmol": 7.2,
    "currentGlucoseMmol": 7.2,
    "currentGlucoseSource": "default_baseline",
    "activeForecastValid": false,
    "activeForecastCurrentGlucoseMmol": null,
    "activeForecastCurrentHourOffset": null
  }
}
```

这个场景下，虽然没有有效 8 小时预测，也没有用户本次实测血糖，但消息里有明确饮食信息，所以应从 `predictionBaselineGlucoseMmol = 7.2` 开始生成新的 `glucoseForecast8h`。
