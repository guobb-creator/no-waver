# 实施任务：MVP 旅行目的地决策闭环

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `001-mvp-decision-loop/spec.md` |
| 对应方案 | `001-mvp-decision-loop/plan.md` |
| 版本 | 0.1 |
| 阶段 | Tasks |
| 状态 | 已实现并通过验证 |

## 2. 实施约束

- 本期仅实现单轮：一次中文输入对应一次纯文本回复；
- 当前可通过 `MODEL_PROVIDER` 在 mock 与 SiliconFlow provider 间切换；
- 不接入外部工具、地图、搜索、交通或点评服务；
- 已实现 `MockDecisionModelClient`、`SiliconFlowDecisionModelClient` 和统一服务端模型接口；
- 不实现账户、会话历史、数据库、输入/回复保存、埋点、免责声明或多轮对话；
- 不在前端代码、响应、日志或持久化介质中暴露或保存模型密钥、用户输入和模型回复。

## 3. 任务清单

### 阶段 A：项目基础

- [x] T001 初始化 Next.js App Router 与 TypeScript 项目，添加最小运行、检查和测试脚本。
  - 文件：`package.json`、`tsconfig.json`、`next.config.*`、`app/layout.tsx`、`app/page.tsx`
  - 验证：开发服务器可启动，Chrome 可打开首页。

- [x] T002 建立全局样式与基础页面元数据，配置中文语言标记和移动端 viewport。
  - 文件：`app/layout.tsx`、`app/globals.css`
  - 依赖：T001
  - 验证：HTML `lang="zh-CN"`、页面标题为“不再摇摆”、手机视口不缩放异常。

### 阶段 B：模型抽象与服务端接口

- [x] T003 定义模型客户端的类型和非敏感输入长度配置。
  - 文件：`lib/decision-model/types.ts`、`lib/app-config.ts`
  - 内容：定义 `DecisionModelClient`、`DecisionResult`、`maxInputChars`；本期使用开发默认最大字符数。
  - 依赖：T001
  - 验证：TypeScript 可正确推断成功与需补充信息两类结果。

- [x] T004 实现 `MockDecisionModelClient`，覆盖演示成功、信息缺失/歧义和异常路径。
  - 文件：`lib/decision-model/mock-client.ts`、`lib/decision-model/client-factory.ts`
  - 内容：成功回复必须为中文纯文本，并说明其基于模型已有知识、非实时；地点不完整、无法识别或明显跨城时返回 `needs_clarification`。
  - 依赖：T003
  - 验证：单元测试覆盖三种状态；不包含任何外部网络请求。

- [x] T004a 实现 `SiliconFlowDecisionModelClient`，支持通过环境变量配置真实模型。
  - 文件：`lib/decision-model/siliconflow-client.ts`、`lib/decision-model/client-factory.ts`、`.env.example`
  - 内容：读取 `MODEL_PROVIDER`、`SILICONFLOW_API_KEY`、`SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL`、`SILICONFLOW_ENABLE_THINKING`、`SILICONFLOW_MAX_TOKENS`、`SILICONFLOW_TEMPERATURE`；当前模型为 `deepseek-ai/DeepSeek-V3.2`。
  - 依赖：T003、T004
  - 验证：单元测试覆盖请求格式、参数传递、结果解析和 provider 错误映射；真实接口冒烟测试通过。

- [x] T005 实现请求体验证与错误映射工具。
  - 文件：`lib/validation.ts`
  - 内容：校验 JSON 中的 `question` 是非空字符串；去除首尾空白；拒绝超出 `maxInputChars` 的输入；构造不含内部细节的中文错误信息。
  - 依赖：T003
  - 验证：单元测试覆盖空白、非字符串、正常文本和超长文本。

- [x] T006 实现 `POST /api/decision`，连接校验、模型客户端和统一响应契约。
  - 文件：`app/api/decision/route.ts`
  - 内容：输入无效时返回 `400`；成功和 `needs_clarification` 返回 `200`；异常或超时返回 `500`/`503`；响应只包含 `status`、`message` 和 `maxInputChars`。
  - 依赖：T004、T005
  - 验证：路由测试覆盖成功、需补充信息、无效输入和服务异常；响应中不含堆栈、密钥或内部地址。

### 阶段 C：单轮对话界面

- [x] T007 实现旅行决策输入组件与默认中文示例。
  - 文件：`components/DecisionForm.tsx`
  - 内容：使用单个 `textarea`，初始值为规格中的 A/B/C、交通与游客评价示例；展示字符计数；空白或超长时禁用提交并提示原因。
  - 依赖：T003
  - 验证：用户可以编辑或完全替换默认示例；仅支持中文提示；超过最大长度不能提交。

- [x] T008 实现回复与状态展示组件。
  - 文件：`components/DecisionResponse.tsx`
  - 内容：按纯文本渲染成功回复、补充信息提示和非技术化失败提示；不得渲染 Markdown 或 HTML；本期不添加独立免责声明。
  - 依赖：T001
  - 验证：给定每种状态时，组件显示正确中文文本且无富文本解析。

- [x] T009 组合单页状态机并接入决策接口。
  - 文件：`app/page.tsx`
  - 内容：维护 `idle`、`loading`、`success`、`needs_clarification`、`error` 状态；提交时调用 `POST /api/decision`；加载时禁止重复提交；新请求开始时清除旧回复；失败或需补充时保留用户输入供修改。
  - 依赖：T006、T007、T008
  - 验证：组件测试覆盖所有页面状态和再次提交流程。

- [x] T010 完成桌面与手机响应式样式及可访问性处理。
  - 文件：`app/globals.css`、各组件样式文件（如需要）
  - 内容：桌面端限制内容宽度；手机端单列、全宽输入与按钮；长文本换行、无横向滚动；为输入、按钮、加载、回复和错误提供语义化标签及状态提示。
  - 依赖：T002、T007、T008、T009
  - 验证：Chrome 桌面端和常见手机视口均可阅读、点击和提交；键盘可操作主要控件。

### 阶段 D：质量验证与文档收尾

- [x] T011 添加单元与路由测试。
  - 文件：`tests/unit/validation.*`、`tests/unit/mock-client.*`、`tests/unit/siliconflow-client.*`、`tests/unit/decision-route.*`、`tests/unit/components.*`
  - 内容：覆盖 T004–T009 的核心规则与错误边界。
  - 依赖：T004、T005、T006、T007、T008、T009
  - 验证：测试脚本全量通过。

- [x] T012 添加端到端验收测试。
  - 文件：`tests/e2e/decision-flow.*`
  - 内容：覆盖默认示例编辑、正常提交、信息缺失提示、异常重试、加载时防重复提交和手机视口展示。
  - 依赖：T010、T011
  - 验证：Chrome 自动化测试通过。

- [x] T013 依照规格执行人工验收并记录结果。
  - 文件：`specs/001-mvp-decision-loop/tasks.md`（更新复选状态；如需要，可新增验收记录）
  - 内容：按 `spec.md` 的四项用户故事和 `plan.md` 的完成门槛逐项检查。
  - 依赖：T012
  - 验证：所有必需验收项通过；未通过项记录原因与后续处理。

## 4. 依赖关系

```text
T001 → T002
T001 → T003 → T004 ─┐
              ├→ T004a
              └→ T005 ┴→ T006
T003 → T007
T001 → T008
T006 + T007 + T008 → T009 → T010
T004 + T004a + T005 + T006 + T007 + T008 + T009 → T011
T010 + T011 → T012 → T013
```

## 5. 验收映射

| 规格用户故事 | 主要任务 | 通过条件 |
| --- | --- | --- |
| US-001：描述旅行决策 | T007、T009 | 有一个可编辑的中文输入区域、默认示例、长度限制和信息补充引导。 |
| US-002：提交并等待结果 | T006、T009 | 可以提交；加载状态清晰；加载中不能重复提交；失败后可重试。 |
| US-003：查看比较与建议 | T004、T008、T009 | 显示与本次输入对应的中文纯文本回复；本期通过模型接口边界控制非实时知识来源，不展示独立免责声明。 |
| US-004：处理失败或信息不足 | T004、T006、T008、T009 | 对地点问题提示核对/补充；系统异常不泄露内部信息且可以重试。 |

## 6. 实现完成定义

只有在 T001–T013 完成且以下条件全部满足时，才可将本规格标记为“已实现”：

- 用户能在 Chrome 桌面端和手机视口输入、提交并看到纯文本回复；
- 所有模型交互均经服务端 `DecisionModelClient`，浏览器不持有模型密钥；
- 本期运行时未调用任何外部工具或数据服务；
- 不保存用户输入或模型回复；
- 已通过自动化测试和人工验收。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 2026-07-18 | `npm run lint` | 通过 |
| 2026-07-18 | `npm test` | 通过：5 个测试文件，14 个单元/路由/组件测试 |
| 2026-07-18 | `npm run build` | 通过：Next.js 生产构建成功 |
| 2026-07-18 | `npm run test:e2e` | 通过：桌面 Chrome 与手机 Chrome 视口共 8 条端到端测试 |
| 2026-07-18 | SiliconFlow 冒烟测试 | 通过：`MODEL_PROVIDER=siliconflow` 时，本地 `/api/decision` 成功返回中文纯文本建议 |
