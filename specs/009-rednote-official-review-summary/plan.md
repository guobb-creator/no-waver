# 技术方案：旅行小红书官方帖子摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `009-rednote-official-review-summary/spec.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Plan |
| 状态 | 草案，待官方能力确认 |

## 2. 技术策略

本方案只使用小红书官方 API。由于公开文档暂未发现通用笔记搜索/详情能力，开发前必须先拿到官方接口文档、权限和测试凭证。

实现分三档：

1. 官方 API 支持搜索 + 详情内容：生成帖子摘要。
2. 官方 API 支持搜索 + 链接，但无内容：只展示“小红书查看”。
3. 官方 API 不支持搜索：不实现本规格，回退 `008`。

## 3. Provider 抽象

新增：

```text
lib/rednote-official/types.ts
lib/rednote-official/client-factory.ts
lib/rednote-official/official-client.ts
lib/rednote-official/build-rednote-summary.ts
```

接口：

```ts
type RednoteOfficialSearchResult = {
  noteId: string;
  title?: string;
  url: string;
};

type RednoteOfficialNoteDetail = {
  noteId: string;
  title?: string;
  content?: string;
  description?: string;
  url: string;
  likedCount?: number;
  collectedCount?: number;
  commentCount?: number;
  publishedAt?: string;
};

interface RednoteOfficialClient {
  searchNotes(input: { keyword: string; limit: number }): Promise<RednoteOfficialSearchResult[]>;
  getNoteDetail?(noteId: string): Promise<RednoteOfficialNoteDetail | undefined>;
}
```

环境变量暂定：

```text
REDNOTE_OFFICIAL_APP_KEY=...
REDNOTE_OFFICIAL_APP_SECRET=...
REDNOTE_OFFICIAL_ACCESS_TOKEN=...
REDNOTE_OFFICIAL_API_BASE_URL=...
```

最终字段以官方文档为准。

## 4. API 响应契约

如果能生成摘要：

```json
{
  "rednoteSummary": {
    "source": "小红书官方 API",
    "candidates": [
      {
        "id": "candidate-0",
        "name": "灵隐寺",
        "notes": [
          {
            "noteId": "abc",
            "title": "灵隐寺游玩体验",
            "summary": "这篇主要说……",
            "url": "https://...",
            "likedCount": 123
          }
        ]
      }
    ],
    "notice": "小红书内容来自官方 API 返回的相关帖子摘要，请以原帖为准。"
  }
}
```

如果只有链接：

```json
{
  "rednoteEntries": {
    "title": "小红书游玩体验",
    "entries": [
      { "candidateId": "candidate-0", "name": "灵隐寺", "url": "https://..." }
    ]
  }
}
```

## 5. 实现前验证

必须先完成：

1. 官方控制台创建应用；
2. 获取 app key/secret/token；
3. 申请搜索笔记权限；
4. 使用真实关键词测试能否返回目的地相关帖子；
5. 测试详情接口是否返回正文/描述；
6. 测试返回链接是否可打开。

任一关键能力不可用，停止实现。

## 6. 测试策略

- 官方 client 字段映射；
- noteId 一致性；
- 有内容时生成摘要；
- 无内容时只展示链接；
- 无搜索能力时不返回 rednoteSummary；
- AI 不引用未获取内容；
- E2E 覆盖“小红书查看”。

## 7. 待确认问题

1. 是否已有小红书官方开放平台应用？
2. 是否能申请到搜索笔记能力？
3. 是否能获取帖子详情内容？
4. 是否能获取小红书查看链接？
5. 如果无法获取内容，是否接受只展示“小红书查看”？
6. 如果无法搜索，是否回退 `008`？
