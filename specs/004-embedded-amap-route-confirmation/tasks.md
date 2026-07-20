# 实施任务：旅行内嵌高德路线确认区

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `004-embedded-amap-route-confirmation/spec.md` |
| 对应方案 | `004-embedded-amap-route-confirmation/plan.md` |
| 版本 | 0.4（已实现并完成验收） |
| 阶段 | Tasks |
| 状态 | 已实现并通过本地验证、线上手机端冒烟 |

## 2. 实施约束

- 本期只影响旅行模块，不改动日常模块行为。
- 本期内嵌高德 URI/H5 路线页，不使用高德 JS API 自绘地图。
- 前端不暴露高德 Web Service Key。
- AI 建议和内嵌高德页面尽量使用同一组高德坐标。
- 页面必须说明实际导航以高德为准。
- 内嵌区默认折叠。
- 默认交通方式为公共交通。
- 不展示置信度。
- 不接受降级实现；若 iframe 无法稳定内嵌，则停止实现并重新讨论。
- 不接入小红书。
- 不保存用户输入、路线或导航记录。

## 3. 任务清单

### 阶段 A：确认与可行性验证

- [x] T001 确认产品待定项。
  - 文件：`specs/004-embedded-amap-route-confirmation/spec.md`
  - 内容：确认默认折叠、默认公共交通、不接受降级、不展示置信度、移动端高度约 560px。
  - 验证：规格验收清单全部勾选。

- [x] T002 完成高德 iframe 可行性 spike。
  - 文件：临时 Playwright 脚本与截图，不进入正式功能代码。
  - 内容：用高德 URI `navigation` 和高德移动 H5 URL 在 iframe 中测试路线页；验证桌面 UA、移动 UA、公共交通/驾车/步行/骑行。
  - 依赖：T001
  - 验证：移动端 UA 通过；桌面 UA 不满足目标界面，需用户确认是否接受仅手机端继续。

- [x] T003 确认是否限定手机端实现。
  - 文件：`specs/004-embedded-amap-route-confirmation/spec.md`、`plan.md`
  - 内容：确认桌面端是否暂不展示内嵌高德路线区；确认本规格是否以手机端为目标继续开发。
  - 依赖：T002
  - 验证：用户明确确认后才进入正式开发。

### 阶段 B：响应契约与后端路线确认数据

- [x] T004 定义 `RouteConfirmation` 类型。
  - 文件：建议 `lib/route-confirmation/types.ts`
  - 内容：定义 origin、candidates、availableModes、defaultCandidateId、defaultMode、notice。
  - 依赖：T003
  - 验证：TypeScript 类型可被 API 和前端复用。

- [x] T005 扩展旅行 API 响应类型。
  - 文件：`app/page.tsx` 或独立共享类型文件
  - 内容：`DecisionApiResponse` 增加可选 `routeConfirmation`。
  - 依赖：T004
  - 验证：日常响应不受影响，旅行旧字段保持兼容。

- [x] T006 扩展地图路线内部数据，保留高德坐标。
  - 文件：`lib/map-routing/types.ts`、`lib/map-routing/amap-client.ts`
  - 内容：RouteSummary 或 CandidateRouteSummary 增加起终点 location。
  - 依赖：T004
  - 验证：不返回原始高德 JSON，不暴露 Key。

- [x] T007 实现可用交通方式提取。
  - 文件：建议 `lib/route-confirmation/build-route-confirmation.ts`
  - 内容：从 RouteSummary 中整理每个候选目的地的 `availableModes`。
  - 依赖：T006
  - 验证：不可用交通方式不进入按钮列表。

- [x] T008 实现默认目的地和默认交通方式选择。
  - 文件：建议 `lib/route-confirmation/build-route-confirmation.ts`
  - 内容：默认目的地按路线综合更优或第一个候选；默认交通方式优先公共交通，公共交通不可用时选择下一可用方式。
  - 依赖：T007
  - 验证：有公交优先公交；公交不可用时选择下一可用方式。

- [x] T009 在 `/api/decision` 成功响应中返回 `routeConfirmation`。
  - 文件：`app/api/decision/route.ts`
  - 内容：仅在地图路线成功时返回；地图失败降级时不返回。
  - 依赖：T006、T007、T008
  - 验证：路由测试覆盖 success/clarification/fallback。

### 阶段 C：高德 URL 与前端组件

- [x] T010 实现高德 URI URL 构造。
  - 文件：建议 `lib/route-confirmation/amap-uri.ts`
  - 内容：生成 iframe URL 和打开导航 URL；正确编码坐标、名称、交通方式、`callnative`。
  - 依赖：T004
  - 验证：单测覆盖各交通方式和中文地名。

- [x] T011 新增 `AmapRouteConfirmation` 组件。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：默认折叠；展开后展示标题、说明、目的地 tabs、交通方式 tabs、iframe、打开高德按钮。
  - 依赖：T004、T010
  - 验证：组件测试覆盖渲染、展开与切换。

- [x] T012 实现 iframe 运行时异常提示。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：加载状态、超时提示、重试入口；该提示仅处理网络/运行时异常，不作为产品降级方案。
  - 依赖：T011
  - 验证：测试模拟超时后显示重试提示。

- [x] T013 接入旅行结果页。
  - 文件：`app/page.tsx`
  - 内容：旅行成功且有 `routeConfirmation` 时渲染确认区；日常不展示。
  - 依赖：T005、T009、T012
  - 验证：切换日常/旅行时不会串状态。

### 阶段 D：样式与移动端

- [x] T014 添加路线确认区样式。
  - 文件：`app/globals.css`
  - 内容：折叠卡片、tabs、iframe、按钮、运行时异常提示、移动端高度约 560px。
  - 依赖：T011
  - 验证：手机视口无横向滚动。

- [x] T015 优化可访问性。
  - 文件：`components/AmapRouteConfirmation.tsx`
  - 内容：展开按钮、tabs/button aria 状态；iframe title；外链按钮可读。
  - 依赖：T011
  - 验证：Playwright 可通过 role/name 定位核心控件。

### 阶段 E：测试、验证与上线

- [x] T016 补充单元测试。
  - 文件：`tests/unit/*`
  - 内容：类型构造、URL 构造、默认公共交通、组件折叠/展开、组件切换、运行时异常提示。
  - 依赖：T008、T010、T012
  - 验证：`npm test -- --run` 通过。

- [x] T017 补充路由测试。
  - 文件：`tests/unit/decision-route.test.ts`
  - 内容：旅行成功返回 routeConfirmation；clarification/fallback 不返回。
  - 依赖：T009
  - 验证：原旅行能力不回归。

- [x] T018 更新 E2E 测试。
  - 文件：`tests/e2e/decision-flow.spec.ts`
  - 内容：旅行结果展示折叠的高德确认区、展开 iframe、切换目的地/交通方式、打开高德链接、日常不展示。
  - 依赖：T013、T014、T015
  - 验证：`npm run test:e2e` 通过。

- [x] T019 执行本地完整验证。
  - 文件：无
  - 内容：运行 lint、单元测试、构建、E2E。
  - 依赖：T016、T017、T018
  - 验证：`npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过。

- [x] T020 执行线上冒烟测试。
  - 文件：无
  - 内容：使用真实旅行样例验证 AI 建议、内嵌高德路线区、打开高德链接。
  - 依赖：T019
  - 验证：`https://nxvd.beer` 线上旅行模块可用。

- [x] T021 更新 SDD 验收记录。
  - 文件：`specs/004-embedded-amap-route-confirmation/tasks.md`
  - 内容：记录手机端范围确认、本地验证、线上冒烟、已知限制。
  - 依赖：T020
  - 验证：任务清单与实际结果一致。

## 4. 依赖关系

```text
T001 → T002 → T003
T003 → T004 → T005
T004 → T006 → T007 → T008 → T009
T004 → T010 → T011 → T012
T005 + T009 + T012 → T013
T011 → T014 → T015
T008 + T010 + T012 → T016
T009 → T017
T013 + T014 + T015 → T018 → T019 → T020 → T021
```

## 5. 验收映射

| 规格项 | 主要任务 | 通过条件 |
| --- | --- | --- |
| 可嵌入性先验验证 | T002、T003 | 手机端可嵌入已验证，需确认是否限定手机端继续。 |
| 内嵌高德路线页 | T010、T011、T013、T018 | 旅行成功结果展示默认折叠的高德路线确认区，展开后显示 iframe。 |
| 一键跳转高德导航 | T010、T011、T018 | 按钮链接使用当前目的地和交通方式。 |
| 同坐标一致性策略 | T006、T009、T010 | AI 结论和高德链接均基于同一组高德坐标。 |
| 差异说明 | T011、T015 | 页面明确“实际导航以高德为准”。 |
| 默认公共交通 | T008、T010、T018 | 默认 mode 为公共交通，公共交通不可用时才选择下一可用方式。 |
| 不展示置信度 | T011、T018 | 页面不出现置信度等级或百分比。 |
| 不影响日常 | T013、T018 | 日常模块不展示路线确认区。 |

## 6. 实现完成定义

只有在 T001–T021 完成且以下条件全部满足时，才可标记为“已实现”：

- 高德路线页 iframe 可行性已验证通过；
- 用户确认接受本功能按手机端范围继续；
- 用户在旅行结果中看到 AI 建议和默认折叠的高德路线确认区；
- 用户可展开内嵌高德路线；
- 用户可切换两个候选目的地；
- 用户可切换可用交通方式；
- 默认交通方式为公共交通；
- 用户可点击打开高德地图导航；
- 页面说明实际导航以高德为准；
- 不展示置信度；
- 日常模块不受影响；
- 前端不暴露高德 Web Service Key；
- 不接入小红书；
- `npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全部通过；
- 线上旅行冒烟通过。

## 7. 验收记录

| 日期 | 项目 | 结果 |
| --- | --- | --- |
| 2026-07-20 | 用户确认待定项 | 已确认：默认折叠、公共交通、不接受降级、不展示置信度、移动端高度约 560px |
| 2026-07-20 | 高德 iframe 可行性 spike | 移动端通过；桌面端不满足目标界面 |
| 2026-07-20 | 用户确认手机端范围 | 已确认：仅手机端即可 |
| 2026-07-20 | `npm run lint` | 通过 |
| 2026-07-20 | `npm test -- --run` | 通过，10 个测试文件、46 个测试用例 |
| 2026-07-20 | `npm run build` | 通过 |
| 2026-07-20 | `npm run test:e2e` | 通过，Chromium 与 mobile-chrome 共 12 个用例 |
| 2026-07-20 | 线上 API 冒烟测试 | 通过，`https://nxvd.beer/api/decision` 返回 `status: success` 与 `routeConfirmation` |
| 2026-07-20 | 线上手机端旅行冒烟测试 | 通过，移动端可展开高德路线确认区，iframe 指向高德移动公交路线页，外链指向高德导航 URI |

## 8. 已知限制

- 本期仅手机端展示高德路线确认区；桌面端暂不展示。
- 内嵌区使用高德移动 H5 路线页，实际路线详情、实时交通和导航启动以高德页面/客户端为准。
- 旅游评价仍使用模型已有知识，不接入小红书或其他外部评价数据源。
