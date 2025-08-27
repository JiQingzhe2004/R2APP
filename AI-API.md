# 豆包AI API 响应结构文档

## 豆包JSON响应结构（正式内容）

```json
{
    "choices": [
        {
            "delta": {
                "content": "你",
                "role": "assistant"
            },
            "index": 0
        }
    ],
    "created": 1756296609,
    "id": "02175629660837492ca7851aedaeaba2fdb382706a0bc6e427ce3",
    "model": "doubao-seed-1-6-250615",
    "service_tier": "default",
    "object": "chat.completion.chunk",
    "usage": null
}
```

## 字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `choices` | 数组 | 包含生成的响应选项列表，通常包含一个选项 |
| `choices[].delta` | 对象 | 增量更新信息，包含模型生成的内容和元数据 |
| `choices[].delta.content` | 字符串 | 模型生成的实际回复内容文本 |
| `choices[].delta.role` | 字符串 | 角色标识，表示内容由谁生成，通常为"assistant"表示助手回复 |
| `choices[].index` | 整数 | 选项索引，从0开始，标识当前是第几个响应选项 |
| `created` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `model` | 字符串 | 生成响应所使用的模型标识符，如示例中的"doubao-seed-1-6-250615" |
| `service_tier` | 字符串 | 服务等级，标识API调用使用的服务级别，如"default"表示默认级别 |
| `object` | 字符串 | 对象类型，标识响应的类型，"chat.completion.chunk"表示聊天完成的增量响应 |
| `usage` | 对象或null | 包含API调用的使用统计信息，如token消耗等，null表示未提供此信息 |

## 说明

正式内容的响应结构中不包含`reasoning_content`字段，这个字段通常只出现在思考链的响应中。正式内容响应直接包含模型生成的实际回复文本在`content`字段中。


## 智谱清言思考链响应结构

```json
{
    "id": "20250827201751193fbe441ebf4445",
    "created": 1756297071,
    "model": "glm-4.5-flash",
    "choices": [
        {
            "index": 0,
            "delta": {
                "role": "assistant",
                "reasoning_content": "嗯"
            }
        }
    ]
}
```

## 智谱清言字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `created` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `model` | 字符串 | 生成响应所使用的模型标识符，如示例中的"glm-4.5-flash" |
| `choices` | 数组 | 包含生成的响应选项列表，通常包含一个选项 |
| `choices[].index` | 整数 | 选项索引，从0开始，标识当前是第几个响应选项 |
| `choices[].delta` | 对象 | 增量更新信息，包含模型生成的内容和元数据 |
| `choices[].delta.role` | 字符串 | 角色标识，表示内容由谁生成，通常为"assistant"表示助手回复 |
| `choices[].delta.reasoning_content` | 字符串 | 模型内部的推理过程内容，用于展示模型的思考过程 |

## 智谱清言与豆包响应结构对比

1. **字段差异**：智谱清言的思考链响应结构中，在`delta`对象中包含`reasoning_content`字段，而缺少`content`字段，这与豆包的思考链响应结构类似。
2. **共有字段**：两者都包含`id`、`created`、`model`、`choices`等核心字段。
3. **字段顺序**：智谱清言和豆包的响应结构中字段顺序有所不同，但这不影响数据的解析和使用。


## 智谱清言正式内容响应结构

```json
{
    "id": "20250827201751193fbe441ebf4445",
    "created": 1756297071,
    "model": "glm-4.5-flash",
    "choices": [
        {
            "index": 0,
            "delta": {
                "role": "assistant",
                "content": "什么"
            }
        }
    ]
}
```

## 智谱清言正式内容与思考链响应结构区别

1. **字段内容差异**：
   - 正式内容响应中，`delta`对象包含`content`字段，用于存储模型生成的实际回复文本
   - 思考链响应中，`delta`对象包含`reasoning_content`字段，用于存储模型的内部推理过程

2. **用途不同**：
   - 正式内容响应用于向用户展示最终的AI回复
   - 思考链响应主要用于调试或展示模型的思考过程，通常不会直接展示给用户

3. **结构相似性**：
   - 两种响应类型的整体结构保持一致，都包含`id`、`created`、`model`、`choices`等核心字段
   - 差异主要体现在`delta`对象内部包含的具体字段上


## DeepSeek思考链响应结构

```json
{
    "id": "548226a2-d11a-4cc1-a54d-21560af54a66",
    "object": "chat.completion.chunk",
    "created": 1756297435,
    "model": "deepseek-reasoner",
    "system_fingerprint": "fp_feb633d1f5_prod0820_fp8_kvcache",
    "choices": [
        {
            "index": 0,
            "delta": {
                "content": null,
                "reasoning_content": "嗯"
            },
            "logprobs": null,
            "finish_reason": null
        }
    ]
}
```

## DeepSeek字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `object` | 字符串 | 对象类型，标识响应的类型，"chat.completion.chunk"表示聊天完成的增量响应 |
| `created` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `model` | 字符串 | 生成响应所使用的模型标识符，如示例中的"deepseek-reasoner" |
| `system_fingerprint` | 字符串 | 系统指纹，用于标识模型版本和配置信息 |
| `choices` | 数组 | 包含生成的响应选项列表，通常包含一个选项 |
| `choices[].index` | 整数 | 选项索引，从0开始，标识当前是第几个响应选项 |
| `choices[].delta` | 对象 | 增量更新信息，包含模型生成的内容和元数据 |
| `choices[].delta.content` | 字符串或null | 模型生成的实际回复内容文本，在思考链响应中可能为null，在正式内容响应中为字符串 |
| `choices[].delta.reasoning_content` | 字符串或null | 模型内部的推理过程内容，用于展示模型的思考过程，在正式内容响应中通常为null |
| `choices[].logprobs` | 对象或null | 包含生成内容的对数概率信息，null表示未提供此信息 |
| `choices[].finish_reason` | 字符串或null | 表示生成结束的原因，null表示生成尚未完成 |


## DeepSeek正式内容响应结构

```json
{
    "id": "548226a2-d11a-4cc1-a54d-21560af54a66",
    "object": "chat.completion.chunk",
    "created": 1756297435,
    "model": "deepseek-reasoner",
    "system_fingerprint": "fp_feb633d1f5_prod0820_fp8_kvcache",
    "choices": [
        {
            "index": 0,
            "delta": {
                "content": "吗",
                "reasoning_content": null
            },
            "logprobs": null,
            "finish_reason": null
        }
    ]
}
```

## DeepSeek正式内容与思考链响应结构区别

1. **字段内容差异**：
   - 正式内容响应中，`delta`对象的`content`字段为字符串，表示模型生成的实际回复文本
   - 思考链响应中，`delta`对象的`content`字段可能为null
   - 正式内容响应中，`delta`对象的`reasoning_content`字段通常为null
   - 思考链响应中，`delta`对象的`reasoning_content`字段为字符串，表示模型的内部推理过程

2. **用途不同**：
   - 正式内容响应用于向用户展示最终的AI回复
   - 思考链响应主要用于调试或展示模型的思考过程，通常不会直接展示给用户

3. **结构相似性**：
   - 两种响应类型的整体结构保持一致，都包含`id`、`object`、`created`、`model`、`system_fingerprint`、`choices`等核心字段
   - 差异主要体现在`delta`对象内部包含的具体字段值上


## DeepSeek与其他模型响应结构对比

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created`、`model`、`choices`等核心字段
   - 不同点：DeepSeek包含额外的`system_fingerprint`、`logprobs`和`finish_reason`字段

2. **与智谱清言的对比**：
   - 相同点：两者都在思考链响应中包含`reasoning_content`字段
   - 不同点：DeepSeek的思考链响应中`content`字段可能为null，而智谱清言通常不包含`content`字段
   - DeepSeek包含`system_fingerprint`、`logprobs`和`finish_reason`等额外字段

3. **字段顺序**：
   - 不同模型的响应结构中字段顺序可能有所不同，但这不影响数据的解析和使用
   - DeepSeek的响应结构中`object`字段位于`id`之后，而豆包和智谱清言中没有这个字段


## 通义千问思考链响应结构

```json
{
    "choices": [
        {
            "finish_reason": null,
            "logprobs": null,
            "delta": {
                "content": null,
                "reasoning_content": "好的，用户"
            },
            "index": 0
        }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1756297638,
    "system_fingerprint": null,
    "model": "qwen-plus-2025-04-28",
    "id": "chatcmpl-ffe7ff4f-82e8-9508-bb9b-d47ef848fce6"
}
```

## 通义千问字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `object` | 字符串 | 对象类型，标识响应的类型，"chat.completion.chunk"表示聊天完成的增量响应 |
| `created` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `model` | 字符串 | 生成响应所使用的模型标识符，如示例中的"qwen-plus-2025-04-28" |
| `system_fingerprint` | 字符串或null | 系统指纹，用于标识模型版本和配置信息，可能为null |
| `choices` | 数组 | 包含生成的响应选项列表，通常包含一个选项 |
| `choices[].index` | 整数 | 选项索引，从0开始，标识当前是第几个响应选项 |
| `choices[].delta` | 对象 | 增量更新信息，包含模型生成的内容和元数据 |
| `choices[].delta.content` | 字符串或null | 模型生成的实际回复内容文本，在思考链响应中可能为null |
| `choices[].delta.reasoning_content` | 字符串或null | 模型内部的推理过程内容，用于展示模型的思考过程 |
| `choices[].logprobs` | 对象或null | 包含生成内容的对数概率信息，null表示未提供此信息 |
| `choices[].finish_reason` | 字符串或null | 表示生成结束的原因，null表示生成尚未完成 |
| `usage` | 对象或null | 包含API调用的使用统计信息，如token消耗等，null表示未提供此信息 |


## 通义千问正式内容响应结构

```json
{
    "choices": [
        {
            "delta": {
                "content": "某些话题的观点和",
                "reasoning_content": null
            },
            "finish_reason": null,
            "index": 0,
            "logprobs": null
        }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1756297638,
    "system_fingerprint": null,
    "model": "qwen-plus-2025-04-28",
    "id": "chatcmpl-ffe7ff4f-82e8-9508-bb9b-d47ef848fce6"
}
```

## 通义千问正式内容与思考链响应结构区别

1. **字段内容差异**：
   - 正式内容响应中，`delta`对象的`content`字段为字符串，表示模型生成的实际回复文本
   - 思考链响应中，`delta`对象的`content`字段可能为null
   - 正式内容响应中，`delta`对象的`reasoning_content`字段通常为null
   - 思考链响应中，`delta`对象的`reasoning_content`字段为字符串，表示模型的内部推理过程

2. **用途不同**：
   - 正式内容响应用于向用户展示最终的AI回复
   - 思考链响应主要用于调试或展示模型的思考过程，通常不会直接展示给用户

3. **结构相似性**：
   - 两种响应类型的整体结构保持一致，都包含`id`、`object`、`created`、`model`、`choices`等核心字段
   - 差异主要体现在`delta`对象内部包含的具体字段值上


## 通义千问与其他模型响应结构对比

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created`、`model`、`choices`、`object`等核心字段
   - 不同点：通义千问在思考链响应中包含`reasoning_content`字段，而豆包的正式内容响应中没有这个字段
   - 通义千问包含`logprobs`和`finish_reason`字段，而豆包没有

2. **与智谱清言的对比**：
   - 相同点：两者都在思考链响应中包含`reasoning_content`字段
   - 不同点：通义千问的响应结构中包含`object`、`logprobs`和`finish_reason`字段，而智谱清言没有
   - 通义千问的正式内容响应中`delta`对象包含`content`字段，而智谱清言的正式内容响应中也包含`content`字段

3. **与DeepSeek的对比**：
   - 相同点：两者都包含`id`、`object`、`created`、`model`、`choices`、`logprobs`和`finish_reason`等核心字段
   - 不同点：DeepSeek包含`system_fingerprint`字段，而通义千问的`system_fingerprint`字段可能为null
   - 两者在字段顺序上有所不同，但这不影响数据的解析和使用


## OpenAI响应结构

```json
{
   "id": "resp_68af08d282e4819cb01cbf082c35cc3e02c27b407c56e390",
   "object": "response",
   "created_at": 1756301522,
   "status": "completed",
   "background": false,
   "error": null,
   "incomplete_details": null,
   "instructions": null,
   "max_output_tokens": null,
   "max_tool_calls": null,
   "model": "gpt-5-nano-2025-08-07",
   "output": [
     {
       "id": "rs_68af08d2dea0819c9806281f5df153f402c27b407c56e390",
       "type": "reasoning",
       "summary": []
     },
     {
       "id": "msg_68af08d2ef58819c9f8271ee769f132602c27b407c56e390",
       "type": "message",
       "status": "completed",
       "content": [
         {
           "type": "output_text",
           "annotations": [],
           "logprobs": [],
           "text": "你好"
         }
       ],
       "role": "assistant"
     }
   ],
   "parallel_tool_calls": true,
   "previous_response_id": null,
   "prompt_cache_key": null,
   "reasoning": {
     "effort": "minimal",
     "summary": null
   },
   "safety_identifier": null,
   "service_tier": "default",
   "store": true,
   "temperature": 1.0,
   "text": {
     "format": {
       "type": "text"
     },
     "verbosity": "medium"
   },
   "tool_choice": "auto",
   "tools": [],
   "top_logprobs": 0,
   "top_p": 1.0,
   "truncation": "disabled",
   "usage": {
     "input_tokens": 10,
     "input_tokens_details": {
       "cached_tokens": 0
     },
     "output_tokens": 155,
     "output_tokens_details": {
       "reasoning_tokens": 0
     },
     "total_tokens": 165
   },
   "user": null,
   "metadata": {}
}
```

## OpenAI字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `object` | 字符串 | 对象类型，标识响应的类型，"response"表示这是一个完整的响应对象 |
| `created_at` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `status` | 字符串 | 响应的状态，表示API调用是否完成，"completed"表示已完成 |
| `background` | 布尔值 | 指示响应是否在后台生成，false表示不在后台生成 |
| `error` | 对象或null | 包含错误信息，如果API调用失败，否则为null |
| `incomplete_details` | 对象或null | 包含响应未完成的详细信息，如未完成原因等，null表示响应已完成 |
| `instructions` | 对象或null | 包含用于生成响应的指令信息，null表示未提供额外指令 |
| `max_output_tokens` | 整数或null | 限制输出token数量的最大值，null表示使用默认值 |
| `max_tool_calls` | 整数或null | 限制工具调用次数的最大值，null表示使用默认值 |
| `model` | 字符串 | 生成响应所使用的模型标识符，如示例中的"gpt-5-nano-2025-08-07" |
| `output` | 数组 | 包含生成的输出内容列表，可能包含推理过程和最终回复 |
| `output[].id` | 字符串 | 输出项的唯一标识符 |
| `output[].type` | 字符串 | 输出项的类型，"reasoning"表示推理过程，"message"表示最终回复 |
| `output[].summary` | 数组 | 推理过程的摘要信息，可能为空数组 |
| `output[].status` | 字符串 | 输出项的状态，"completed"表示已完成 |
| `output[].content` | 数组 | 输出项的内容列表，包含实际的文本内容 |
| `output[].content[].type` | 字符串 | 内容项的类型，"output_text"表示输出文本 |
| `output[].content[].annotations` | 数组 | 内容项的注释信息，可能为空数组 |
| `output[].content[].logprobs` | 数组 | 内容项的对数概率信息，可能为空数组 |
| `output[].content[].text` | 字符串 | 实际的文本内容 |
| `output[].role` | 字符串 | 角色标识，表示内容由谁生成，"assistant"表示助手回复 |
| `parallel_tool_calls` | 布尔值 | 指示是否允许并行工具调用，true表示允许 |
| `previous_response_id` | 字符串或null | 前一个响应的标识符，用于会话历史引用，null表示没有前一个响应 |
| `prompt_cache_key` | 字符串或null | 提示缓存的键值，用于优化性能，null表示未使用缓存 |
| `reasoning` | 对象 | 包含推理相关的信息 |
| `reasoning.effort` | 字符串 | 推理的努力程度，"minimal"表示最小努力 |
| `reasoning.summary` | 对象或null | 推理的摘要信息，null表示没有摘要 |
| `safety_identifier` | 字符串或null | 安全标识符，用于内容安全检查，null表示未提供 |
| `service_tier` | 字符串 | 服务等级，标识API调用使用的服务级别，如"default"表示默认级别 |
| `store` | 布尔值 | 指示是否存储响应，true表示存储 |
| `temperature` | 浮点数 | 控制响应的随机性，值越高表示越随机，1.0为默认值 |
| `text` | 对象 | 包含文本生成相关的配置 |
| `text.format` | 对象 | 文本格式配置 |
| `text.format.type` | 字符串 | 文本格式类型，"text"表示纯文本格式 |
| `text.verbosity` | 字符串 | 文本详细程度，"medium"表示中等详细程度 |
| `tool_choice` | 字符串 | 工具选择策略，"auto"表示自动选择 |
| `tools` | 数组 | 可用的工具列表，可能为空数组 |
| `top_logprobs` | 整数 | 返回的最高对数概率数量，0表示不返回 |
| `top_p` | 浮点数 | 核采样参数，控制响应的多样性，1.0为默认值 |
| `truncation` | 字符串 | 截断策略，"disabled"表示禁用截断 |
| `usage` | 对象 | 包含API调用的使用统计信息 |
| `usage.input_tokens` | 整数 | 输入的token数量 |
| `usage.input_tokens_details` | 对象 | 输入token的详细信息 |
| `usage.input_tokens_details.cached_tokens` | 整数 | 缓存的token数量 |
| `usage.output_tokens` | 整数 | 输出的token数量 |
| `usage.output_tokens_details` | 对象 | 输出token的详细信息 |
| `usage.output_tokens_details.reasoning_tokens` | 整数 | 推理相关的token数量 |
| `usage.total_tokens` | 整数 | 总共使用的token数量 |
| `user` | 对象或null | 用户信息，null表示未提供 |
| `metadata` | 对象 | 包含额外的元数据信息 |


## OpenAI与其他模型响应结构对比

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created_at`（豆包中为`created`）、`model`等核心字段
   - 不同点：OpenAI的响应结构更为复杂，包含更多的配置和元数据字段
   - OpenAI将输出内容放在`output`数组中，而豆包将内容放在`choices`数组中
   - OpenAI包含`reasoning`字段，用于存储推理相关信息，而豆包没有类似字段

2. **与智谱清言的对比**：
   - 相同点：两者都包含`id`、`model`等核心字段
   - 不同点：OpenAI的响应结构更为复杂，包含更多的配置和元数据字段
   - 智谱清言在`delta`对象中包含`reasoning_content`字段，而OpenAI在`output`数组中包含`type`为"reasoning"的项
   - OpenAI包含`temperature`、`top_p`等控制生成参数的字段，而智谱清言没有

3. **与DeepSeek和通义千问的对比**：
   - 相同点：四者都包含`id`、`model`、`created_at`（或`created`）等核心字段
   - 不同点：OpenAI的响应结构更为复杂，包含更多的配置和元数据字段
   - DeepSeek和通义千问在`delta`对象中包含`reasoning_content`字段，而OpenAI在`output`数组中包含`type`为"reasoning"的项
   - OpenAI包含更多的控制生成参数的字段，如`temperature`、`top_p`等

4. **字段结构差异**：
   - OpenAI的响应结构采用层级化设计，将不同类型的输出（推理过程和最终回复）分开存储
   - 其他模型通常采用扁平化设计，将所有信息直接放在响应对象中
   - OpenAI的`usage`字段包含更详细的token使用统计信息

5. **独特字段**：
   - OpenAI包含`reasoning`、`temperature`、`top_p`、`parallel_tool_calls`等独特字段
   - 这些字段提供了对模型生成过程更精细的控制和更详细的监控

通过对比可以看出，OpenAI的响应结构最为复杂，提供了更多的配置选项和详细的使用统计信息，而其他模型的响应结构相对简洁，但核心功能基本一致。


## 讯飞星火思考链响应结构

```json
{
     "code": 0,
     "message": "Success",
     "sid": "cha000d580d@dx198042ba077b808322",
     "id": "cha000d580d@dx198042ba077b808322",
     "created": 1752416625,
     "choices": [
         {
             "delta": {
                 "role": "assistant",
                 "reasoning_content": "好的，用户"
             },
             "index": 0
         }
     ]
}
```

## 讯飞星火字段解释

| 字段名 | 类型 | 说明 |
|-------|------|------|
| `code` | 整数 | 响应状态码，0表示成功 |
| `message` | 字符串 | 响应消息，描述请求结果 |
| `sid` | 字符串 | 会话ID，用于标识特定的对话会话 |
| `id` | 字符串 | 响应的唯一标识符，用于追踪和引用特定的API调用结果 |
| `created` | 整数 | 响应创建的时间戳，使用Unix时间格式（秒级） |
| `choices` | 数组 | 包含生成的响应选项列表，通常包含一个选项 |
| `choices[].index` | 整数 | 选项索引，从0开始，标识当前是第几个响应选项 |
| `choices[].delta` | 对象 | 增量更新信息，包含模型生成的内容和元数据 |
| `choices[].delta.role` | 字符串 | 角色标识，表示内容由谁生成，通常为"assistant"表示助手回复 |
| `choices[].delta.reasoning_content` | 字符串 | 模型内部的推理过程内容，用于展示模型的思考过程 |


## 讯飞星火正式内容响应结构

以下是讯飞星火正式内容的响应结构：

```json
{
     "code": 0,
     "message": "Success",
     "sid": "cha000d580d@dx198042ba077b808322",
     "id": "cha000d580d@dx198042ba077b808322",
     "created": 1752416634,
     "choices": [
         {
             "delta": {
                 "role": "assistant",
                 "content": "你好！我是深度"
             },
             "index": 0
         }
     ]
}
```

## 讯飞星火正式内容与思考链响应结构区别

1. **字段内容差异**：
   - 正式内容响应中，`delta`对象可能包含`content`字段，表示模型生成的实际回复文本
   - 思考链响应中，`delta`对象包含`reasoning_content`字段，表示模型的内部推理过程

2. **用途不同**：
   - 正式内容响应用于向用户展示最终的AI回复
   - 思考链响应主要用于调试或展示模型的思考过程，通常不会直接展示给用户

3. **结构相似性**：
   - 两种响应类型的整体结构保持一致，都包含`code`、`message`、`sid`、`id`、`created`、`choices`等核心字段
   - 差异主要体现在`delta`对象内部包含的具体字段上


## 讯飞星火与其他模型响应结构对比

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created`、`model`（讯飞星火中未明确显示）、`choices`等核心字段
   - 不同点：讯飞星火包含额外的`code`、`message`、`sid`字段
   - 豆包的响应结构中没有`reasoning_content`字段，而讯飞星火的思考链响应中包含该字段

2. **与智谱清言的对比**：
   - 相同点：两者都在思考链响应中包含`reasoning_content`字段
   - 不同点：讯飞星火的响应结构中包含`code`、`message`、`sid`字段，而智谱清言没有
   - 智谱清言的响应结构更为简洁，字段数量较少

3. **与DeepSeek和通义千问的对比**：
   - 相同点：四者都包含`id`、`created`、`choices`等核心字段
   - 不同点：讯飞星火包含`code`、`message`、`sid`独特字段
   - DeepSeek和通义千问的响应结构中包含`object`、`logprobs`和`finish_reason`字段，而讯飞星火没有

4. **与OpenAI的对比**：
   - 相同点：两者都包含`id`、`created`（OpenAI中为`created_at`）、`choices`等核心字段
   - 不同点：OpenAI的响应结构更为复杂，包含更多的配置和元数据字段
   - 讯飞星火的响应结构更为简洁，包含`code`、`message`、`sid`等状态相关字段
   - OpenAI将输出内容放在`output`数组中，而讯飞星火将内容放在`choices`数组中

通过对比可以看出，讯飞星火的响应结构具有独特的`code`、`message`和`sid`字段，整体结构相对简洁，同时在思考链响应中包含`reasoning_content`字段，与其他模型既有相似性又有独特性。

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created`、`model`、`choices`、`object`等核心字段
   - 不同点：通义千问在思考链响应中包含`reasoning_content`字段，而豆包的正式内容响应中没有这个字段
   - 通义千问包含`logprobs`和`finish_reason`字段，而豆包没有

2. **与智谱清言的对比**：
   - 相同点：两者都在思考链响应中包含`reasoning_content`字段
   - 不同点：通义千问的响应结构中包含`object`、`logprobs`和`finish_reason`字段，而智谱清言没有
   - 通义千问的正式内容响应中`delta`对象包含`content`字段，而智谱清言的正式内容响应中也包含`content`字段

3. **与DeepSeek的对比**：
   - 相同点：两者都包含`id`、`object`、`created`、`model`、`choices`、`logprobs`和`finish_reason`等核心字段
   - 不同点：DeepSeek包含`system_fingerprint`字段，而通义千问的`system_fingerprint`字段可能为null
   - 两者在字段顺序上有所不同，但这不影响数据的解析和使用

1. **与豆包的对比**：
   - 相同点：两者都包含`id`、`created`、`model`、`choices`等核心字段
   - 不同点：DeepSeek包含额外的`system_fingerprint`、`logprobs`和`finish_reason`字段

2. **与智谱清言的对比**：
   - 相同点：两者都在思考链响应中包含`reasoning_content`字段
   - 不同点：DeepSeek的思考链响应中`content`字段可能为null，而智谱清言通常不包含`content`字段
   - DeepSeek包含`system_fingerprint`、`logprobs`和`finish_reason`等额外字段

3. **字段顺序**：
   - 不同模型的响应结构中字段顺序可能有所不同，但这不影响数据的解析和使用
   - DeepSeek的响应结构中`object`字段位于`id`之后，而豆包和智谱清言中没有这个字段