# 豆包的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/v3/chat/completions:
    post:
      summary: 豆包的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{ARK_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
              x-apifox-orders: []
            example:
              model: doubao-seed-1-6-250615
              messages:
                - role: system
                  content: 你是人工智能助手.
                - role: user
                  content: 你好
              stream: true
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  choices:
                    type: array
                    items:
                      type: object
                      properties:
                        finish_reason:
                          type: string
                        index:
                          type: integer
                        logprobs:
                          type: 'null'
                        message:
                          type: object
                          properties:
                            content:
                              type: string
                            reasoning_content:
                              type: string
                            role:
                              type: string
                          required:
                            - content
                            - reasoning_content
                            - role
                          x-apifox-orders:
                            - content
                            - reasoning_content
                            - role
                      x-apifox-orders:
                        - finish_reason
                        - index
                        - logprobs
                        - message
                  created:
                    type: integer
                  id:
                    type: string
                  model:
                    type: string
                  service_tier:
                    type: string
                  object:
                    type: string
                  usage:
                    type: object
                    properties:
                      completion_tokens:
                        type: integer
                      prompt_tokens:
                        type: integer
                      total_tokens:
                        type: integer
                      prompt_tokens_details:
                        type: object
                        properties:
                          cached_tokens:
                            type: integer
                        required:
                          - cached_tokens
                        x-apifox-orders:
                          - cached_tokens
                      completion_tokens_details:
                        type: object
                        properties:
                          reasoning_tokens:
                            type: integer
                        required:
                          - reasoning_tokens
                        x-apifox-orders:
                          - reasoning_tokens
                    required:
                      - completion_tokens
                      - prompt_tokens
                      - total_tokens
                      - prompt_tokens_details
                      - completion_tokens_details
                    x-apifox-orders:
                      - completion_tokens
                      - prompt_tokens
                      - total_tokens
                      - prompt_tokens_details
                      - completion_tokens_details
                required:
                  - choices
                  - created
                  - id
                  - model
                  - service_tier
                  - object
                  - usage
                x-apifox-orders:
                  - choices
                  - created
                  - id
                  - model
                  - service_tier
                  - object
                  - usage
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321095287-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```


# 智谱清言的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/paas/v4/chat/completions:
    post:
      summary: 智谱清言的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{Zhipu_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
              x-apifox-orders: []
            example:
              model: glm-4.5-flash
              messages:
                - role: user
                  content: 你好
              stream: true
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  choices:
                    type: array
                    items:
                      type: object
                      properties:
                        finish_reason:
                          type: string
                        index:
                          type: integer
                        message:
                          type: object
                          properties:
                            content:
                              type: string
                            role:
                              type: string
                          required:
                            - content
                            - role
                          x-apifox-orders:
                            - content
                            - role
                      x-apifox-orders:
                        - finish_reason
                        - index
                        - message
                  created:
                    type: integer
                  id:
                    type: string
                  model:
                    type: string
                  request_id:
                    type: string
                  usage:
                    type: object
                    properties:
                      completion_tokens:
                        type: integer
                      prompt_tokens:
                        type: integer
                      total_tokens:
                        type: integer
                    required:
                      - completion_tokens
                      - prompt_tokens
                      - total_tokens
                    x-apifox-orders:
                      - completion_tokens
                      - prompt_tokens
                      - total_tokens
                required:
                  - choices
                  - created
                  - id
                  - model
                  - request_id
                  - usage
                x-apifox-orders:
                  - choices
                  - created
                  - id
                  - model
                  - request_id
                  - usage
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321095289-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```

# Deepseek的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/chat/completions:
    post:
      summary: Deepseek的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: ' Bearer {{DeepSeek_API_KEY}}'
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
              x-apifox-orders: []
            example:
              model: deepseek-chat
              messages:
                - role: system
                  content: You are a helpful assistant.
                - role: user
                  content: Hello!
              stream: false
      responses:
        '401':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: object
                    properties:
                      message:
                        type: string
                      type:
                        type: string
                      param:
                        type: 'null'
                      code:
                        type: string
                    required:
                      - message
                      - type
                      - param
                      - code
                    x-apifox-orders:
                      - message
                      - type
                      - param
                      - code
                required:
                  - error
                x-apifox-orders:
                  - error
          headers: {}
          x-apifox-name: 没有权限
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321095288-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```

# 通义千问的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /compatible-mode/v1/chat/completions:
    post:
      summary: 通义千问的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{QWEN_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                model:
                  type: string
                  title: 模型
                messages:
                  type: array
                  items:
                    type: object
                    properties:
                      role:
                        type: string
                      content:
                        type: string
                    required:
                      - role
                      - content
                    x-apifox-orders:
                      - role
                      - content
                  title: 信息
                stream:
                  type: boolean
                  title: 流式输出
                  default: false
                  nullable: true
              required:
                - model
                - messages
              x-apifox-orders:
                - model
                - messages
                - stream
            example:
              model: qwen-plus-2025-04-28
              messages:
                - role: user
                  content: 你是谁/no_think
              stream: true
              stream_options:
                include_usage: true
              enable_thinking: true
      responses:
        '200':
          description: ''
          content:
            text/event-stream:
              schema:
                type: object
                properties: {}
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321097522-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```

# 谷歌的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1beta/openai/chat/completions:
    post:
      summary: 谷歌的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: true
          example: Bearer {{GMINI_API_AKY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                model:
                  type: string
                messages:
                  type: array
                  items:
                    type: object
                    properties:
                      role:
                        type: string
                      content:
                        type: string
                stream:
                  type: boolean
                extra_body:
                  type: object
                  properties:
                    google:
                      type: object
                      properties:
                        thinking_config:
                          type: object
                          properties:
                            include_thoughts:
                              type: boolean
                          required:
                            - include_thoughts
                      required:
                        - thinking_config
                  required:
                    - google
              required:
                - model
                - messages
                - stream
                - extra_body
            example:
              model: gemini-2.5-flash
              messages:
                - role: user
                  content: 你好
              stream: true
              extra_body:
                google:
                  thinking_config:
                    include_thoughts: true
      responses:
        '200':
          description: ''
          content:
            text/event-stream:
              schema:
                type: object
                properties: {}
              example: >+
                data: {"choices":[{"delta":{"content":"<thought>**Defining the
                Greeting**\n\nI've determined the input, \"你好,\" is a basic
                greeting. I've analyzed its context as the commencement of a
                dialogue, which dictates a polite response is needed. My next
                step will be selecting a suitable reply to continue the
                conversation.\n\n\n","extra_content":{"google":{"thought":true}},"role":"assistant"},"index":0}],"created":1752319190,"id":"1URyaLjuGKiqmtkPj86KuAI","model":"gemini-2.5-flash","object":"chat.completion.chunk"}


                data: {"choices":[{"delta":{"content":"**Selecting a
                Response**\n\nI've decided \"你好！\" is the direct and suitable
                answer. I'm now exploring how to smoothly transition the
                response into offering assistance, considering phrases like
                \"很高兴能帮助你\" for a welcoming tone. I'm also planning to be more
                proactive in offering help and guiding the
                dialogue.\n\n\n","extra_content":{"google":{"thought":true}},"role":"assistant"},"index":0}],"created":1752319191,"id":"1URyaLjuGKiqmtkPj86KuAI","model":"gemini-2.5-flash","object":"chat.completion.chunk"}


                data: {"choices":[{"delta":{"content":"**Finalizing the
                Greeting**\n\nI've refined the response to \"你好！有什么我可以帮助你的吗？\"
                after considering various options. This is direct yet friendly,
                transitioning smoothly to offering assistance. I believe this
                balanced approach sets a positive tone for user interaction and
                encourages further communication. I'm now ready to proceed based
                on this finalized
                opening.\n\n\n","extra_content":{"google":{"thought":true}},"role":"assistant"},"index":0}],"created":1752319193,"id":"1URyaLjuGKiqmtkPj86KuAI","model":"gemini-2.5-flash","object":"chat.completion.chunk"}


                data:
                {"choices":[{"delta":{"content":"</thought>你好！有什么我可以帮助你的吗？","role":"assistant"},"finish_reason":"stop","index":0}],"created":1752319193,"id":"1URyaLjuGKiqmtkPj86KuAI","model":"gemini-2.5-flash","object":"chat.completion.chunk"}


                data: [DONE]

          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321219425-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```

# 讯飞星火

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v2/chat/completions:
    post:
      summary: 讯飞星火
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{XUNFEI_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
            example:
              messages:
                - role: user
                  content: 你好
              model: x1
              stream: true
      responses:
        '200':
          description: ''
          content:
            text/event-stream:
              schema:
                type: object
                properties: {}
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-321271136-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```

# OpenAI的请求

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/responses:
    post:
      summary: OpenAI的请求
      deprecated: false
      description: ''
      tags: []
      parameters:
        - name: Content-Type
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{OPENAI_API_KEY}}
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
            example:
              model: gpt-5-mini
              input:
                - role: user
                  content: 你好
              store: true
              reasoning:
                effort: minimal
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: developing
      x-run-in-apifox: https://app.apifox.com/web/project/6756983/apis/api-342162030-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://doubao.api.aiqji.cn
    description: 正式环境
security: []

```