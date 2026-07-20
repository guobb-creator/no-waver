# 技术方案：旅行小红书查看入口

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `008-rednote-search-entry/spec.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Plan |
| 状态 | 草案，待用户确认 |

## 2. 技术目标

在旅行模块新增小红书搜索入口，不接入小红书内容 API，不抓取任何帖子内容。

技术目标：

1. 基于候选目的地生成小红书搜索 URL；
2. API 返回 `rednoteEntries`；
3. 前端展示“小红书游玩体验”区域；
4. 每个目的地一个“小红书查看”链接；
5. AI 不引用小红书内容。

## 3. 数据契约

新增类型：

```ts
type RednoteEntry = {
  candidateId: string;
  name: string;
  url: string;
};

type RednoteEntries = {
  title: string;
  description: string;
  entries: [RednoteEntry, RednoteEntry];
  notice: string;
};
```

旅行成功响应：

```ts
type DecisionApiResponse = {
  status: 'success';
  message: string;
  trafficSummary?: TrafficSummary;
  rednoteEntries?: RednoteEntries;
  maxInputChars: number;
};
```

## 4. URL 构造

新增：

```text
lib/rednote-entry/build-rednote-entries.ts
lib/rednote-entry/rednote-url.ts
lib/rednote-entry/types.ts
```

函数：

```ts
buildRednoteSearchUrl(input: {
  cityHint?: string;
  destinationName: string;
}): string
```

内部关键词：

```text
{cityHint} {destinationName} 游玩体验
```

如果没有 cityHint：

```text
{destinationName} 游玩体验
```

URL：

```text
https://www.xiaohongshu.com/search_result?keyword={encodedKeyword}
```

## 5. 前端组件

新增：

```text
components/RednoteEntryCard.tsx
```

结构：

```text
小红书游玩体验
以下是灵隐寺和岳王庙的游玩体验入口，你可以打开看看近期大家怎么分享。

灵隐寺
[小红书查看]

岳王庙
[小红书查看]
```

样式：

- 与 `TrafficSummaryCard` 保持同一视觉系统；
- 小红书按钮可用红色/品牌色点缀，但不必过度拟物；
- 移动端按钮宽度可为 100%；
- 不展示搜索词。

## 6. 页面顺序

推荐：

```text
交通对比
小红书游玩体验
给你的建议
```

原因：

- 高德交通是产品内真实数据；
- 小红书入口是外部查看入口；
- AI 建议放最后，承接前面的可参考信息。

## 7. 模型约束

当前模型 prompt 需要补充：

```text
本版本没有读取小红书帖子内容；如果提到游客体验，只能基于模型已有通用知识，不能声称根据小红书帖子或近期小红书反馈。
```

如果用户自己在输入里粘贴小红书内容，模型可以基于用户提供的内容分析，但不得声称系统主动抓取过小红书。

## 8. 测试策略

### 8.1 单元测试

- URL 构造中文编码；
- 无 cityHint 时的关键词；
- `buildRednoteEntries` 返回两个候选；
- 不包含搜索词展示字段；
- prompt 不声称读取小红书。

### 8.2 路由测试

- 旅行成功返回 `trafficSummary` 和 `rednoteEntries`；
- clarification/error 不返回 rednoteEntries；
- 日常接口不返回 rednoteEntries。

### 8.3 E2E 测试

- 旅行成功展示“小红书游玩体验”；
- 每个目的地有“小红书查看”；
- 页面不展示搜索词；
- 页面不出现“核验”；
- 日常不展示。

## 9. 待确认问题

1. 标题是否确认“小红书游玩体验”？
2. 描述文案是否确认“以下是 {B} 和 {C} 的游玩体验入口，你可以打开看看近期大家怎么分享。”？
3. 是否确认只保留一个“小红书查看”按钮？
4. URL 是否确认使用 `https://www.xiaohongshu.com/search_result?keyword=...`？
5. AI 建议是否需要显式说明“游客体验基于通用认知”？
