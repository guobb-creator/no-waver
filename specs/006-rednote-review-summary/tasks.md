# 实施任务：旅行小红书帖子摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `006-rednote-review-summary/spec.md` |
| 对应方案 | `006-rednote-review-summary/plan.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Tasks |
| 状态 | 草案，待用户确认 |

## 2. 实施约束

- 本期保持 `005` 的高德交通摘要不变。
- 小红书数据通过第三方 API 获取，不使用官方小红书开放平台内容搜索。
- 第三方 API Key 仅服务端使用，前端不暴露。
- 每个目的地最多展示 3 篇高赞帖子。
- 摘要、浏览器预览、App 跳转必须绑定同一个 `noteId`。
- 搜索结果不直接用于摘要，必须拉取帖子详情。
- 模型不得编造帖子未出现的反馈。
- 小红书失败不阻塞高德交通摘要。
- 日常模块不受影响。

## 3. 任务清单

### 阶段 A：规格确认

- [ ] T001 用户确认待定产品问题。
  - 文件：`spec.md`
  - 内容：确认第三方 API 服务商、展示数量、互动数据、展示顺序、失败策略、链接格式。
  - 验证：待确认问题全部有明确答案。

- [ ] T002 更新 SDD 文档到确认态。
  - 文件：`spec.md`、`plan.md`、`tasks.md`
  - 内容：更新版本和状态，记录已确认产品决策。
  - 依赖：T001
  - 验证：三份文档状态一致。

### 阶段 B：Review Provider 数据层

- [ ] T003 新增 review 数据类型。
  - 文件：`lib/review-data/types.ts`
  - 内容：定义搜索结果、帖子详情、provider 接口。
  - 依赖：T002
  - 验证：API、mock、真实 provider 可复用类型。

- [ ] T004 新增 provider factory 与 mock client。
  - 文件：`lib/review-data/client-factory.ts`、`mock-client.ts`
  - 内容：支持 `REVIEW_PROVIDER=mock|rnote`，未配置时返回 disabled client。
  - 依赖：T003
  - 验证：单测覆盖配置选择。

- [ ] T005 实现第三方 API client。
  - 文件：`lib/review-data/rnote-client.ts` 或对应服务商 client
  - 内容：搜索高赞帖子、拉取帖子详情、字段映射、超时处理。
  - 依赖：T003、T004
  - 验证：mock fetch 单测覆盖成功和失败。

### 阶段 C：noteId 与链接一致性

- [ ] T006 实现 noteId 标准化与校验。
  - 文件：`lib/review-summary/rednote-links.ts`
  - 内容：解析 noteId、校验 webUrl、构造 browserUrl/appUrl。
  - 依赖：T003
  - 验证：单测覆盖 URL 解析和不一致丢弃。

- [ ] T007 实现帖子过滤。
  - 文件：`lib/review-summary/filter-notes.ts`
  - 内容：过滤无 noteId、无内容、低相关、广告/商品、noteId 不一致。
  - 依赖：T006
  - 验证：单测覆盖过滤规则。

### 阶段 D：摘要生成与 reviewSummary

- [ ] T008 扩展模型服务，支持单帖摘要。
  - 文件：`lib/decision-model/types.ts`、`siliconflow-client.ts`、`mock-client.ts`
  - 内容：新增 `summarizeReviewNote`；摘要 30–60 字，只基于单帖内容。
  - 依赖：T003
  - 验证：单测覆盖 prompt 约束和 mock 输出。

- [ ] T009 实现 `buildReviewSummary`。
  - 文件：`lib/review-summary/build-review-summary.ts`
  - 内容：每个目的地搜索候选、拉详情、过滤、摘要、最多 3 篇。
  - 依赖：T004、T005、T006、T007、T008
  - 验证：单测覆盖成功、不足 3 篇、全部失败。

- [ ] T010 扩展最终决策模型输入。
  - 文件：`lib/decision-model/types.ts`、`siliconflow-client.ts`
  - 内容：AI 可引用 reviewSummary，但不得编造小红书反馈。
  - 依赖：T009
  - 验证：测试覆盖有/无小红书摘要两种 prompt。

### 阶段 E：API 与前端

- [ ] T011 更新旅行 API 响应。
  - 文件：`app/api/decision/route.ts`
  - 内容：返回 `trafficSummary` 与可选 `reviewSummary`。
  - 依赖：T009、T010
  - 验证：路由测试覆盖成功和小红书失败。

- [ ] T012 新增 `ReviewSummaryCard` 组件。
  - 文件：`components/ReviewSummaryCard.tsx`
  - 内容：展示游客评价参考、目的地、帖子摘要、互动数据、浏览器预览、打开小红书。
  - 依赖：T009
  - 验证：组件测试覆盖核心渲染。

- [ ] T013 接入页面展示。
  - 文件：`app/page.tsx`
  - 内容：旅行成功时在 `TrafficSummaryCard` 后、`DecisionResponse` 前展示 `ReviewSummaryCard`。
  - 依赖：T011、T012
  - 验证：日常不展示，旅行按顺序展示。

- [ ] T014 更新样式。
  - 文件：`app/globals.css`
  - 内容：移动端友好的帖子卡片、摘要、双链接按钮。
  - 依赖：T012
  - 验证：手机视口无横向滚动。

### 阶段 F：测试与上线

- [ ] T015 补充单元测试。
  - 文件：`tests/unit/*`
  - 内容：provider、noteId、链接、过滤、summary、prompt。
  - 依赖：T003–T010
  - 验证：`npm test -- --run` 通过。

- [ ] T016 更新 E2E 测试。
  - 文件：`tests/e2e/decision-flow.spec.ts`
  - 内容：游客评价参考、每目的地帖子、浏览器预览、打开小红书、日常不展示。
  - 依赖：T011–T014
  - 验证：`npm run test:e2e` 通过。

- [ ] T017 执行本地完整验证。
  - 文件：无
  - 内容：lint、单元测试、构建、E2E。
  - 依赖：T015、T016
  - 验证：全部通过。

- [ ] T018 提交并推送到 GitHub。
  - 文件：无
  - 内容：推送 main，触发 Vercel 自动部署。
  - 依赖：T017
  - 验证：GitHub main 包含本期改动。

- [ ] T019 线上冒烟测试。
  - 文件：无
  - 内容：验证线上旅行模块展示小红书摘要与链接。
  - 依赖：T018
  - 验证：`https://nxvd.beer` 线上可用。

- [ ] T020 更新 SDD 验收记录。
  - 文件：`tasks.md`
  - 内容：记录本地验证、线上冒烟和已知限制。
  - 依赖：T019
  - 验证：任务清单与实际结果一致。

## 4. 依赖关系

```text
T001 → T002
T002 → T003 → T004 → T005
T003 → T006 → T007
T003 → T008
T004 + T005 + T006 + T007 + T008 → T009 → T010 → T011
T009 → T012 → T013 → T014
T003–T010 → T015
T011–T014 → T016 → T017 → T018 → T019 → T020
```

## 5. 验收映射

| 规格项 | 主要任务 | 通过条件 |
| --- | --- | --- |
| 每目的地 3 篇高赞帖 | T005、T009、T011 | 每个目的地最多展示 3 篇 |
| 单帖摘要 | T008、T009、T012 | 每篇帖子有一句摘要 |
| noteId 一致性 | T006、T007、T012 | 摘要、浏览器链接、App 链接绑定同一 noteId |
| 浏览器预览与 App 跳转 | T006、T012、T016 | 每篇帖子两个入口都存在 |
| 小红书失败不造假 | T010、T011、T015 | 失败时 AI 不引用小红书真实反馈 |
| 不影响交通摘要 | T011、T016 | 交通摘要仍正常展示 |
| 不影响日常 | T013、T016 | 日常模块不展示游客评价参考 |

## 6. 实现完成定义

只有在 T001–T020 完成且以下条件全部满足时，才可标记为“已实现”：

- 用户确认全部待定问题；
- 每个目的地最多展示 3 篇小红书高赞帖子；
- 每篇帖子摘要来自该 noteId 的详情内容；
- 每篇帖子提供浏览器预览和打开小红书；
- noteId 一致性校验通过；
- 小红书失败时不编造反馈；
- 高德交通摘要不受影响；
- 日常模块不受影响；
- 本地 lint、单测、构建、E2E 全部通过；
- 线上冒烟通过。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 待执行 | 用户确认待定问题 | 待执行 |
| 待执行 | 本地完整验证 | 待执行 |
| 待执行 | 线上冒烟测试 | 待执行 |
