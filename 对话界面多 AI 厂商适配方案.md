# 对话界面多 AI 厂商适配方案

要开发一个支持多家 AI 厂商的对话界面，核心挑战是解决不同 API 之间的差异（参数格式、请求方式、响应结构等）。推荐采用「适配器适配层设计模式」，通过抽象统一接口来屏蔽底层差异，既以下是具体实现方案：

### 一、核心架构设计：三层抽象隔离差异

（示意图：通过适配层统一不同 AI 厂商的 API 调用）



1.  **接口层（Interface）**：定义统一的调用接口（如`generate`、`stream`），所有 AI 厂商都需实现这些接口。

2.  **适配层（Adapter）**：为每个 AI 厂商编写专属适配器，负责将统一接口转换为厂商 API 的具体调用。

3.  **业务层（Business）**：直接调用接口层，无需关心底层厂商差异，专注对话逻辑（上下文管理、历史记录等）。

### 二、具体实现步骤

#### 1. 定义统一接口（抽象层）

先抽象出所有 AI 对话的核心能力，用 TypeScript 接口定义规范（JavaScript 可省略类型，用函数参数约定）：



```
// src/ai/interface.ts

export interface AIProvider {

&#x20; // 基础文本生成（非流式）

&#x20; generate(params: GenerateParams): Promise\<GenerateResponse>;

&#x20;&#x20;

&#x20; // 流式生成（实时返回）

&#x20; stream(params: GenerateParams): AsyncGenerator\<StreamChunk>;

&#x20;&#x20;

&#x20; // 获取厂商支持的模型列表

&#x20; getModels(): Promise\<string\[]>;

}

// 统一请求参数

export interface GenerateParams {

&#x20; model: string; // 模型名称（如"gpt-3.5-turbo"、"glm-4"）

&#x20; messages: Message\[]; // 对话历史

&#x20; temperature?: number; // 随机性

&#x20; maxTokens?: number; // 最大 tokens

}

// 消息结构

export interface Message {

&#x20; role: 'user' | 'assistant' | 'system'; // 角色

&#x20; content: string; // 内容

}

// 非流式响应

export interface GenerateResponse {

&#x20; content: string; // 最终回答

&#x20; usage?: { promptTokens: number; completionTokens: number }; // 用量

}

// 流式响应片段

export interface StreamChunk {

&#x20; content: string; // 本次片段内容

&#x20; isDone: boolean; // 是否结束

}
```

#### 2. 实现厂商适配器（适配层）

为每个 AI 厂商编写适配器，实现上述`AIProvider`接口，屏蔽 API 差异。

**示例 1：OpenAI 适配器**



```
// src/ai/adapters/openai.ts

import { AIProvider, GenerateParams, GenerateResponse, StreamChunk } from '../interface';

import OpenAI from 'openai';

export class OpenAIAdapter implements AIProvider {

&#x20; private client: OpenAI;

&#x20; constructor(apiKey: string) {

&#x20;   this.client = new OpenAI({ apiKey });

&#x20; }

&#x20; async generate(params: GenerateParams): Promise\<GenerateResponse> {

&#x20;   const response = await this.client.chat.completions.create({

&#x20;     model: params.model,

&#x20;     messages: params.messages,

&#x20;     temperature: params.temperature,

&#x20;     max\_tokens: params.maxTokens,

&#x20;   });

&#x20;   return {

&#x20;     content: response.choices\[0].message.content || '',

&#x20;     usage: {

&#x20;       promptTokens: response.usage?.prompt\_tokens || 0,

&#x20;       completionTokens: response.usage?.completion\_tokens || 0,

&#x20;     },

&#x20;   };

&#x20; }

&#x20; async \*stream(params: GenerateParams): AsyncGenerator\<StreamChunk> {

&#x20;   const stream = await this.client.chat.completions.create({

&#x20;     ...this.generateParamsToOpenAI(params),

&#x20;     stream: true,

&#x20;   });

&#x20;   for await (const chunk of stream) {

&#x20;     const content = chunk.choices\[0].delta.content || '';

&#x20;     yield { content, isDone: false };

&#x20;   }

&#x20;   yield { content: '', isDone: true }; // 结束标记

&#x20; }

&#x20; async getModels(): Promise\<string\[]> {

&#x20;   const models = await this.client.models.list();

&#x20;   return models.data.map(m => m.id);

&#x20; }

&#x20; // 转换参数格式（统一参数 → OpenAI格式）

&#x20; private generateParamsToOpenAI(params: GenerateParams) {

&#x20;   return {

&#x20;     model: params.model,

&#x20;     messages: params.messages,

&#x20;     temperature: params.temperature,

&#x20;     max\_tokens: params.maxTokens,

&#x20;   };

&#x20; }

}
```

**示例 2：智谱 AI 适配器（API 格式不同）**



```
// src/ai/adapters/zhipu.ts

import { AIProvider, GenerateParams, GenerateResponse, StreamChunk } from '../interface';

import axios from 'axios';

export class ZhipuAdapter implements AIProvider {

&#x20; private apiKey: string;

&#x20; private baseUrl = 'https://open.bigmodel.cn/api/paas/v4/';

&#x20; constructor(apiKey: string) {

&#x20;   this.apiKey = apiKey;

&#x20; }

&#x20; async generate(params: GenerateParams): Promise\<GenerateResponse> {

&#x20;   const response = await axios.post(

&#x20;     \`\${this.baseUrl}chat/completions\`,

&#x20;     {

&#x20;       model: params.model,

&#x20;       messages: params.messages,

&#x20;       temperature: params.temperature,

&#x20;       max\_tokens: params.maxTokens,

&#x20;     },

&#x20;     { headers: { Authorization: \`Bearer \${this.apiKey}\` } }

&#x20;   );

&#x20;   return {

&#x20;     content: response.data.choices\[0].message.content || '',

&#x20;     usage: {

&#x20;       promptTokens: response.data.usage.prompt\_tokens,

&#x20;       completionTokens: response.data.usage.completion\_tokens,

&#x20;     },

&#x20;   };

&#x20; }

&#x20; async \*stream(params: GenerateParams): AsyncGenerator\<StreamChunk> {

&#x20;   const response = await axios.post(

&#x20;     \`\${this.baseUrl}chat/completions\`,

&#x20;     { ...this.generateParamsToZhipu(params), stream: true },

&#x20;     {&#x20;

&#x20;       headers: { Authorization: \`Bearer \${this.apiKey}\` },

&#x20;       responseType: 'stream' // 智谱流式响应需特殊处理

&#x20;     }

&#x20;   );

&#x20;   for await (const chunk of response.data) {

&#x20;     const line = chunk.toString().replace('data: ', '');

&#x20;     if (line === '\[DONE]') {

&#x20;       yield { content: '', isDone: true };

&#x20;       break;

&#x20;     }

&#x20;     const data = JSON.parse(line);

&#x20;     yield {&#x20;

&#x20;       content: data.choices\[0].delta.content || '',&#x20;

&#x20;       isDone: false&#x20;

&#x20;     };

&#x20;   }

&#x20; }

&#x20; async getModels(): Promise\<string\[]> {

&#x20;   const response = await axios.get(\`\${this.baseUrl}models\`, {

&#x20;     headers: { Authorization: \`Bearer \${this.apiKey}\` }

&#x20;   });

&#x20;   return response.data.data.map((m: any) => m.id);

&#x20; }

&#x20; private generateParamsToZhipu(params: GenerateParams) {

&#x20;   return {

&#x20;     model: params.model,

&#x20;     messages: params.messages,

&#x20;     temperature: params.temperature,

&#x20;     max\_tokens: params.maxTokens,

&#x20;   };

&#x20; }

}
```

#### 3. 创建工厂类（管理适配器）

用工厂模式统一创建适配器，方便业务层调用：



```
// src/ai/providerFactory.ts

import { AIProvider } from './interface';

import { OpenAIAdapter } from './adapters/openai';

import { ZhipuAdapter } from './adapters/zhipu';

export type ProviderType = 'openai' | 'zhipu' | 'anthropic'; // 支持的厂商

export class ProviderFactory {

&#x20; static createProvider(

&#x20;   type: ProviderType,

&#x20;   apiKey: string

&#x20; ): AIProvider {

&#x20;   switch (type) {

&#x20;     case 'openai':

&#x20;       return new OpenAIAdapter(apiKey);

&#x20;     case 'zhipu':

&#x20;       return new ZhipuAdapter(apiKey);

&#x20;     // 新增厂商时只需添加case

&#x20;     default:

&#x20;       throw new Error(\`不支持的AI厂商: \${type}\`);

&#x20;   }

&#x20; }

}
```

#### 4. 业务层调用（无需关心厂商差异）

在对话界面的业务逻辑中，直接使用统一接口：



```
// src/services/chatService.ts

import { ProviderFactory, ProviderType } from '../ai/providerFactory';

import { GenerateParams } from '../ai/interface';

export class ChatService {

&#x20; private provider;

&#x20; constructor(providerType: ProviderType, apiKey: string) {

&#x20;   this.provider = ProviderFactory.createProvider(providerType, apiKey);

&#x20; }

&#x20; // 发送消息（支持流式）

&#x20; async \*sendMessage(params: GenerateParams) {

&#x20;   try {

&#x20;     // 调用统一的stream方法，底层自动适配厂商

&#x20;     for await (const chunk of this.provider.stream(params)) {

&#x20;       yield { type: 'success', data: chunk };

&#x20;     }

&#x20;   } catch (error) {

&#x20;     yield { type: 'error', message: (error as Error).message };

&#x20;   }

&#x20; }

&#x20; // 获取当前厂商支持的模型

&#x20; async getAvailableModels() {

&#x20;   return this.provider.getModels();

&#x20; }

}
```

### 三、前端界面集成

界面层只需调用`ChatService`，无需感知底层厂商：



```
// 示例：React组件中使用

import { useState } from 'react';

import { ChatService } from './services/chatService';

function ChatInterface() {

&#x20; const \[messages, setMessages] = useState(\[]);

&#x20; const \[currentProvider, setCurrentProvider] = useState('openai');

&#x20; const \[apiKey, setApiKey] = useState('');

&#x20; const send = async (userInput) => {

&#x20;   // 添加用户消息

&#x20;   const newMessages = \[...messages, { role: 'user', content: userInput }];

&#x20;   setMessages(newMessages);

&#x20;   // 创建服务实例（根据当前选择的厂商）

&#x20;   const chatService = new ChatService(

&#x20;     currentProvider as any,

&#x20;     apiKey

&#x20;   );

&#x20;   // 调用统一接口发送消息

&#x20;   let assistantMessage = '';

&#x20;   for await (const chunk of chatService.sendMessage({

&#x20;     model: 'gpt-3.5-turbo', // 或当前厂商的模型

&#x20;     messages: newMessages,

&#x20;     temperature: 0.7

&#x20;   })) {

&#x20;     if (chunk.type === 'success') {

&#x20;       assistantMessage += chunk.data.content;

&#x20;       // 更新界面

&#x20;       setMessages(\[...newMessages, { role: 'assistant', content: assistantMessage }]);

&#x20;     }

&#x20;   }

&#x20; };

&#x20; return (

&#x20;   \<div>

&#x20;     \<select onChange={(e) => setCurrentProvider(e.target.value)}>

&#x20;       \<option value="openai">OpenAI\</option>

&#x20;       \<option value="zhipu">智谱AI\</option>

&#x20;     \</select>

&#x20;     \<input&#x20;

&#x20;       type="password"&#x20;

&#x20;       placeholder="API Key"&#x20;

&#x20;       value={apiKey}

&#x20;       onChange={(e) => setApiKey(e.target.value)}

&#x20;     />

&#x20;     {/\* 消息列表和输入框 \*/}

&#x20;   \</div>

&#x20; );

}
```

### 四、扩展新厂商的流程

当需要支持新厂商（如 Anthropic、Google Gemini）时，只需：



1.  新建适配器类（`AnthropicAdapter`），实现`AIProvider`接口；

2.  在`ProviderFactory`中添加对应的 case；

3.  前端界面的厂商选择列表中新增选项。

无需修改业务逻辑和界面代码，完全符合「开闭原则」。

### 五、关键优化建议



1.  **参数映射表**：对厂商特有参数（如 OpenAI 的`top_p`、智谱的`penalty_score`），可维护一份映射表动态处理；

2.  **错误统一处理**：在适配器中捕获厂商特定错误（如 APIKey 无效、模型不存在），转换为统一错误类型；

3.  **缓存模型列表**：厂商支持的模型列表无需每次请求，可本地缓存并定期更新；

4.  **使用环境变量**：生产环境中通过后端代理 APIKey，避免前端直接暴露（适配器改为调用后端接口）。

通过这种设计，既能灵活支持多家 AI 厂商，又能保证代码的可维护性，后续扩展新厂商时成本极低。核心思想是「抽象共性，隔离差异」，这也是应对多 API 兼容的经典解决方案。

> （注：文档部分内容可能由 AI 生成）