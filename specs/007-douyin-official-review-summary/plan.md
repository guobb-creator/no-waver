# 技术方案：旅行抖音官方游客反馈摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `007-douyin-official-review-summary/spec.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Plan |
| 状态 | 草案，待用户确认 |

## 2. 技术目标

新增抖音官方 review provider，用于为旅行候选目的地提供公开视频摘要。

```text
TrafficSummary
DouyinOfficialProvider
DouyinVideoSummary
DecisionModel
```

技术目标：

1. 使用抖音官方开放平台 API；
2. 支持关键词视频搜索；
3. 每个目的地最多返回 3 条高互动视频摘要；
4. 视频摘要、浏览器预览、App 跳转绑定同一视频标识；
5. 抖音失败不阻塞高德交通摘要。

## 3. Provider 抽象

建议把 `006` 里的 review provider 抽象调整为跨平台：

```text
lib/review-data/types.ts
lib/review-data/client-factory.ts
lib/review-data/douyin-official-client.ts
lib/review-data/mock-client.ts
lib/review-summary/build-review-summary.ts
lib/review-summary/douyin-links.ts
```

接口建议：

```ts
type ReviewProvider = 'douyin-official' | 'mock';

type ReviewSearchInput = {
  cityHint?: string;
  destinationName: string;
  limit: number;
};

type ReviewVideoSearchResult = {
  platform: 'douyin';
  itemId?: string;
  videoId?: string;
  title?: string;
  description?: string;
  likedCount?: number;
  commentCount?: number;
  publishedAt?: string;
};

type ReviewVideoDetail = ReviewVideoSearchResult & {
  browserUrl?: string;
  appUrl?: string;
  comments?: Array<{ content: string; likedCount?: number }>;
};

interface ReviewDataClient {
  searchTopVideos(input: ReviewSearchInput): Promise<ReviewVideoSearchResult[]>;
  getVideoDetail(input: { itemId?: string; videoId?: string }): Promise<ReviewVideoDetail | undefined>;
  getVideoJumpLinks?(input: { itemId?: string; videoId?: string }): Promise<{ browserUrl?: string; appUrl?: string }>;
}
```

环境变量：

```text
REVIEW_PROVIDER=douyin-official
DOUYIN_CLIENT_KEY=...
DOUYIN_CLIENT_SECRET=...
DOUYIN_ACCESS_TOKEN=...
DOUYIN_API_BASE_URL=https://open.douyin.com
```

实际 token 获取/刷新方式需根据应用类型确认。

## 4. 抖音官方 API 能力

### 4.1 关键词视频搜索

需要封装：

```text
GET /video/search/ 或官方当前文档中的关键词视频搜索接口
```

注意：

- 关键词可能必须先在管理中心创建；
- 关键词可能需要审核；
- 结果可能只覆盖最近视频；
- 结果可能只匹配标题中的关键词。

### 4.2 评论

评论为可选能力：

```text
GET /item/comment/list/ 或新版评论接口
```

如果权限不可用：

- provider 返回 `commentsUnavailable`；
- 摘要只基于标题/描述/互动数据；
- AI 不得引用评论区反馈。

### 4.3 跳转链接

优先使用官方“视频详情页跳转链接获取”接口生成跳转链接/schema。

如果该接口可用：

```text
browserUrl/appUrl = official jump link/schema
```

如果不可用：

- 只展示官方返回的 browserUrl；
- 不使用未经确认的非官方 scheme。

## 5. 搜索关键词策略

候选关键词：

```text
{cityHint} {destinationName} 游玩
{cityHint} {destinationName} 攻略
{cityHint} {destinationName} 值得去吗
```

如果抖音关键词必须预创建：

- 系统只查询已配置关键词；
- 未配置关键词时返回 unavailable；
- 前端提示“该目的地暂未配置抖音关键词”。

## 6. 视频筛选与摘要

### 6.1 筛选

每个目的地先请求更多候选，再过滤：

- 无 itemId/videoId 丢弃；
- 标题/描述不包含目的地或别名，降权或丢弃；
- 明显广告/带货丢弃；
- 无跳转链接且无法生成官方跳转链接，丢弃；
- 按点赞/评论等互动数据排序；
- 最多取 3 条。

### 6.2 摘要

新增模型能力：

```ts
summarizeDouyinVideo(video: ReviewVideoDetail): Promise<ReviewVideoSummary>
```

摘要输入：

- 标题；
- 描述；
- 互动数据；
- 可选评论摘要。

输出：

```json
{
  "summary": "这条视频主要强调灵隐寺适合拍照和祈福，但更像完整半日游，下午时间紧时需要预留路程。"
}
```

## 7. API 响应契约

旅行成功响应新增可选 `reviewSummary`：

```json
{
  "reviewSummary": {
    "source": "抖音官方开放平台公开视频摘要",
    "provider": "douyin-official",
    "candidates": [
      {
        "id": "candidate-0",
        "name": "灵隐寺",
        "videos": [
          {
            "platform": "douyin",
            "itemId": "7427865722396658979",
            "videoId": "7427865722396658979",
            "title": "杭州灵隐寺游玩攻略",
            "summary": "这条视频主要强调灵隐寺适合祈福和拍照，但建议预留较完整的游览时间。",
            "likedCount": 12345,
            "commentCount": 678,
            "publishedAtText": "2026-07-18",
            "browserUrl": "https://...",
            "appUrl": "..."
          }
        ],
        "statusText": "已找到 3 条相关高互动视频"
      }
    ],
    "notice": "游客反馈参考来自抖音官方开放平台公开视频摘要；请以原视频内容为准。"
  }
}
```

## 8. 前端方案

新增组件：

```text
components/ReviewSummaryCard.tsx
```

如果未来小红书也接入，组件可按平台展示：

```text
游客反馈参考
数据来源：抖音官方开放平台

灵隐寺
《杭州灵隐寺游玩攻略》
摘要：……
赞 1.2 万 · 评论 678 · 2026-07-18
[浏览器预览] [打开抖音]
```

展示顺序：

```text
交通对比
抖音游客反馈参考
给你的建议
```

## 9. 模型决策约束

最终建议可以引用：

- 高德交通摘要；
- 抖音视频摘要；
- 抖音评论摘要（仅权限可用时）；
- 用户输入。

不得引用：

- 未返回的视频内容；
- 未返回的评论；
- 未获取到权限的“评论区反馈”；
- 抖音 API 失败时的伪造反馈。

## 10. 异常策略

| 情况 | 行为 |
| --- | --- |
| REVIEW_PROVIDER 未配置 | 不展示游客反馈 |
| 抖音 token 缺失/过期 | 不展示游客反馈；记录服务端日志 |
| 关键词未配置 | 该目的地显示“暂未配置抖音关键词” |
| 搜索结果不足 3 条 | 展示已有数量 |
| 评论权限不可用 | 只基于视频标题/描述摘要 |
| 跳转链接不可用 | 不展示“打开抖音”或丢弃该视频 |
| 抖音全部失败 | 高德交通摘要仍正常；AI 不引用抖音 |

## 11. 测试策略

### 11.1 单元测试

- provider factory；
- 抖音 API 字段映射；
- itemId/videoId 一致性；
- 跳转链接选择；
- 评论权限不可用；
- 视频过滤；
- 摘要 prompt 约束。

### 11.2 路由测试

- 成功返回 trafficSummary + reviewSummary；
- 抖音未配置时只返回 trafficSummary；
- 关键词未配置时返回目的地状态说明；
- 评论不可用时 AI 不引用评论；
- 抖音全部失败时 AI 不引用抖音。

### 11.3 E2E 测试

- 旅行成功展示“抖音游客反馈参考”；
- 每个目的地最多 3 条视频；
- 每条有浏览器预览；
- 有官方 schema 时展示打开抖音；
- 日常模块不展示。

## 12. 待确认问题

1. 你是否已有抖音开放平台应用？应用类型是什么？
2. 是否能申请关键词视频搜索/视频搜索管理能力？
3. 关键词是否可动态创建？如果不能，是否接受只支持预设关键词？
4. 评论能力本期是否必须接入？
5. 每个目的地固定 3 条，还是最多 3 条、不足展示已有？
6. 是否展示点赞、评论、发布时间？
7. 是否优先使用官方视频详情页跳转链接接口生成“浏览器预览/打开抖音”？
8. 抖音全部失败时，是否继续基于高德交通 + 模型通用知识给建议？
