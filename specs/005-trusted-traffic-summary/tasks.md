# 实施任务：旅行可信交通摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `005-trusted-traffic-summary/spec.md` |
| 对应方案 | `005-trusted-traffic-summary/plan.md` |
| 版本 | 0.3（已实现并完成验收） |
| 阶段 | Tasks |
| 状态 | 已实现并通过本地验证、线上冒烟 |

## 2. 实施约束

- 本期只调整旅行模块交通展示，不影响日常模块。
- 不再内嵌高德 iframe。
- 继续使用高德 Web Service 作为交通数据源。
- 前端不暴露高德 Web Service Key。
- AI 不能编造地图未返回的交通时间、距离、换乘、步行距离。
- 游客评价暂时仍使用模型已有知识，不接入外部评价源。
- 不展示置信度百分比或等级。
- 交通数据异常时先提示用户确认地点。
- 默认交通方式为公共交通。
- 每个候选目的地的每种可用交通方式都提供高德核验链接。
- 公共交通展示具体线路名。
- 交通摘要展示在 AI 建议之前。
- 本期直接删除旧内嵌高德组件和相关代码。
- 手机端优先，兼容桌面基础展示。

## 3. 任务清单

### 阶段 A：规格确认

- [x] T001 用户确认待定产品问题。
  - 文件：`specs/005-trusted-traffic-summary/spec.md`
  - 内容：确认地图失败策略、核验链接粒度、展示顺序、线路名、旧组件处理。
  - 验证：产品决策全部有明确答案。

- [x] T002 更新 SDD 文档到确认态。
  - 文件：`spec.md`、`plan.md`、`tasks.md`
  - 内容：移除草案标记，更新版本与状态。
  - 依赖：T001
  - 验证：三份文档状态一致。

### 阶段 B：交通摘要数据层

- [x] T003 新增 `traffic-summary` 类型。
  - 文件：`lib/traffic-summary/types.ts`
  - 内容：定义 `TrafficSummary`、`TrafficSummaryCandidate`、`TrafficRouteItem`、`TrafficInsight`。
  - 依赖：T002
  - 验证：API 和前端可复用类型。

- [x] T004 新增高德核验 URL 构造。
  - 文件：`lib/traffic-summary/amap-verification-url.ts`
  - 内容：生成 `uri.amap.com/navigation` 链接，支持公交/驾车/步行/骑行，`callnative=1`。
  - 依赖：T003
  - 验证：单测覆盖中文地名、坐标和 mode；每个候选目的地的每种可用交通方式都有独立链接。

- [x] T005 增强地图路线摘要字段。
  - 文件：`lib/map-routing/types.ts`、`lib/map-routing/amap-client.ts`
  - 内容：补充公共交通线路名、换乘次数、步行距离；保留现有 duration/distance。
  - 依赖：T003
  - 验证：真实或 mock 数据可生成交通摘要。

- [x] T006 实现 `buildTrafficSummary`。
  - 文件：`lib/traffic-summary/build-traffic-summary.ts`
  - 内容：将 `RouteSummary` 转为前端展示用 `TrafficSummary`。
  - 依赖：T003、T004、T005
  - 验证：候选卡片、默认公共交通、步行规则正确。

- [x] T007 实现交通判断依据算法。
  - 文件：`lib/traffic-summary/traffic-insight.ts`
  - 内容：输出明显更方便、略微更方便、差异不大、数据不足四类判断。
  - 依赖：T006
  - 验证：阈值场景单测通过。

### 阶段 C：API 与模型约束

- [x] T008 更新旅行 API 成功响应。
  - 文件：`app/api/decision/route.ts`
  - 内容：成功时返回 `trafficSummary`，停止返回或停止使用 `routeConfirmation`。
  - 依赖：T006、T007
  - 验证：路由测试覆盖 success。

- [x] T009 强化模型 prompt 交通事实约束。
  - 文件：`lib/decision-model/siliconflow-client.ts`、`lib/decision-model/mock-client.ts`
  - 内容：明确模型只能引用高德路线摘要中的交通数字。
  - 依赖：T006
  - 验证：测试断言 prompt 或 mock 输出不编造路线数据。

- [x] T010 更新地图异常处理。
  - 文件：`app/api/decision/route.ts`、`lib/place-sanity.ts`、`lib/map-routing/*`
  - 内容：占位符、地点不可识别、不在同城、距离过远、任一候选地点导航失败或关键路线缺失时返回补充提示。
  - 依赖：T008
  - 验证：路由测试覆盖异常分支。

### 阶段 D：前端展示

- [x] T011 新增 `TrafficSummaryCard` 组件。
  - 文件：`components/TrafficSummaryCard.tsx`
  - 内容：展示数据来源、候选卡片、路线项、公共交通线路名、交通判断、每种交通方式的高德核验链接。
  - 依赖：T003
  - 验证：组件测试覆盖核心渲染。

- [x] T012 替换旅行结果中的内嵌高德组件。
  - 文件：`app/page.tsx`
  - 内容：旅行成功且有 `trafficSummary` 时展示 `TrafficSummaryCard`；不再渲染 `AmapRouteConfirmation`。
  - 依赖：T008、T011
  - 验证：页面不出现 iframe。

- [x] T013 更新样式。
  - 文件：`app/globals.css`
  - 内容：移动端友好的交通卡片、路线行、来源说明、判断依据、高德链接按钮。
  - 依赖：T011
  - 验证：手机视口无横向滚动，信息层级清晰。

- [x] T014 处理旧内嵌代码。
  - 文件：`components/AmapRouteConfirmation.tsx`、`lib/route-confirmation/*`
  - 内容：删除旧内嵌高德组件、route-confirmation 相关工具与测试引用。
  - 依赖：T012
  - 验证：无未使用导入或测试残留。

### 阶段 E：测试与上线

- [x] T015 补充单元测试。
  - 文件：`tests/unit/*`
  - 内容：traffic summary、traffic insight、URL 构造、异常策略。
  - 依赖：T006、T007、T010
  - 验证：`npm test -- --run` 通过。

- [x] T016 更新组件测试。
  - 文件：`tests/unit/components.test.tsx`
  - 内容：交通摘要卡片、来源说明、判断依据、高德链接、不渲染 iframe。
  - 依赖：T011、T012
  - 验证：组件测试通过。

- [x] T017 更新 E2E 测试。
  - 文件：`tests/e2e/decision-flow.spec.ts`
  - 内容：旅行成功展示交通对比；不展示高德 iframe；高德核验链接存在；日常不展示。
  - 依赖：T012、T013
  - 验证：`npm run test:e2e` 通过。

- [x] T018 执行本地完整验证。
  - 文件：无
  - 内容：运行 lint、单元测试、构建、E2E。
  - 依赖：T015、T016、T017
  - 验证：`npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过。

- [x] T019 提交并推送到 GitHub。
  - 文件：无
  - 内容：按用户既定偏好，完成后推送 main，触发 Vercel 自动部署。
  - 依赖：T018
  - 验证：GitHub main 包含本期改动。

- [x] T020 线上冒烟测试。
  - 文件：无
  - 内容：使用真实旅行样例验证线上域名。
  - 依赖：T019
  - 验证：`https://nxvd.beer` 可看到交通对比、来源说明、高德核验链接，不出现内嵌 iframe。

- [x] T021 更新 SDD 验收记录。
  - 文件：`specs/005-trusted-traffic-summary/tasks.md`
  - 内容：记录本地验证、线上冒烟和已知限制。
  - 依赖：T020
  - 验证：任务清单与实际结果一致。

## 4. 依赖关系

```text
T001 → T002
T002 → T003 → T004 → T005 → T006 → T007
T006 + T007 → T008 → T009 → T010
T003 + T008 → T011 → T012 → T013 → T014
T006 + T007 + T010 → T015
T011 + T012 → T016 → T017 → T018 → T019 → T020 → T021
```

## 5. 验收映射

| 规格项 | 主要任务 | 通过条件 |
| --- | --- | --- |
| 结构化交通摘要 | T003、T006、T011、T012 | 旅行成功展示交通对比卡片 |
| 高德数据来源说明 | T006、T011 | 页面显示高德地图路线数据来源 |
| AI 不编造路线数字 | T009、T015 | Prompt 和测试覆盖交通事实约束 |
| 高德核验跳转 | T004、T011、T017 | 每个候选目的地的每种可用交通方式都可打开高德路线 |
| 不内嵌 iframe | T012、T014、T017 | 页面不渲染高德 iframe |
| 异常拦截 | T010、T015 | 地点/路线异常时提示补充 |
| 不影响日常 | T012、T017 | 日常模块不展示交通摘要 |

## 6. 实现完成定义

只有在 T001–T021 完成且以下条件全部满足时，才可标记为“已实现”：

- 用户确认全部产品决策；
- 旅行成功结果展示结构化交通摘要；
- 页面明确说明交通数据来自高德地图路线数据；
- AI 建议中交通数字不超出高德返回数据；
- 每个候选目的地的每种可用交通方式可跳转高德核验；
- 页面不展示内嵌高德 iframe；
- 地点或路线异常时先提示用户确认；
- 日常模块不受影响；
- `npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过；
- 线上冒烟通过。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 2026-07-20 | 用户确认产品决策 | 已确认：地点导航有一个失败即提示核实地点；每种交通方式提供高德核验链接；交通摘要在 AI 建议前；展示公共交通线路名；删除旧 iframe 代码 |
| 2026-07-20 | `npm run lint` | 通过 |
| 2026-07-20 | `npm test -- --run` | 通过，10 个测试文件、49 个测试用例 |
| 2026-07-20 | `npm run build` | 通过 |
| 2026-07-20 | `npm run test:e2e` | 通过，Chromium 与 mobile-chrome 共 12 个用例 |
| 2026-07-20 | GitHub 推送 | 通过，提交 `71f8a85` 已推送到 `main` |
| 2026-07-20 | 线上 API 冒烟测试 | 通过，`https://nxvd.beer/api/decision` 返回 `trafficSummary`，不再返回旧 `routeConfirmation` |
| 2026-07-20 | 线上手机端页面冒烟测试 | 通过，显示交通对比、来源说明、交通判断和 8 个高德查看链接；页面 iframe 数量为 0 |

## 8. 已知限制

- 交通摘要依赖高德 Web Service 返回的数据；实时导航、拥堵和最终路线以高德为准。
- 游客评价仍基于模型已有知识，不接入小红书或其他实时评价源。
- 本期只支持两个候选目的地；多目的地排序留待后续版本。
