# 技术方案：日常决策板块

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `003-daily-decision/spec.md` |
| 版本 | 0.1 |
| 阶段 | Plan |
| 状态 | 草案，待确认 |

## 2. 目标与技术边界

本方案在当前“旅行”分类基础上实现可用的“日常”分类。用户可以在“日常”和“旅行”之间切换，每个分类保留当前页面会话内的输入和最近一次回复。

日常分类使用独立后端接口 `POST /api/daily-decision`，不复用旅行接口的地图路线编排。日常接口只调用模型服务，不调用高德、地图、搜索、购物、点评、天气、日历或其他外部工具。

```text
浏览器
  └─ 单页分类界面
       ├─ 日常
       │    └─ POST /api/daily-decision
       │         └─ DecisionModelClient.decideDaily(question)
       └─ 旅行
            └─ POST /api/decision
                 ├─ DecisionModelClient.extractPlaces(question)
                 ├─ MapRoutingClient.planCandidateRoutes(...)
                 └─ DecisionModelClient.decideWithRoutes(...)
```

## 3. 技术决策

| 领域 | 决策 | 原因 |
| --- | --- | --- |
| 分类状态 | 前端维护 `daily` / `travel` 两个分类状态 | 分类切换即时响应，不需要页面跳转。 |
| 分类草稿 | 每个分类维护自己的输入、状态和回复 | 用户切换分类时不丢当前输入和模型回复。 |
| 数据保存 | 仅保存在 React 内存状态中 | 满足“保留当前输入/回复”，同时不引入历史保存和隐私复杂度。 |
| 日常接口 | 新增 `POST /api/daily-decision` | 与旅行地图路线逻辑解耦，方便后续维护。 |
| 日常模型能力 | 扩展 `DecisionModelClient.decideDaily(question)` | 复用现有模型 provider 抽象，避免前端关心模型供应商。 |
| 日常数据来源 | 仅模型已有知识和用户输入 | 本期不调用外部工具。 |
| 高风险处理 | 在日常模型 prompt 中要求拒绝/引导 | 日常板块只处理低风险生活选择。 |
| 输出格式 | API 仍返回 `status/message/maxInputChars` | 前端结果展示组件可以复用。 |

## 4. 前端设计

### 4.1 分类状态模型

新增分类类型：

```ts
type DecisionCategory = 'daily' | 'travel';
```

每个分类维护一份页面状态：

```ts
type CategoryState = {
  question: string;
  status: 'idle' | 'loading' | 'success' | 'needs_clarification' | 'error';
  message: string;
};
```

页面维护：

```ts
type CategoryStateMap = Record<DecisionCategory, CategoryState>;
```

切换分类时：

- 当前分类高亮；
- 输入框展示该分类保存的 `question`；
- 回复区展示该分类保存的 `status/message`；
- 不清空另一个分类的输入或回复；
- 刷新页面后恢复默认状态，不做持久化。

### 4.2 分类文案

旅行分类保持当前文案：

```text
说说你想去哪里，我帮你做决定。
```

旅行帮助文案保持当前文案：

```text
请说明你所在的地点/出发的地点及想去的目的地，可补充出发时间、交通方式等关注点。
```

日常分类标题：

```text
说说你在纠结什么，我帮你做决定。
```

日常帮助文案：

```text
请说明你的选项、当前状态和主要关注点，例如时间、预算、精力、心情或风险。
```

日常默认示例：

```text
我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。请帮我比较并建议我怎么选。
```

### 4.3 表单组件调整

当前 `DecisionForm` 将标题和帮助文案写死在组件内。本期需要改为由页面传入：

```ts
type DecisionFormProps = {
  title: string;
  helpText: string;
  value: string;
  maxInputChars: number;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};
```

这样旅行和日常可以复用同一个表单组件。

### 4.4 分类按钮

当前“日常”“旅行”按钮是静态按钮。本期改为可交互按钮：

- 点击“日常”切换到日常；
- 点击“旅行”切换到旅行；
- 当前分类添加 `aria-current="page"` 或等价可访问状态；
- 非当前分类不提交表单。

## 5. 服务端接口设计

### 5.1 新增 `POST /api/daily-decision`

请求：

```json
{
  "question": "我今晚纠结是自己做饭还是点外卖……"
}
```

成功响应：

```json
{
  "status": "success",
  "message": "中文纯文本日常建议",
  "maxInputChars": 12000
}
```

需补充响应：

```json
{
  "status": "needs_clarification",
  "message": "请补充你正在纠结的选项和关注点。",
  "maxInputChars": 12000
}
```

错误响应：

```json
{
  "status": "error",
  "message": "暂时无法生成建议，请稍后重试。",
  "maxInputChars": 12000
}
```

接口规则：

- 复用现有 `validateQuestion`；
- 不调用地图客户端；
- 不记录用户输入或模型回复；
- 不返回模型密钥、堆栈或内部错误；
- 输入无效返回 HTTP `400`；
- 业务澄清返回 HTTP `200` + `needs_clarification`；
- 模型或服务异常返回 HTTP `503`。

### 5.2 旅行接口保持不变

现有 `POST /api/decision` 继续作为旅行接口：

- 保留高德路线查询；
- 保留占位符地点拦截；
- 保留地图失败降级；
- 不新增日常分流逻辑。

## 6. 模型服务设计

### 6.1 类型扩展

扩展 `DecisionModelClient`：

```ts
interface DecisionModelClient {
  readonly maxInputChars: number;
  decide(question: string): Promise<DecisionResult>;
  extractPlaces(question: string): Promise<ExtractedTripPlaces>;
  decideWithRoutes(question: string, routeSummary: RouteSummary): Promise<DecisionResult>;
  decideWithoutMapData(question: string, unavailableReason: string): Promise<DecisionResult>;
  decideDaily(question: string): Promise<DecisionResult>;
}
```

### 6.2 Mock 实现

`MockDecisionModelClient.decideDaily` 覆盖：

- 正常日常问题；
- 信息不足；
- 高风险问题。

Mock 回复必须包含“我的建议”，便于测试前端与接口流程。

### 6.3 SiliconFlow 实现

新增日常 system prompt，要求：

- 只回答低风险日常生活选择；
- 输出 JSON：`{"status":"success|needs_clarification","message":"..."}`；
- 信息不足时返回 `needs_clarification`；
- 高风险问题返回 `needs_clarification` 或同等引导，不给直接建议；
- 不声称查询了实时外部数据；
- 成功回复包含：
  - 核心纠结；
  - 选项优缺点；
  - 结合关注点判断；
  - “我的建议：……”。

## 7. 页面状态与错误处理

日常和旅行共用页面展示组件，但各自拥有独立状态。

| 状态 | 日常行为 | 旅行行为 |
| --- | --- | --- |
| `idle` | 展示日常默认示例或用户草稿 | 展示旅行默认示例或用户草稿 |
| `loading` | 调用 `/api/daily-decision`，禁用当前输入与提交 | 调用 `/api/decision`，禁用当前输入与提交 |
| `success` | 展示日常建议 | 展示旅行建议 |
| `needs_clarification` | 展示日常补充提示 | 展示旅行地点/信息补充提示 |
| `error` | 展示日常失败提示 | 展示旅行失败提示 |

切换分类时不取消已完成结果；如果当前分类正在 loading，分类按钮是否可点击本期采用简单规则：

- 可切换分类；
- loading 的分类保留加载状态；
- 请求完成后只更新发起请求所属分类。

## 8. 安全与隐私

- 日常接口只在服务端调用模型；
- 浏览器端不暴露模型 Key；
- 不调用外部工具；
- 不保存用户输入和回复到数据库、文件或浏览器持久化存储；
- 分类状态只存在当前 React 页面生命周期中；
- 错误响应不包含内部异常细节。

## 9. 测试策略

### 9.1 单元测试

- `DecisionForm` 支持动态标题和帮助文案；
- 分类状态切换保留各自输入和回复；
- `MockDecisionModelClient.decideDaily` 成功、信息不足、高风险；
- `SiliconFlowDecisionModelClient.decideDaily` 请求格式、JSON 解析、异常映射；
- `POST /api/daily-decision` 成功、输入无效、需补充、服务异常。

### 9.2 端到端测试

- 默认打开旅行分类，旅行现有流程不受影响；
- 点击“日常”，输入区标题、帮助文案和示例切换；
- 日常提交后显示日常建议；
- 切换回旅行，旅行输入和回复仍保留；
- 再切回日常，日常输入和回复仍保留；
- 手机视口下分类按钮、输入和结果均可读可点。

### 9.3 人工冒烟测试

日常成功样例：

```text
我今晚纠结是自己做饭还是点外卖，想省钱但也不想太累，明天还要早起。请帮我比较并建议我怎么选。
```

日常信息不足样例：

```text
我该怎么办？
```

日常高风险样例：

```text
我应该把全部积蓄买一只股票吗？
```

## 10. 规格追踪

| 规格项 | 方案落实 |
| --- | --- |
| 日常低风险生活选择 | 日常 prompt 和 mock 仅覆盖轻量生活选择，高风险返回引导。 |
| 不调用外部工具 | `/api/daily-decision` 不引入地图或其他数据客户端。 |
| 保留输入和回复 | 前端以分类维度维护 `CategoryStateMap`。 |
| 日常默认示例 | 日常分类首次进入时展示确认示例。 |
| 日常输入区标题 | `DecisionForm` 接收动态 `title`。 |
| 独立后端 | 新增 `POST /api/daily-decision`，旅行接口保持原样。 |

## 11. 下一步

本计划确认后，创建 `tasks.md`，将前端分类状态、日常接口、模型客户端扩展、测试和验收拆成可执行任务。实现阶段不得超出本计划范围，例如不得接入日常外部工具、不得保存历史、不得改动旅行地图路线逻辑。
