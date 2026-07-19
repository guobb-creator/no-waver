# 实施任务：地图导航数据辅助决策

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `002-distance-aware-decision/spec.md` |
| 对应方案 | `002-distance-aware-decision/plan.md` |
| 版本 | 0.1 |
| 阶段 | Tasks |
| 状态 | 已实现并通过验证 |

## 2. 实施约束

- 本期只接入高德地图 Web 服务 API，不内嵌地图。
- 结果仍为中文纯文本，使用轻量对比表展示路线数据。
- 默认输入示例不改。
- 用户仍只输入一段自然语言文本。
- 仍为单轮交互；服务端内部可以多次调用模型和地图服务。
- 游客评价仍由模型基于已有知识生成，不调用点评、搜索、评论或社交平台服务。
- 不保存用户输入、模型回复、地理编码结果、经纬度或路线结果。
- 高德 Key 只通过服务端环境变量读取，不进入前端代码、响应或日志。
- 地图服务失败时允许降级为模型常识建议，但必须明确告诉用户没有拿到地图导航数据。

## 3. 任务清单

### 阶段 A：配置与类型基础

- [x] T001 更新环境变量示例和配置读取。
  - 文件：`.env.example`、`lib/app-config.ts`
  - 内容：新增 `MAP_PROVIDER`、`AMAP_WEB_SERVICE_KEY`、`AMAP_BASE_URL`、`AMAP_REQUEST_TIMEOUT_MS`、`WALKING_DISPLAY_MAX_MINUTES`；保持现有模型配置不变。
  - 验证：未配置真实高德 Key 时可使用 mock；生产启用 `MAP_PROVIDER=amap` 时必须能读取 `AMAP_WEB_SERVICE_KEY`。

- [x] T002 定义地图路线领域类型。
  - 文件：`lib/map-routing/types.ts`
  - 内容：定义 `TravelMode`、`RouteOption`、`CandidateRouteSummary`、`MapRoutingClient`、地图成功/需澄清/不可用结果类型。
  - 依赖：T001
  - 验证：TypeScript 能区分 `success`、`needs_clarification`、`unavailable` 三类结果。

- [x] T003 实现路线摘要格式化工具。
  - 文件：`lib/map-routing/route-summary.ts`
  - 内容：将地图路线结果格式化为中文短行；分钟转“约 X 分钟/约 X 小时 Y 分钟”；步行超过 30 分钟时过滤或标记不建议步行。
  - 依赖：T002
  - 验证：单元测试覆盖公交/地铁、驾车/打车、骑行、步行过滤和超过 60 分钟格式。

### 阶段 B：地图客户端

- [x] T004 实现 `MockMapRoutingClient`。
  - 文件：`lib/map-routing/mock-client.ts`
  - 内容：提供稳定的 A→B、A→C 模拟路线，覆盖成功、地点需确认、地图不可用三种路径。
  - 依赖：T002、T003
  - 验证：单元测试不依赖外网即可生成轻量路线对比数据。

- [x] T005 实现高德地理编码解析。
  - 文件：`lib/map-routing/amap-client.ts`
  - 内容：调用高德地理编码接口，把地点名称解析为经纬度、城市、格式化名称；当地理编码无法识别景点/POI 名称时，降级使用高德 POI 关键字搜索；处理无结果、多结果、城市歧义和 API 错误。
  - 依赖：T001、T002
  - 验证：单元测试使用 mock fetch 覆盖唯一结果、无结果、歧义结果和 Key/服务错误。

- [x] T006 实现高德路线查询。
  - 文件：`lib/map-routing/amap-client.ts`
  - 内容：查询 A→B、A→C 的公交/地铁、驾车/打车、骑行、步行路线；整理预计时间和距离；某种交通方式不可用时不阻断整体结果。
  - 依赖：T005
  - 验证：单元测试覆盖四种交通方式、单项无结果、接口超时、限流或异常。

- [x] T007 实现地图客户端工厂。
  - 文件：`lib/map-routing/client-factory.ts`
  - 内容：根据 `MAP_PROVIDER` 返回 `MockMapRoutingClient` 或 `AmapMapRoutingClient`；默认策略需适合本地开发和生产部署。
  - 依赖：T004、T006
  - 验证：不同环境变量组合下返回正确客户端；不会在错误中泄露 Key。

### 阶段 C：模型能力扩展

- [x] T008 扩展模型客户端类型，支持地点提取。
  - 文件：`lib/decision-model/types.ts`
  - 内容：新增 `ExtractedTripPlaces` 与 `extractPlaces(question)`；保持现有 `decide(question)` 兼容。
  - 依赖：T002
  - 验证：现有 mock 和 SiliconFlow 客户端类型仍可编译，新增类型可区分成功与需补充。

- [x] T009 扩展 `MockDecisionModelClient`。
  - 文件：`lib/decision-model/mock-client.ts`
  - 内容：实现地点提取 mock；实现基于路线摘要生成“路线对比 + 优缺点 + 我的建议”的 mock 回复。
  - 依赖：T008、T003
  - 验证：单元测试覆盖成功提取、缺少地点、最终回复格式。

- [x] T010 扩展 `SiliconFlowDecisionModelClient` 的地点提取能力。
  - 文件：`lib/decision-model/siliconflow-client.ts`
  - 内容：新增结构化地点提取调用；要求模型只返回 JSON；对非 JSON、缺字段或置信度不足映射为 `needs_clarification`。
  - 依赖：T008
  - 验证：单元测试覆盖请求格式、JSON 解析、缺字段、模型异常。

- [x] T011 扩展 `SiliconFlowDecisionModelClient` 的路线增强决策能力。
  - 文件：`lib/decision-model/siliconflow-client.ts`
  - 内容：新增 `decideWithRoutes(question, routeSummary)`；prompt 必须要求输出轻量路线对比表、分别分析 B/C 优缺点、最后给“我的建议”；游客评价不得表述为实时评价。
  - 依赖：T010、T003
  - 验证：单元测试确认 prompt 包含路线摘要、不包含高德 Key、不要求 Markdown 表格。

### 阶段 D：API 编排与降级

- [x] T012 改造 `POST /api/decision` 编排流程。
  - 文件：`app/api/decision/route.ts`
  - 内容：在原有输入校验后，依次执行地点提取、地图路线查询、路线增强决策；保持响应契约 `status/message/maxInputChars` 不变。
  - 依赖：T007、T008、T009、T010、T011
  - 验证：路由测试覆盖完整成功路径，返回文本包含“路线对比”和“我的建议”。

- [x] T013 实现地点异常和跨城/过远提示。
  - 文件：`app/api/decision/route.ts`、`lib/map-routing/amap-client.ts`
  - 内容：地点无法识别、歧义、疑似不在同城或距离过远时返回 `needs_clarification`，提示用户确认地点或补充城市/区域。
  - 依赖：T012
  - 验证：路由测试覆盖缺少 A/B/C、同名地点歧义、跨城或异常远距离。

- [x] T014 实现地图失败降级策略。
  - 文件：`app/api/decision/route.ts`、`lib/decision-model/*`
  - 内容：地图客户端返回 `unavailable` 时，调用模型生成常识建议，并在回复中明确说明未获取到地图导航数据。
  - 依赖：T012
  - 验证：路由测试覆盖高德超时、Key 错误、服务不可用；响应不泄露内部错误。

### 阶段 E：前端体验微调

- [x] T015 更新加载文案。
  - 文件：`app/page.tsx`、`components/DecisionResponse.tsx` 或相关组件
  - 内容：将提交后的等待提示调整为“正在查询路线并生成建议”或同等中文表达。
  - 依赖：T012
  - 验证：组件测试确认加载态文案正确；默认输入示例保持不变。

- [x] T016 验证纯文本路线对比在手机端可读。
  - 文件：`app/globals.css`、`components/DecisionResponse.tsx`
  - 内容：确保长行换行正常，不产生横向滚动；不引入 Markdown 表格渲染或地图组件。
  - 依赖：T015
  - 验证：端到端测试覆盖手机视口下的路线对比展示。

### 阶段 F：测试、冒烟与文档收尾

- [x] T017 补充单元测试。
  - 文件：`tests/unit/*`
  - 内容：覆盖地图类型、格式化、高德解析、地图客户端工厂、模型地点提取、路线增强 prompt 和降级逻辑。
  - 依赖：T003、T004、T005、T006、T007、T008、T009、T010、T011、T014
  - 验证：`npm test` 通过。

- [x] T018 更新端到端测试。
  - 文件：`tests/e2e/decision-flow.spec.ts`
  - 内容：覆盖成功路线对比、地点不明确、地图失败降级、手机视口展示、默认输入示例不变。
  - 依赖：T015、T016、T017
  - 验证：`npm run test:e2e` 通过。

- [x] T019 执行本地完整验证。
  - 文件：无
  - 内容：运行 lint、单元测试、生产构建、端到端测试。
  - 依赖：T018
  - 验证：`npm run lint`、`npm test`、`npm run build`、`npm run test:e2e` 全部通过。

- [x] T020 执行真实高德冒烟测试。
  - 文件：无
  - 内容：在配置 `MAP_PROVIDER=amap` 和 `AMAP_WEB_SERVICE_KEY` 后，用真实同城 A/B/C 请求验证路线数据返回。
  - 依赖：T019
  - 验证：接口返回包含真实路线对比、优缺点分析和“我的建议”；失败时返回可理解中文提示。

- [x] T021 更新 SDD 验收记录。
  - 文件：`specs/002-distance-aware-decision/tasks.md`
  - 内容：记录 lint、测试、构建、e2e、真实高德冒烟测试结果。
  - 依赖：T020
  - 验证：任务清单和验收记录与实际结果一致。

## 4. 依赖关系

```text
T001 → T002 → T003
T002 + T003 → T004
T001 + T002 → T005 → T006
T004 + T006 → T007

T002 → T008 → T009
T008 → T010 → T011

T007 + T009 + T010 + T011 → T012
T012 → T013
T012 → T014
T012 → T015 → T016

T003 + T004 + T005 + T006 + T007 + T008 + T009 + T010 + T011 + T014 → T017
T016 + T017 → T018 → T019 → T020 → T021
```

## 5. 验收映射

| 规格项 | 主要任务 | 通过条件 |
| --- | --- | --- |
| 接入高德地图导航数据 | T005、T006、T007、T020 | 真实高德 Key 下可获取 A→B、A→C 路线数据。 |
| 轻量对比表 | T003、T011、T012、T018 | 回复中出现短行路线对比，不使用复杂表格或卡片。 |
| 四种交通方式 | T006、T003、T017 | 公交/地铁、驾车/打车、骑行、步行可用则展示。 |
| 步行超过 30 分钟可省略 | T003、T006、T017 | 超过阈值的步行路线不作为主要交通方式展示。 |
| 理性分析优缺点 | T011、T012、T018 | 回复分别说明两个目的地优缺点，并给出建议。 |
| 游客评价不调用外部工具 | T011、T012 | 除高德地图外不新增点评、搜索或评论 API。 |
| 地点异常引导确认 | T010、T013、T018 | 地点缺失、歧义、跨城或距离过远时返回补充提示。 |
| 地图失败可降级 | T014、T018 | 明确说明未获取到地图导航数据，并给出常识建议。 |
| 默认输入示例不改 | T015、T018 | 页面默认示例与上一版本保持一致。 |

## 6. 实现完成定义

只有在 T001–T021 完成且以下条件全部满足时，才可将本规格标记为“已实现”：

- 用户能提交一段中文 A/B/C 决策描述；
- 服务端能在高德 Key 可用时查询真实路线数据；
- 回复以纯文本轻量对比表展示 B/C 的交通方式和预计时间；
- 回复能理性分析两个目的地优缺点，并给出明确建议；
- 步行超过 30 分钟时不会在主要路线表中强行展示；
- 地点无法识别、歧义、跨城或距离过远时能提示用户核对；
- 地图失败时能降级，并明确说明未获取到地图导航数据；
- 前端不暴露高德 Key 或模型 Key；
- 不保存用户输入、回复、经纬度或路线结果；
- `npm run lint`、`npm test`、`npm run build`、`npm run test:e2e` 全部通过；
- 真实高德冒烟测试通过。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 2026-07-19 | `npm run lint` | 通过 |
| 2026-07-19 | `npm test` | 通过：7 个测试文件，29 条单元/路由/组件测试 |
| 2026-07-19 | `npm run build` | 通过：Next.js 生产构建成功 |
| 2026-07-19 | `npm run test:e2e` | 通过：桌面 Chrome 与手机 Chrome 视口共 8 条端到端测试 |
| 2026-07-19 | 高德真实路线冒烟测试 | 通过：杭州西湖→灵隐寺/岳王庙返回真实路线对比与“我的建议” |
