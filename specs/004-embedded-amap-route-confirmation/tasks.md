# 实施任务：旅行内嵌高德路线确认区

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `004-embedded-amap-route-confirmation/spec.md` |
| 对应方案 | `004-embedded-amap-route-confirmation/plan.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Tasks |
| 状态 | 草案，待确认 |

## 2. 实施约束

- 本期只影响旅行模块，不改动日常模块行为。
- 本期内嵌高德 URI/H5 路线页，不使用高德 JS API 自绘地图。
- 前端不暴露高德 Web Service Key。
- AI 建议和内嵌高德页面尽量使用同一组高德坐标。
- 页面必须说明实际导航以高德为准。
- iframe 不可用时必须有 fallback。
- 不接入小红书。
- 不保存用户输入、路线或导航记录。

## 3. 任务清单

### 阶段 A：确认与响应契约

- [ ] T001 确认产品待定项。
  - 文件：`specs/004-embedded-amap-route-confirmation/spec.md`
  - 内容：确认默认展开/折叠、默认交通方式、iframe fallback、置信度、移动端高度。
  - 验证：规格验收清单全部勾选。

- [ ] T002 定义 `RouteConfirmation` 类型。
  - 文件：建议 `lib/route-confirmation/types.ts`
  - 内容：定义 origin、candidates、availableModes、defaultCandidateId、defaultMode、confidence、notice。
  - 依赖：T001
  - 验证：TypeScript 类型可被 API 和前端复用。

- [ ] T003 扩展旅行 API 响应类型。
  - 文件：`app/page.tsx` 或独立共享类型文件
  - 内容：`DecisionApiResponse` 增加可选 `routeConfirmation`。
  - 依赖：T002
  - 验证：日常响应不受影响，旅行旧字段保持兼容。

### 阶段 B：后端路线确认数据

- [ ] T004 扩展地图路线内部数据，保留高德坐标。
  - 文件：`lib/map-routing/types.ts`、`lib/map-routing/amap-client.ts`
  - 内容：RouteSummary 或 CandidateRouteSummary 增加起终点 location。
  - 依赖：T002
  - 验证：不返回原始高德 JSON，不暴露 Key。

- [ ] T005 实现可用交通方式提取。
  - 文件：建议 `lib/route-confirmation/build-route-confirmation.ts`
  - 内容：从 RouteSummary 中整理每个候选目的地的 `availableModes`。
  - 依赖：T004
  - 验证：不可用交通方式不进入按钮列表。

- [ ] T006 实现默认目的地和默认交通方式选择。
  - 文件：建议 `lib/route-confirmation/build-route-confirmation.ts`
  - 内容：按确认后的规则选择 `defaultCandidateId` 和 `defaultMode`。
  - 依赖：T005
  - 验证：有公交优先公交；公交不可用时选择下一可用方式。

- [ ] T007 实现置信度计算。
  - 文件：建议 `lib/route-confirmation/confidence.ts`
  - 内容：根据路线完整度和时间差异生成 high/medium/low 与原因。
  - 依赖：T005
  - 验证：单测覆盖三种等级。

- [ ] T008 在 `/api/decision` 成功响应中返回 `routeConfirmation`。
  - 文件：`app/api/decision/route.ts`
  - 内容：仅在地图路线成功时返回；地图失败降级时不返回。
  - 依赖：T004、T005、T006、T007
  - 验证：路由测试覆盖 success/clarification/fallback。

### 阶段 C：高德 URL 与前端组件

- [ ] T009 实现高德 URI URL 构造。
  - 文件：建议 `lib/route-confirmation/amap-uri.ts`
  - 内容：生成 iframe URL 和打开导航 URL；正确编码坐标、名称、交通方式、`callnative`。
  - 依赖：T002
  - 验证：单测覆盖各交通方式和中文地名。

- [ ] T010 新增 `AmapRouteConfirmation` 组件。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：展示标题、说明、置信度、目的地 tabs、交通方式 tabs、iframe、打开高德按钮。
  - 依赖：T002、T009
  - 验证：组件测试覆盖渲染与切换。

- [ ] T011 实现 iframe 加载与 fallback。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：加载状态、超时提示、保留打开高德按钮。
  - 依赖：T010
  - 验证：测试模拟超时后显示 fallback。

- [ ] T012 接入旅行结果页。
  - 文件：`app/page.tsx`
  - 内容：旅行成功且有 `routeConfirmation` 时渲染确认区；日常不展示。
  - 依赖：T003、T010、T011
  - 验证：切换日常/旅行时不会串状态。

### 阶段 D：样式与移动端

- [ ] T013 添加路线确认区样式。
  - 文件：`app/globals.css`
  - 内容：卡片、tabs、iframe、按钮、fallback、移动端高度。
  - 依赖：T010
  - 验证：手机视口无横向滚动。

- [ ] T014 优化可访问性。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：tabs/button aria 状态；iframe title；外链按钮可读。
  - 依赖：T010
  - 验证：Playwright 可通过 role/name 定位核心控件。

### 阶段 E：测试、验证与上线

- [ ] T015 补充单元测试。
  - 文件：`tests/unit/*`
  - 内容：类型构造、置信度、URL 构造、组件切换、fallback。
  - 依赖：T007、T009、T011
  - 验证：`npm test -- --run` 通过。

- [ ] T016 补充路由测试。
  - 文件：`tests/unit/decision-route.test.ts`
  - 内容：旅行成功返回 routeConfirmation；clarification/fallback 不返回。
  - 依赖：T008
  - 验证：原旅行能力不回归。

- [ ] T017 更新 E2E 测试。
  - 文件：`tests/e2e/decision-flow.spec.ts`
  - 内容：旅行结果展示高德确认区、切换目的地/交通方式、打开高德链接、日常不展示。
  - 依赖：T012、T013、T014
  - 验证：`npm run test:e2e` 通过。

- [ ] T018 执行本地完整验证。
  - 文件：无
  - 内容：运行 lint、单元测试、构建、E2E。
  - 依赖：T015、T016、T017
  - 验证：`npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过。

- [ ] T019 执行线上冒烟测试。
  - 文件：无
  - 内容：使用真实旅行样例验证 AI 建议、内嵌高德路线区、打开高德链接。
  - 依赖：T018
  - 验证：`https://nxvd.beer` 线上旅行模块可用。

- [ ] T020 更新 SDD 验收记录。
  - 文件：`specs/004-embedded-amap-route-confirmation/tasks.md`
  - 内容：记录本地验证、线上冒烟、已知限制。
  - 依赖：T019
  - 验证：任务清单与实际结果一致。

## 4. 依赖关系

```text
T001 → T002 → T003
T002 → T004 → T005 → T006
T005 → T007
T004 + T006 + T007 → T008
T002 → T009 → T010 → T011
T003 + T008 + T011 → T012
T010 → T013 → T014
T007 + T009 + T011 → T015
T008 → T016
T012 + T013 + T014 → T017 → T018 → T019 → T020
```

## 5. 验收映射

| 规格项 | 主要任务 | 通过条件 |
| --- | --- | --- |
| 内嵌高德路线页 | T009、T010、T012、T017 | 旅行成功结果展示高德路线确认区。 |
| 一键跳转高德导航 | T009、T010、T017 | 按钮链接使用当前目的地和交通方式。 |
| 同坐标一致性策略 | T004、T008、T009 | AI 结论和高德链接均基于同一组高德坐标。 |
| 差异说明 | T010、T014 | 页面明确“实际导航以高德为准”。 |
| iframe fallback | T011、T017 | iframe 不可用时仍能打开高德。 |
| 置信度 | T007、T010、T015 | 展示 high/medium/low 和原因。 |
| 不影响日常 | T012、T017 | 日常模块不展示路线确认区。 |

## 6. 实现完成定义

只有在 T001–T020 完成且以下条件全部满足时，才可标记为“已实现”：

- 用户在旅行结果中看到 AI 建议和高德路线确认区；
- 用户可切换两个候选目的地；
- 用户可切换可用交通方式；
- 内嵌区使用高德 URI/H5 路线页；
- 用户可点击打开高德地图导航；
- 页面说明实际导航以高德为准；
- iframe 不可用时有 fallback；
- 日常模块不受影响；
- 前端不暴露高德 Web Service Key；
- 不接入小红书；
- `npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过；
- 线上旅行冒烟通过。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 待执行 | 用户确认待定项 | 待执行 |
| 待执行 | `npm run lint` | 待执行 |
| 待执行 | `npm test -- --run` | 待执行 |
| 待执行 | `npm run build` | 待执行 |
| 待执行 | `npm run test:e2e` | 待执行 |
| 待执行 | 线上旅行冒烟测试 | 待执行 |
