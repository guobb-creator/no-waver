# 技术方案：旅行小红书帖子摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `006-rednote-review-summary/spec.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Plan |
| 状态 | 草案，待用户确认 |

## 2. 技术目标

在旅行模块现有高德交通摘要基础上，新增小红书游客评价摘要：

```text
RouteSummary + TrafficSummary
RednoteSearch + RednoteNoteDetail + NoteSummary
DecisionModel
```

核心技术目标：

1. 服务端接入第三方小红书数据 API；
2. 每个候选目的地搜索最多 3 篇高赞帖子；
3. 使用 `noteId` 拉详情；
4. 用模型生成单帖摘要；
5. API 返回 `reviewSummary`；
6. 前端展示帖子摘要、浏览器预览链接、App 跳转链接；
7. 模型最终建议只引用真实返回的小红书摘要。

## 3. 架构设计

```text
用户输入
  ↓
地点抽取
  ↓
高德路线查询 ──→ trafficSummary
  ↓
小红书 review provider
  ├─ destination B keyword search → noteIds
  ├─ destination B note detail → note content
  ├─ destination C keyword search → noteIds
  └─ destination C note detail → note content
  ↓
noteId 一致性校验
  ↓
单帖摘要生成
  ↓
reviewSummary
  ↓
模型最终决策
  ↓
前端：交通对比 + 游客评价参考 + 建议
```

## 4. Provider 抽象

新增：

```text
lib/review-data/types.ts
lib/review-data/client-factory.ts
lib/review-data/mock-client.ts
lib/review-data/rnote-client.ts
lib/review-summary/build-review-summary.ts
lib/review-summary/rednote-links.ts
```

接口建议：

```ts
type ReviewSearchInput = {
  cityHint?: string;
  destinationName: string;
  limit: number;
};

type ReviewSearchResult = {
  noteId: string;
  title?: string;
  webUrl?: string;
  likedCount?: number;
};

type ReviewNoteDetail = {
  noteId: string;
  title: string;
  content?: string;
  authorName?: string;
  likedCount?: number;
  collectedCount?: number;
  commentCount?: number;
  publishedAt?: string;
  webUrl?: string;
};

interface ReviewDataClient {
  searchTopNotes(input: ReviewSearchInput): Promise<ReviewSearchResult[]>;
  getNoteDetail(noteId: string): Promise<ReviewNoteDetail | undefined>;
}
```

环境变量建议：

```text
REVIEW_PROVIDER=mock | rnote
REDNOTE_API_KEY=...
REDNOTE_API_BASE_URL=...
```

## 5. noteId 一致性策略

### 5.1 标准化 noteId

新增 `normalizeRednoteId()`：

- 去掉空格；
- 支持从 URL 中解析 `/explore/{noteId}`；
- 支持从短链解析后的 URL 中提取 noteId（如果第三方已返回最终 URL）；
- 无法解析则丢弃。

### 5.2 链接构造

统一由系统构造：

```text
browserUrl = https://www.xiaohongshu.com/explore/{noteId}
appUrl = xhsdiscover://item/{noteId}
```

如果第三方返回的 `webUrl` 与 `noteId` 不一致：

- 优先丢弃；
- 或使用系统构造链接，不使用第三方链接。

本期推荐：丢弃不一致帖子。

## 6. 搜索与过滤

### 6.1 搜索关键词

```text
{cityHint} {destinationName} 游玩体验
```

如果 `cityHint` 缺失：

```text
{destinationName} 游玩体验
```

### 6.2 搜索数量

为确保过滤后仍有 3 篇有效帖子，建议每个目的地先搜索 8–10 条，再过滤和拉详情，最终展示 3 篇。

### 6.3 过滤规则

过滤：

- 无 `noteId`；
- 无标题且无正文；
- 与目的地名称不相关；
- 明显商品/带货/广告；
- `noteId` 与 `webUrl` 不一致；
- 详情接口失败。

## 7. 摘要生成

### 7.1 单帖摘要

新增模型方法：

```ts
summarizeReviewNote(note: ReviewNoteDetail): Promise<ReviewNoteSummary>
```

输出：

```json
{
  "summary": "这篇主要说灵隐寺氛围安静、适合祈福和拍照，但下午人流较多，需要预留排队时间。"
}
```

约束：

- 摘要 30–60 字；
- 只基于该帖标题和正文；
- 不输出 Markdown；
- 不生成“大家都说”；
- 内容不足时返回 `summaryUnavailable`。

### 7.2 最终建议

`decideWithRoutes()` 需要扩展为：

```ts
decideWithRoutesAndReviews(question, routeSummary, reviewSummary)
```

或保持方法名但输入包含 review summary。

最终建议约束：

- 交通数字只来自高德；
- 游客反馈只来自小红书摘要；
- 小红书不足时明确不引用。

## 8. API 响应契约

旅行成功响应新增：

```json
{
  "status": "success",
  "message": "中文建议",
  "trafficSummary": {},
  "reviewSummary": {
    "source": "小红书相关高赞帖子摘要",
    "provider": "rnote",
    "candidates": [
      {
        "id": "candidate-0",
        "name": "灵隐寺",
        "notes": [
          {
            "noteId": "64fxxxxxxx",
            "title": "灵隐寺下午去值不值",
            "summary": "这篇主要说灵隐寺氛围安静、适合祈福和拍照，但下午人流较多。",
            "authorName": "小红薯",
            "likedCount": 1234,
            "collectedCount": 456,
            "commentCount": 78,
            "publishedAtText": "2026-07-01",
            "browserUrl": "https://www.xiaohongshu.com/explore/64fxxxxxxx",
            "appUrl": "xhsdiscover://item/64fxxxxxxx"
          }
        ],
        "statusText": "已找到 3 篇相关高赞帖子"
      }
    ],
    "notice": "游客评价参考来自第三方 API 获取的小红书相关帖子摘要；请以原帖内容为准。"
  }
}
```

## 9. 前端方案

新增组件：

```text
components/ReviewSummaryCard.tsx
```

页面顺序：

```text
输入区
交通对比
游客评价参考
给你的建议
```

卡片结构：

```text
游客评价参考
小红书相关高赞帖子摘要

灵隐寺
《标题》
摘要：……
作者 · 赞/藏/评
[浏览器预览] [打开小红书]

岳王庙
……
```

移动端按钮：

- “浏览器预览”：普通 `<a target="_blank">`
- “打开小红书”：`href="xhsdiscover://item/{noteId}"`

如果小红书 App 未安装，scheme 可能无法打开；本期不做复杂 fallback，因为浏览器预览已存在。

## 10. 异常策略

小红书 API 不应阻塞高德交通建议。

推荐：

| 情况 | API 响应 | 前端 |
| --- | --- | --- |
| provider 未配置 | `reviewSummary` 不返回或返回 unavailable | 不展示或提示暂未接入 |
| 某目的地不足 3 篇 | 返回已有 notes | 展示已有数量 |
| 某目的地 0 篇 | notes 为空 + statusText | 显示未获取到可靠帖子 |
| 全部失败 | `reviewSummary` 可选不返回 | AI 不引用小红书 |
| note 摘要失败 | note 仍展示，summary 为“摘要暂不可用” | 链接仍可点 |

## 11. 测试策略

### 11.1 单元测试

- noteId 解析与一致性校验；
- browserUrl/appUrl 构造；
- 搜索结果过滤；
- reviewSummary 构造；
- 单帖摘要 prompt 约束；
- 小红书失败时不阻塞交通摘要。

### 11.2 路由测试

- 成功返回 trafficSummary + reviewSummary；
- provider 未配置仍成功返回 trafficSummary；
- review 全失败时 AI 不引用小红书；
- noteId 不一致帖子被丢弃。

### 11.3 E2E 测试

- 旅行成功展示“游客评价参考”；
- 每个目的地展示最多 3 篇；
- 每篇有“浏览器预览”和“打开小红书”；
- 链接包含同一个 noteId；
- 日常模块不展示。

## 12. 待确认问题

1. 第三方 API 服务商是否先按 Rnote 风格实现 provider？
2. 每个目的地是否固定展示 3 篇；不足 3 篇时是否允许展示已有数量？
3. 是否展示点赞、收藏、评论和发布时间？
4. 是否确认小红书摘要区域放在交通摘要之后、AI 建议之前？
5. 小红书全部失败时，是否允许继续基于高德交通 + 模型通用知识给建议？
6. 浏览器预览是否统一构造为 `https://www.xiaohongshu.com/explore/{noteId}`？
7. App 跳转是否统一构造为 `xhsdiscover://item/{noteId}`？
