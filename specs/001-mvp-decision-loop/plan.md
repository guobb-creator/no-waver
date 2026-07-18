# 技术方案：MVP 旅行目的地决策闭环

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `001-mvp-decision-loop/spec.md` |
| 版本 | 0.2 |
| 阶段 | Plan |
| 状态 | 已实现 |

## 2. 目标与技术边界

本方案实现一个中文、单轮、对话式 Web 页面。用户输入一段旅行决策描述，页面调用受保护的服务端接口，并显示一条纯文本回复。

本期通过服务端模型客户端完成单次模型调用，并保留 mock 替身实现。当前真实 provider 暂用 SiliconFlow 的 `deepseek-ai/DeepSeek-V3.2`；后续切换模型只改环境变量和必要的 provider 适配器，不改浏览器端。系统不调用地图、搜索、交通、点评或其他外部工具与数据服务。

```text
浏览器
  └─ 单页对话界面
       └─ POST /api/decision
            └─ DecisionModelClient（服务端抽象）
                 ├─ MockDecisionModelClient（本地/测试）
                 └─ SiliconFlowDecisionModelClient（当前真实模型）
```

## 3. 技术决策

| 领域 | 决策 | 原因 |
| --- | --- | --- |
| Web 框架 | Next.js（App Router）+ TypeScript | 同一项目可实现响应式页面和受保护的服务端接口，后续替换真实模型适配器无需改变浏览器端。 |
| 样式 | CSS Modules 或全局 CSS | MVP 页面简单，避免引入额外 UI 框架。 |
| 模型调用 | `DecisionModelClient` 接口 + mock / SiliconFlow 实现 | 将模型提供商与页面/API 解耦，以环境变量切换 provider 和模型。 |
| 数据保存 | 不使用数据库、文件存储、浏览器持久化存储 | 符合本期不保存输入和回复的规格。 |
| 输出格式 | API 返回结构化状态，页面仅渲染其中的纯文本 `message` | 既能处理成功、需补充和失败状态，也能保证用户看到的是纯文本。 |
| 浏览器与布局 | Google Chrome 优先；CSS 响应式单列布局 | 满足桌面与手机自适应要求。 |

## 4. 系统设计

### 4.1 前端页面

页面为一个单页，不维护会话历史。每次提交只展示本次请求的加载、结果或失败状态；下一次提交会替换当前结果。

页面组成：

1. 产品名称和简短场景说明；
2. 可编辑的多行文本输入框，初始值为规格中定义的中文示例；
3. 输入字符计数和最大长度提示；
4. 提交按钮；
5. 加载状态；
6. 纯文本回复区域；
7. 失败或补充信息提示区域；
8. 本期不添加独立免责声明；模型回复本身不得声称实时交通或最新游客评价。

交互规则：

- 输入为空或仅包含空白字符时禁用提交；
- 输入超过接口公布的最大字符数时阻止提交并提示缩短；
- 请求未完成时禁用输入框和提交按钮，防止重复提交；
- 收到新请求前清除上一条结果；
- 请求成功后仅显示 API 返回的纯文本内容，不解析 Markdown、HTML 或富文本；
- 用户修改输入后可再次提交，不保留历史消息。

### 4.2 服务端接口

定义一个受保护的同源决策接口：`POST /api/decision`。页面初始化时通过服务端安全配置获得当前的最大输入字符数；该配置不包含模型密钥或提供商凭据。

请求体：

```json
{
  "question": "我上午已经到了西湖，下午想去灵隐寺或浙江省博物馆之江馆，请从交通和游客评价方面帮我比较。"
}
```

成功响应：

```json
{
  "status": "success",
  "message": "纯文本决策建议",
  "maxInputChars": 12000
}
```

需补充信息响应：

```json
{
  "status": "needs_clarification",
  "message": "请确认目的地名称是否有误，并补充当前地点和两个候选目的地。",
  "maxInputChars": 12000
}
```

失败响应：

```json
{
  "status": "error",
  "message": "暂时无法生成建议，请稍后重试。",
  "maxInputChars": 12000
}
```

接口规则：

- 仅接受 JSON 请求；
- 在服务端校验 `question` 为非空字符串，且长度不超过当前模型客户端的 `maxInputChars`；
- 不记录请求文本、回复内容或调用日志中的敏感内容；
- 不向浏览器返回模型密钥、堆栈、内部地址或原始异常；
- 使用 HTTP `400` 表示输入无效，`200` 表示可理解的业务回复（包括 `needs_clarification`），`500` 或 `503` 表示服务端失败。

`maxInputChars` 由 `DecisionModelClient` 提供。本期 mock 可配置一个开发值；接入真实模型时，替换为该模型服务实际可接收的最大字符数，前端无需改变限制逻辑。

### 4.3 模型服务抽象

服务端定义以下概念接口：

```ts
type DecisionResult =
  | { status: 'success'; message: string }
  | { status: 'needs_clarification'; message: string };

interface DecisionModelClient {
  readonly maxInputChars: number;
  decide(question: string): Promise<DecisionResult>;
}
```

本期实现两个 `DecisionModelClient`：

- `MockDecisionModelClient`：用于本地无密钥开发、单元测试和稳定的浏览器端到端测试；
- `SiliconFlowDecisionModelClient`：通过 OpenAI 兼容的 `/chat/completions` 接口调用当前真实模型；
- 两个实现都必须返回 `DecisionResult`，并由 `POST /api/decision` 统一映射给前端；
- 不保存任何输入或模型回复。

真实适配器必须在系统提示中约束模型：仅基于已学习知识回答；不得声称拥有实时或最新交通、游客评价；信息不足时要求用户确认地点或补充信息。当前 SiliconFlow 响应内部要求 JSON，页面仅展示其中的纯文本 `message`。

## 5. 页面状态与错误处理

| 页面状态 | 触发条件 | 页面行为 |
| --- | --- | --- |
| `idle` | 首次打开或编辑输入后 | 展示默认示例或用户当前文本，可提交。 |
| `loading` | 已提交且接口未返回 | 显示加载提示，禁用输入和提交。 |
| `success` | API 返回 `success` | 显示纯文本建议，可继续编辑并再次提交。 |
| `needs_clarification` | API 返回地点缺失、歧义、不识别或距离不符合场景 | 显示纯文本补充提示，保留输入供用户修改。 |
| `error` | 网络、超时或服务端异常 | 显示非技术化错误提示，保留输入供用户重试。 |

地点判断由服务端模型客户端负责，前端不尝试解析 A、B、C，避免在浏览器端实现不可靠的地点识别规则。

## 6. 响应式与可访问性

- 使用语义化 `label`、`textarea`、`button` 和结果容器；
- 错误和回复使用可被辅助技术感知的状态提示；
- 默认桌面内容区限制最大宽度；手机端使用单列、全宽输入与可点击按钮；
- 不产生横向滚动；长文本自动换行；
- 以 Google Chrome 为首要验证浏览器，覆盖常见桌面和手机视口。

## 7. 安全与隐私

- 模型客户端仅在服务端运行；任何真实模型密钥仅通过服务端环境变量读取，绝不发送到浏览器；
- 本期不配置数据库、分析埋点或浏览器持久化存储；
- 应避免在请求日志中写入用户问题和模型回复；
- API 错误统一映射为用户可理解的中文提示，服务端保留内部错误细节但不返回给客户端。

## 8. 测试与验收策略

### 8.1 单元测试

- 服务端请求校验：空白输入、非字符串输入、超长输入；
- `MockDecisionModelClient`：正常回复、需确认地点回复；
- `SiliconFlowDecisionModelClient`：请求格式、模型参数、结果解析和 provider 错误映射；
- API 错误映射：异常不会泄露内部信息；
- 前端状态：提交禁用、加载禁用、成功、补充提示、失败重试。

### 8.2 端到端验证

1. 在 Chrome 桌面端和手机视口打开页面；
2. 确认默认中文示例可编辑；
3. 提交有效旅行描述，确认显示一条纯文本回复；
4. 提交地点不完整或无法识别的描述，确认提示用户核对或补充地点；
5. 断开接口或让 mock 抛错，确认显示非技术化失败提示且可重试；
6. 确认请求过程中不能重复提交；
7. 检查页面、网络响应和浏览器代码中不含模型密钥，且没有输入/回复持久化行为。

## 9. 规格追踪

| 规格项 | 方案落实 |
| --- | --- |
| 单个自然语言中文输入 | 单个可编辑 `textarea` 与默认示例。 |
| 单轮对话 | 一次 `POST /api/decision` 对应一条回复；不维护历史。 |
| 纯文本结果 | API `message` 按文本渲染，不启用富文本解析。 |
| 信息缺失、歧义或地点异常 | `needs_clarification` 状态提示用户补充或核对地点。 |
| 不使用工具或外部数据 | 模型客户端只调用语言模型；不引入地图、搜索、交通或点评 API。 |
| 不保存数据 | 无数据库、无本地持久化、避免内容日志。 |
| 可切换模型服务 | `DecisionModelClient` 接口；通过 `MODEL_PROVIDER`、模型名和 base URL 切换。 |

## 10. 下一步

本计划确认后，创建 `tasks.md`，将页面、API、模型客户端抽象、mock、测试和验收拆分为可独立执行及验证的任务。实现阶段不得超出本计划的单轮、无工具调用、无数据保存边界。

## 11. 建议目录结构

以下为实现阶段的目标目录，文件名可在实现时按 Next.js 约定微调，但职责不可交叉：

```text
app/
├─ api/
│  └─ decision/
│     └─ route.ts                 # POST /api/decision：校验、调用客户端、错误映射
├─ page.tsx                       # 单页容器与页面状态
├─ layout.tsx                     # 全局页面结构与元数据
└─ globals.css                    # 全局与响应式样式
components/
├─ DecisionForm.tsx               # 输入框、字符数、提交按钮
└─ DecisionResponse.tsx           # 纯文本回复、补充提示、失败提示
lib/
├─ decision-model/
│  ├─ types.ts                    # DecisionModelClient 与结果类型
│  ├─ mock-client.ts              # 本地与测试替身实现
│  ├─ siliconflow-client.ts       # SiliconFlow 真实模型适配器
│  └─ client-factory.ts           # provider 切换入口
├─ validation.ts                  # 文本清理、长度与请求体校验
└─ app-config.ts                  # 最大输入长度等非敏感配置
tests/
├─ unit/                          # 客户端、校验、组件单元测试
└─ e2e/                           # 用户主流程的端到端测试
```

## 12. 配置与运行时约定

| 配置项 | 本期来源 | 约束 |
| --- | --- | --- |
| `MAX_INPUT_CHARS` | 服务端非敏感配置 | 值必须与当前 `DecisionModelClient.maxInputChars` 一致；mock 使用开发默认值。 |
| `MODEL_PROVIDER` | 环境变量 | `mock` 或 `siliconflow`；未配置时使用 mock。 |
| `SILICONFLOW_API_KEY` | `.env.local` | 仅服务端读取，不进入前端构建产物或响应。 |
| `SILICONFLOW_BASE_URL` | `.env.local` | 默认 `https://api.siliconflow.cn/v1`。 |
| `SILICONFLOW_MODEL` | `.env.local` | 当前为 `deepseek-ai/DeepSeek-V3.2`；后续切换模型优先改这里。 |
| `SILICONFLOW_ENABLE_THINKING` | `.env.local` | 当前建议 `false`，保证单轮回复更短、更稳定。 |
| `SILICONFLOW_MAX_TOKENS` / `SILICONFLOW_TEMPERATURE` | `.env.local` | 控制输出长度与发散度；当前建议 `1200` / `0.4`。 |
| 请求超时 | 服务端默认值 | 具体值实现时定义；超时统一映射为用户可重试的中文提示。 |

配置读取仅发生在服务端或构建阶段。页面只能获取最大输入字符数这一项安全信息，不能获取模型提供商或任何凭据。

## 13. API 处理流程

```text
接收 POST /api/decision
     ↓
解析 JSON 请求体
     ↓
校验 question：类型、去除首尾空白、非空、长度不超限
     ├─ 不通过 → 400 + 中文输入提示
     ↓
取得 DecisionModelClient
     ↓
调用 client.decide(question)
     ├─ 返回 needs_clarification → 200 + 中文补充地点提示
     ├─ 返回 success → 200 + 纯文本建议
     └─ 抛出异常或超时 → 5xx + 非技术化重试提示
```

路由层负责输入校验、响应状态和异常隔离；模型客户端只负责针对问题生成 `DecisionResult`。两层不得直接操作页面状态，也不得写入持久化数据。

## 14. Mock 决策客户端规则

Mock 用于在没有真实模型服务时验证完整交互链路，不应伪装成真实交通或游客评价能力。

| 输入特征 | 预期 `status` | 预期 `message` |
| --- | --- | --- |
| 有效且包含旅行目的地选择描述 | `success` | 固定中文示例建议，明确说明它是基于模型已有知识的演示结果，非实时信息。 |
| 未表达两个候选目的地，或明显缺少当前地点 | `needs_clarification` | 提示用户补充当前地点和两个候选目的地。 |
| 包含无法识别的占位词或明显跨城描述 | `needs_clarification` | 提示用户确认地点名称、是否同城及地点信息是否有误。 |
| 客户端内部异常或超时 | 路由映射为 `error` | “暂时无法生成建议，请稍后重试。” |

对“有效”或“缺失”的判断只允许使用最小的、可测试的演示规则；不实现真实自然语言理解、地点解析、距离计算或数据检索。这些能力属于未来真实模型适配器或工具调用版本。

## 15. 实施顺序与完成门槛

实施应依照以下依赖顺序进行：

1. 初始化 Next.js/TypeScript 项目及基础样式；
2. 创建模型客户端类型、非敏感配置和 mock；
3. 实现并测试 `POST /api/decision`；
4. 实现单页输入、加载、回复及错误状态；
5. 接入页面与 API，并完成响应式样式；
6. 添加单元测试和端到端测试；
7. 在 Chrome 的桌面与手机视口执行规格验收。

进入实现的门槛：

- [ ] `spec.md` 与本 `plan.md` 的边界一致；
- [ ] mock 的演示性质和“非实时知识”提示已在 UI 与测试中体现；
- [ ] 未设计数据库、账户、会话历史、外部工具或真实模型密钥；
- [ ] API 响应契约已可供前端和测试共同使用。

完成实现的门槛：

- [ ] 用户能编辑默认示例并提交中文文本；
- [ ] 有效请求能展示纯文本回复；
- [ ] 信息缺失、地点歧义或不符合场景时会提示补充或核对；
- [ ] 网络和服务错误可重试且不暴露内部信息；
- [ ] 页面在 Chrome 桌面端和手机视口可用；
- [ ] 不存在输入、回复或密钥的持久化和泄露。
