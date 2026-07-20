# 技术方案：旅行可信交通摘要

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `005-trusted-traffic-summary/spec.md` |
| 版本 | 0.3（已实现并完成验收） |
| 阶段 | Plan |
| 状态 | 已实现并通过验收 |

## 2. 技术目标

本方案将旅行模块从“AI 文本 + 内嵌高德 iframe”调整为“高德结构化交通摘要 + AI 决策建议 + 高德核验链接”。

核心技术目标：

1. 后端继续使用高德 Web Service 作为路线数据源。
2. API 返回专门用于前端展示的 `trafficSummary`，不暴露高德 Key 或原始响应。
3. 前端移除内嵌高德 iframe 展示，改为移动端友好的结构化交通卡片。
4. 模型生成交通结论时只能引用高德路线摘要中的事实。
5. 地图数据异常时走 `needs_clarification` 或明确不可用提示，不让模型编造交通数据。

## 3. 当前实现基础

当前代码已经具备：

- `lib/map-routing/*`：高德路线查询与 `RouteSummary` 摘要；
- `lib/map-routing/route-summary.ts`：路线摘要格式化；
- `app/api/decision/route.ts`：旅行决策 API；
- `lib/decision-model/*`：地点提取与带路线数据的模型调用；
- `lib/route-confirmation/*` 与 `components/AmapRouteConfirmation.tsx`：内嵌高德确认区相关实现。

本期应复用 `map-routing` 的高德数据，不再复用 iframe 展示组件。

## 4. 数据契约设计

### 4.1 API 响应变化

当前旅行成功响应包含：

```json
{
  "status": "success",
  "message": "中文建议",
  "routeConfirmation": {}
}
```

本期调整为：

```json
{
  "status": "success",
  "message": "中文建议",
  "trafficSummary": {
    "source": "高德地图路线数据",
    "queriedAtText": "刚刚查询",
    "origin": {
      "name": "杭州西湖",
      "resolvedName": "浙江省杭州市西湖区",
      "location": "120.130396,30.259242"
    },
    "candidates": [
      {
        "id": "candidate-0",
        "name": "灵隐寺",
        "resolvedName": "灵隐寺",
        "location": "120.102,30.240",
        "routes": [
          {
            "mode": "transit",
            "label": "公交/地铁",
            "durationText": "约 38 分钟",
            "distanceText": "约 7.8 公里",
            "walkingDistanceText": "步行约 900 米",
            "transfersText": "换乘 0 次",
            "lineNames": ["7 路", "地铁 1 号线"],
            "lineNamesText": "7 路 / 地铁 1 号线",
            "available": true,
            "verificationUrl": "https://uri.amap.com/navigation?..."
          }
        ]
      }
    ],
    "trafficInsight": {
      "type": "obvious",
      "title": "岳王庙明显更方便",
      "reasons": [
        "公交/地铁少约 26 分钟",
        "驾车/打车少约 14 分钟"
      ]
    },
    "notice": "交通数据来自高德地图路线数据；AI 只基于这些路线数据比较交通。实际导航以高德为准。"
  },
  "maxInputChars": 12000
}
```

说明：

- `trafficSummary` 只在地图路线成功且通过异常校验时返回。
- `routeConfirmation` 废弃，不再给前端用于渲染。
- `message` 保留纯文本 AI 建议，确保现有结果展示能力不被破坏。
- `verificationUrl` 用于跳转高德核验，不用于 iframe。

### 4.2 类型建议

建议新增：

```text
lib/traffic-summary/types.ts
lib/traffic-summary/build-traffic-summary.ts
lib/traffic-summary/amap-verification-url.ts
lib/traffic-summary/traffic-insight.ts
```

核心类型：

```ts
type TrafficSummaryMode = 'transit' | 'driving' | 'cycling' | 'walking';

type TrafficRouteItem = {
  mode: TrafficSummaryMode;
  label: string;
  durationMinutes: number;
  durationText: string;
  distanceMeters?: number;
  distanceText?: string;
  walkingDistanceMeters?: number;
  walkingDistanceText?: string;
  transfers?: number;
  transfersText?: string;
  lineNames?: string[];
  lineNamesText?: string;
  note?: string;
  verificationUrl: string;
};

type TrafficSummaryCandidate = {
  id: string;
  name: string;
  resolvedName?: string;
  location: string;
  routes: TrafficRouteItem[];
};

type TrafficInsight = {
  type: 'obvious' | 'slight' | 'similar' | 'insufficient';
  title: string;
  reasons: string[];
};
```

## 5. 地图数据增强

当前 `RouteOption` 已包含：

- `mode`
- `durationMinutes`
- `distanceMeters`
- `available`
- `note`

为了提升可信摘要质量，公共交通建议补充：

- `walkingDistanceMeters`
- `transfers`
- `lineNames`

高德公交接口如能稳定解析线路和换乘信息，则展示：

```text
公交/地铁：约 38 分钟，7 路 / 地铁 1 号线，步行约 900 米，换乘 0 次
```

如果同一公交方案包含多条线路，只展示高德推荐方案中的主要线路名，避免信息过载。

## 6. 交通判断算法

本期优先用确定性算法生成 `trafficInsight`，不交给模型自由判断具体交通差异。

建议规则：

1. 优先比较公共交通；
2. 若公共交通缺失，则比较驾车/打车；
3. 同时参考骑行和可用步行；
4. 若一个候选在主要交通方式上少 15 分钟以上，标记为 `obvious`；
5. 若差距 5–15 分钟，标记为 `slight`；
6. 若差距小于 5 分钟，标记为 `similar`；
7. 若关键数据不足，标记为 `insufficient`。

示例：

```text
type: obvious
title: 岳王庙明显更方便
reasons:
- 公交/地铁少约 26 分钟
- 驾车/打车少约 14 分钟
```

阈值可在实现后根据真实 case 调整。

## 7. 模型调用约束

### 7.1 Prompt 输入

给模型的路线数据仍使用结构化摘要，但需要更强约束：

```text
以下交通数据来自高德地图路线查询。你只能引用这些数据中的时间、距离、换乘、步行距离；不得自行估算或补充任何地图未返回的交通数字。
```

### 7.2 Prompt 输出

模型输出应包含：

1. 对两个目的地的优缺点分析；
2. 游客评价/体验判断，说明其来自通用认知；
3. 最终建议；
4. 不重复编造路线摘要中没有的数据。

前端已经展示结构化交通摘要，因此模型 `message` 中不需要再长篇重复路线表，只需引用关键差异。

## 8. 前端方案

### 8.1 删除内嵌 iframe 体验

旅行结果不再渲染：

```text
<AmapRouteConfirmation />
```

改为渲染：

```text
<TrafficSummaryCard />
```

### 8.2 页面结构

移动端推荐结构：

```text
交通对比
高德地图路线数据 · 刚刚查询

[候选目的地 A 卡片]
  公交/地铁  约 38 分钟  步行约 900 米  换乘 0 次
    7 路 / 地铁 1 号线  [高德查看]
  驾车/打车  约 22 分钟  约 7.8 公里
    [高德查看]
  骑行      约 34 分钟
    [高德查看]
  步行      时间较长，不建议步行

[候选目的地 B 卡片]
...

交通判断
岳王庙明显更方便
- 公交/地铁少约 26 分钟
- 驾车/打车少约 14 分钟

给你的建议
...
```

### 8.3 展示顺序

推荐“交通摘要在前，AI 建议在后”。

原因：

- 用户先看到可信数据源；
- AI 建议变成对数据的解释，而不是一段无法核验的文本；
- 更符合“降低模型幻觉担忧”的目标。

该顺序已确认。

## 9. 异常策略

地图数据不可靠时，不返回 `trafficSummary`。

推荐行为：

| 情况 | API 状态 | 前端文案 |
| --- | --- | --- |
| 输入占位符 A/B/C | `needs_clarification` | 请把 A/B/C 换成真实地点 |
| 地点无法识别 | `needs_clarification` | 请补充城市或更完整地点 |
| 不在同城/距离过远 | `needs_clarification` | 请确认地点是否有误 |
| 任一候选地点导航失败或关键路线数据为空 | `needs_clarification` | 有地点路线无法可靠获取，请核实地点是否有误 |
| 非关键交通方式缺失 | `success` | 不展示缺失方式或显示“高德暂未返回有效路线” |

已确认：任一候选地点导航失败时，提示用户核实地点，不生成完整旅行决策建议。

## 10. 测试策略

### 10.1 单元测试

- `buildTrafficSummary`：
  - 成功生成两个候选卡片；
  - 默认公共交通；
  - 步行超过 30 分钟标记不建议；
  - 缺失交通方式不展示；
  - 不返回 iframe URL。

- `trafficInsight`：
  - 明显差距；
  - 轻微差距；
  - 差异不大；
  - 数据不足。

- 高德核验 URL：
  - 坐标和中文名称正确编码；
  - 公交/驾车/步行/骑行 mode 正确；
  - `callnative=1`。
  - 每个候选目的地的每种可用交通方式都有独立链接。

### 10.2 路由测试

- 成功时返回 `trafficSummary`；
- 占位符输入返回 `needs_clarification`；
- 地点异常返回 `needs_clarification`；
- 任一候选地点导航失败时返回 `needs_clarification`，不返回具体交通数字。

### 10.3 E2E 测试

- 旅行成功后展示交通对比；
- 展示高德数据来源；
- 不展示高德 iframe；
- 可看到两个候选目的地卡片；
- 每种可用交通方式均可点击高德核验链接；
- 日常模块不展示交通摘要。

## 11. 上线与迁移

1. 新增 `trafficSummary` 响应。
2. 前端优先使用 `trafficSummary` 渲染交通摘要。
3. 移除 `routeConfirmation` 响应和前端引用。
4. 直接删除 `AmapRouteConfirmation` 与 `route-confirmation` 相关代码。

## 12. 已确认产品决策

1. 地图导航有一个地点失败时，提示用户核实地点，不生成完整决策建议。
2. 高德核验链接粒度为每个候选目的地的每种交通方式一个链接。
3. 交通摘要展示在 AI 建议前。
4. 公共交通展示具体线路名。
5. 本期直接删除旧 iframe 组件和相关代码。
