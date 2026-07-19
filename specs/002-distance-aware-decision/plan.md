# 技术方案：地图导航数据辅助决策

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `002-distance-aware-decision/spec.md` |
| 版本 | 0.1 |
| 阶段 | Plan |
| 状态 | 已确认，待实现 |

## 2. 目标与技术边界

本方案在现有单轮中文决策页面基础上接入高德地图 Web 服务 API，为 A→B、A→C 提供真实导航数据，并以轻量对比表的方式展示公交/地铁、驾车/打车、骑行，以及不超过 30 分钟的步行时间。

本期仍保持对话式产品形态：用户输入一段中文文本，页面返回一段中文纯文本建议。页面不内嵌地图，不保存用户输入或回复，不接入实时游客评价。

```text
浏览器
  └─ 单页对话界面
       └─ POST /api/decision
            ├─ DecisionModelClient.extractPlaces(question)
            │    └─ 从自然语言中提取 A、B、C 与城市线索
            ├─ MapRoutingClient.planRoutes(A, B, C)
            │    └─ AmapMapRoutingClient（高德 Web 服务 API）
            └─ DecisionModelClient.decideWithRoutes(question, routeSummary)
                 └─ 生成轻量对比表 + 优缺点分析 + 建议
```

用户感知上仍是一次提交、一次回复；服务端内部可以包含一次地点提取模型调用、若干地图 API 调用、一次最终建议模型调用。

## 3. 技术决策

| 领域 | 决策 | 原因 |
| --- | --- | --- |
| 地图服务 | 优先使用高德地图 Web 服务 API | 满足国内路线规划、地理编码和多交通方式查询需求。 |
| Key 管理 | `AMAP_WEB_SERVICE_KEY` 服务端环境变量 | 避免浏览器暴露高德 Key，便于 Vercel 配置与后续替换。 |
| 地点提取 | 通过模型输出结构化 A/B/C | 用户仍输入自然语言，单纯正则难以稳定处理真实表达。 |
| 地图抽象 | 新增 `MapRoutingClient` 接口 + Amap 实现 + mock 实现 | 便于测试、降级和未来替换地图供应商。 |
| 决策生成 | 模型基于结构化地图摘要生成中文纯文本 | 保持产品“对话式建议”的核心体验。 |
| 呈现方式 | 轻量对比表作为纯文本的一部分 | 用户能快速比较交通耗时，同时避免复杂 UI。 |
| 游客评价 | 仍由模型基于已有知识生成 | 本期不调用点评、搜索或评论服务。 |
| 降级策略 | 地图失败时允许常识建议，但明确说明未获取地图数据 | 保证可用性，同时避免误导用户。 |

## 4. 系统设计

### 4.1 服务端处理流程

`POST /api/decision` 的主流程调整为：

```text
接收用户问题
     ↓
校验 question
     ↓
模型提取地点：origin=A, candidates=[B, C], cityHint
     ├─ 提取失败或信息不足 → needs_clarification
     ↓
高德地理编码：A、B、C → 经纬度与城市信息
     ├─ 无法唯一识别 → needs_clarification
     ├─ 疑似不在同城或距离过远 → needs_clarification
     ↓
高德路线查询：A→B、A→C
     ├─ 地图服务失败 → 可降级为模型常识建议
     ↓
整理路线摘要：公交/地铁、驾车/打车、骑行、步行
     ↓
模型生成最终回复
     ↓
返回纯文本 message
```

### 4.2 地点提取

新增模型能力用于将用户自然语言结构化为地点信息：

```ts
type ExtractedTripPlaces =
  | {
      status: 'success';
      origin: string;
      candidates: [string, string];
      cityHint?: string;
    }
  | {
      status: 'needs_clarification';
      message: string;
    };
```

提取规则：

- 必须识别一个当前地点 A 和两个候选地点 B、C。
- 若用户只写了“这里”“附近”“那个景点”等不可定位表达，应要求补充。
- 若缺少城市信息但地点名称足够明确，可以继续尝试地理编码。
- 若地名可能跨城市重复，应提示用户补充城市或区域，而不是武断选择。

### 4.3 地图路由抽象

新增地图客户端接口：

```ts
type TravelMode = 'transit' | 'driving' | 'cycling' | 'walking';

type RouteOption = {
  mode: TravelMode;
  durationMinutes: number;
  distanceMeters?: number;
  available: boolean;
  note?: string;
};

type CandidateRouteSummary = {
  destinationName: string;
  resolvedDestinationName: string;
  city?: string;
  routes: RouteOption[];
};

interface MapRoutingClient {
  planCandidateRoutes(input: {
    originName: string;
    candidateNames: [string, string];
    cityHint?: string;
  }): Promise<
    | { status: 'success'; originName: string; candidates: [CandidateRouteSummary, CandidateRouteSummary] }
    | { status: 'needs_clarification'; message: string }
    | { status: 'unavailable'; message: string }
  >;
}
```

实现：

- `AmapMapRoutingClient`：真实高德 Web 服务 API 实现。
- `MockMapRoutingClient`：测试与本地无 Key 开发使用。
- `client-factory` 或独立工厂根据环境变量选择真实/模拟地图客户端。

### 4.4 高德 API 使用方式

本期优先使用：

1. 地理编码：优先将 A、B、C 地点名转换为经纬度。
2. POI 关键字搜索：当地理编码无法识别“灵隐寺、岳王庙”等景点/POI 名称时，使用高德 POI 搜索作为定位 fallback。
3. 路线规划或路径规划 2.0：查询公交/地铁、驾车、步行、骑行路线。

注意：

- 高德请求只在服务端发起。
- 经纬度、原始路线详情不直接返回前端。
- 服务端只把整理后的耗时、距离和可用性传给模型。
- 如果公交/地铁接口需要城市参数，优先使用地理编码得到的城市，用户输入中的城市作为辅助。
- 如果高德返回多个地理编码或 POI 候选且无法可靠消歧，返回 `needs_clarification`。

### 4.5 路线摘要规则

地图数据整理为轻量摘要后再交给模型：

- 公交/地铁：展示预计总耗时，必要时可包含“换乘较多/路线不可得”等短提示。
- 驾车/打车：展示预计驾车时间；文案中称为“驾车/打车约 X 分钟”，不估算价格。
- 骑行：展示预计骑行时间。
- 步行：仅当预计时间小于或等于 30 分钟时展示；超过 30 分钟时默认省略，必要时标记“不建议步行”。
- 所有时间向用户展示为“约 X 分钟”；超过 60 分钟可展示为“约 1 小时 10 分钟”。
- 距离可以作为辅助信息，但不强制展示；避免让表格过密。

### 4.6 最终回复格式

模型最终回复必须是中文纯文本，建议结构为：

```text
路线对比：

B：公交/地铁约 25 分钟，驾车/打车约 12 分钟，骑行约 18 分钟
C：公交/地铁约 45 分钟，驾车/打车约 28 分钟，骑行约 35 分钟

B 的优点是……缺点是……
C 的优点是……缺点是……

我的建议：……
```

约束：

- 不把游客评价描述为实时评分或最新评论。
- 不虚构地图没有返回的交通方式。
- 不展示原始 API JSON。
- 不输出 Markdown 表格，避免小屏横向滚动；使用短行纯文本。

## 5. 前端影响

前端页面整体保持不变：

- 默认输入示例不改。
- 仍使用单个 `textarea`。
- 仍显示纯文本结果。
- 仍不显示路线卡片或地图组件。

需要确认的前端变化：

- 加载文案可从“正在生成建议”调整为“正在查询路线并生成建议”，让等待原因更清楚。
- 失败提示沿用非技术化中文，但区分输入缺失、地点不明确、地图不可用和模型失败。

## 6. API 响应契约

`POST /api/decision` 对浏览器的响应结构保持兼容：

```json
{
  "status": "success",
  "message": "纯文本决策建议",
  "maxInputChars": 12000
}
```

仍支持：

- `success`：成功生成建议。
- `needs_clarification`：地点缺失、地点歧义、疑似跨城或距离过远。
- `error`：系统异常、地图和模型均无法完成决策。

不向浏览器返回：

- 高德 Key；
- 原始高德响应；
- 服务端堆栈；
- 模型内部结构化提取结果。

## 7. 配置项

新增配置：

| 配置项 | 示例 | 说明 |
| --- | --- | --- |
| `MAP_PROVIDER` | `amap` / `mock` | 地图服务提供商；本地测试可用 mock。 |
| `AMAP_WEB_SERVICE_KEY` | `******` | 高德 Web 服务 API Key，仅服务端读取。 |
| `AMAP_BASE_URL` | `https://restapi.amap.com` | 可选，便于测试替换。 |
| `AMAP_REQUEST_TIMEOUT_MS` | `8000` | 单次地图请求超时。 |
| `WALKING_DISPLAY_MAX_MINUTES` | `30` | 步行超过该时长时不在主要路线表展示。 |

现有模型配置保持不变。

Vercel 上线时需要在 Project Settings → Environment Variables 中配置 `AMAP_WEB_SERVICE_KEY`，并确保只用于 Production/Preview/Development 中需要的环境。当前用户已确认高德 Key 已配置。

## 8. 安全、隐私与稳定性

- 所有高德请求只在服务端发起。
- 不在日志中打印用户完整问题、经纬度、原始地图响应或 Key。
- 地图 API 超时、限流、Key 缺失、返回异常时统一映射为中文可理解提示。
- 地图 Key 缺失时，本地开发可使用 mock；生产环境若启用 `MAP_PROVIDER=amap` 但 Key 缺失，应返回配置错误提示或阻止启动。
- 地图路线数据只用于当前请求，不保存。

## 9. 测试策略

### 9.1 单元测试

- 地点提取结果解析：成功、缺少地点、模型返回非 JSON。
- 高德地理编码/POI 搜索解析：唯一结果、多结果、无结果、跨城。
- 高德路线解析：公交/地铁、驾车、骑行、步行成功与无结果。
- 步行过滤：超过 30 分钟不展示。
- 地图错误映射：超时、限流、Key 错误、服务不可用。
- 最终 prompt 构造：包含地图摘要，不包含原始 Key 或原始响应。

### 9.2 路由测试

- 成功路径：输入 A/B/C → 返回含路线对比和建议的纯文本。
- `needs_clarification`：地点缺失、地点歧义、疑似跨城。
- 地图失败降级：返回明确说明“未获取到地图导航数据”的建议。
- 地图和模型都失败：返回非技术化错误。

### 9.3 端到端测试

- 默认示例仍可编辑。
- 用户提交含 A/B/C 的中文问题后，结果区出现“路线对比”和“我的建议”。
- 手机视口下纯文本路线对比不产生横向滚动。
- 地点不明确时提示补充城市或区域。

## 10. 规格追踪

| 规格项 | 方案落实 |
| --- | --- |
| 轻量对比表 | 模型最终回复以短行纯文本展示 B/C 的交通方式耗时。 |
| 不内嵌地图 | 前端不引入地图组件，不加载高德 JS API。 |
| 公交/地铁、驾车/打车、步行、骑行 | 地图客户端按四种方式查询，可用则展示；步行超过 30 分钟过滤。 |
| 理性分析优缺点 | 最终 prompt 要求分别说明 B/C 优缺点再给建议。 |
| 游客评价不调用外部工具 | 模型只基于已有知识描述游客体验，不访问点评/搜索。 |
| 地图失败可降级 | 路由层支持 `unavailable` 后转入模型常识建议，并明确说明地图不可用。 |
| 默认输入示例不动 | 前端默认文本不改。 |

## 11. 下一步

本计划已确认，下一步按 `tasks.md` 进入实现。实现阶段不得超出本计划范围，例如不得内嵌地图、不得调用游客评价外部服务、不得保存用户输入或回复。
