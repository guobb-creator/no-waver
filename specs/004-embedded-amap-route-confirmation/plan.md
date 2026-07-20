# 技术方案：旅行内嵌高德路线确认区

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `004-embedded-amap-route-confirmation/spec.md` |
| 版本 | 0.1（待确认） |
| 阶段 | Plan |
| 状态 | 草案，待确认 |

## 2. 目标与技术边界

本方案在旅行模块已有高德 Web 服务路线查询基础上，新增路线确认数据返回和前端内嵌高德路线区。

核心边界：

- 仍由服务端调用高德 Web 服务获取路线摘要，并供 AI 生成结论；
- 前端内嵌高德 URI/H5 路线页面，用于用户确认路线和跳转导航；
- 前端不调用高德 Web Service；
- 本期不使用高德 JS API 自绘地图；
- 本期不接入小红书；
- 不保存用户输入、路线或导航记录。

```text
浏览器
  └─ 旅行分类
       └─ POST /api/decision
            ├─ 模型提取 A/B/C
            ├─ 高德 Web Service 解析地点与路线
            ├─ 模型生成 AI 建议文本
            └─ 返回 message + routeConfirmation
                   ↓
              前端展示：
              - AI 建议文本
              - 高德路线确认区（iframe/降级卡片）
              - 打开高德地图导航
```

## 3. 技术决策

| 领域 | 决策 | 原因 |
| --- | --- | --- |
| 内嵌方式 | 优先使用高德 URI/H5 路线页 iframe | 最接近高德路线选择界面，用户感知成本低。 |
| 一致性策略 | 同一组高德坐标 + 同一交通方式 | 尽量降低 AI 结论和高德页面的路线差异。 |
| 差异声明 | 页面说明“实际导航以高德为准” | 高德 H5 页面可能重新计算，不能承诺完全一致。 |
| 响应扩展 | `/api/decision` 增加可选 `routeConfirmation` | 不影响现有纯文本 `message`，前端渐进增强。 |
| 高德 Key | 继续只在服务端保存 Web Service Key | 前端 iframe/URI 不需要暴露后端 Key。 |
| 失败降级 | iframe 不可用时显示打开高德按钮 | 避免用户卡在空白地图区域。 |
| 日常模块 | 不改动 | 本规格只影响旅行结果。 |

## 4. 数据模型设计

### 4.1 路线确认类型

新增前后端共享类型建议：

```ts
type RouteConfirmationMode = 'transit' | 'driving' | 'cycling' | 'walking';

type RouteConfirmationPlace = {
  name: string;
  resolvedName?: string;
  location: string; // "lng,lat"，高德 GCJ-02 坐标
};

type RouteConfirmationCandidate = {
  id: string;
  name: string;
  resolvedName?: string;
  location: string;
  availableModes: RouteConfirmationMode[];
};

type RouteConfirmationConfidence = {
  level: 'high' | 'medium' | 'low';
  reason: string;
};

type RouteConfirmation = {
  origin: RouteConfirmationPlace;
  candidates: [RouteConfirmationCandidate, RouteConfirmationCandidate];
  defaultCandidateId: string;
  defaultMode: RouteConfirmationMode;
  confidence: RouteConfirmationConfidence;
  notice: string;
};
```

### 4.2 API 响应

扩展现有旅行 API 响应：

```ts
type DecisionApiResponse = {
  status: 'success' | 'needs_clarification' | 'error';
  message: string;
  maxInputChars: number;
  routeConfirmation?: RouteConfirmation;
};
```

兼容规则：

- 旧前端只读取 `message` 也能工作；
- 新前端只有在 `status === 'success'` 且 `routeConfirmation` 存在时展示高德路线确认区；
- `needs_clarification`、`error` 不展示路线确认区。

## 5. 服务端设计

### 5.1 扩展地图路由摘要

当前 `MapRoutingClient.planCandidateRoutes` 返回 `RouteSummary`，其中包含目的地名称和各交通方式耗时，但没有暴露坐标。

本期需要在内部地图结果中保留：

- 起点高德坐标；
- 两个目的地高德坐标；
- 每个目的地可用交通方式；
-  resolved name；
-  city / adcode（可选，用于生成更稳定 URL）。

建议做法：

1. 扩展 `RouteSummary`，增加可选 `originLocation`、`candidate.location`；
2. 或新增 `RouteConfirmation` 构造函数，从 Amap 客户端解析结果中生成确认数据；
3. 不返回原始高德 JSON。

### 5.2 默认目的地与默认交通方式

默认目的地选择建议：

1. 优先使用 AI 推荐目的地；
2. 如果无法从 AI 文本稳定识别推荐对象，则使用综合路线更优的候选；
3. 若仍无法判断，默认第一个候选。

默认交通方式建议：

1. 若用户输入中明确提到交通方式，优先该方式；
2. 否则优先展示公交/地铁；
3. 若公交/地铁不可用，则按驾车/打车、骑行、步行顺序选择第一个可用方式。

该部分需要用户确认，见 spec 的待确认问题。

### 5.3 置信度计算

建议在服务端基于路线摘要计算，不交给模型自由发挥：

```text
high:
  两个候选都有至少两种可用路线，且推荐候选在至少两种主要方式上更省时

medium:
  两个候选都有路线，但耗时差异较小，或只有一种主要方式有明显优势

low:
  某个候选路线数据不完整，或只返回少量交通方式
```

原因文案由服务端模板生成，避免模型输出和结构化置信度不一致。

### 5.4 高德 URL 生成

新增工具函数建议：

```ts
function buildAmapRouteUrl(input: {
  origin: RouteConfirmationPlace;
  destination: RouteConfirmationCandidate;
  mode: RouteConfirmationMode;
  callnative: boolean;
}): string;
```

生成原则：

- 使用 `origin.location`、`destination.location`；
- 使用 `origin.name`、`destination.name` 作为展示名；
- 使用高德坐标系；
- 移动端打开按钮可使用 `callnative=1`；
- iframe 内嵌建议先使用 `callnative=0`，避免在 iframe 内触发 App 跳转。

具体参数需按高德 URI 路径规划文档最终确认。

## 6. 前端设计

### 6.1 页面状态

旅行分类状态从当前：

```ts
type CategoryState = {
  question: string;
  status: PageStatus;
  message: string;
};
```

扩展为：

```ts
type CategoryState = {
  question: string;
  status: PageStatus;
  message: string;
  routeConfirmation?: RouteConfirmation;
};
```

日常分类始终没有 `routeConfirmation`。

### 6.2 新增组件

建议新增：

```text
components/AmapRouteConfirmation.tsx
```

职责：

- 展示标题“高德路线确认”；
- 展示一致性说明和置信度；
- 展示目的地切换按钮；
- 展示交通方式切换按钮；
- 渲染 iframe；
- 提供“打开高德地图导航”按钮；
- iframe 加载失败或超时时展示 fallback。

### 6.3 iframe 降级

iframe 可能受以下因素影响：

- 高德页面设置禁止第三方嵌入；
- 浏览器安全策略；
- 移动端 WebView 限制；
- 网络或跨域加载失败。

降级规则：

1. iframe 区域显示加载状态；
2. 超过固定时间仍未加载成功，展示提示：

```text
高德路线页面暂时无法在这里展示，你可以直接打开高德地图查看。
```

3. 保留“打开高德地图导航”按钮；
4. AI 文本建议仍正常展示。

注意：部分 iframe 加载失败无法被浏览器可靠捕获，因此需要用超时兜底。

### 6.4 移动端布局

建议：

- 路线确认区放在 AI 建议文本下方；
- 默认宽度 100%；
- iframe 高度先设置为移动端 560px，桌面端 640px；
- 目的地和交通方式按钮可横向滚动；
- 按钮尺寸适合触摸；
- 不让 iframe 造成页面整体横向滚动。

## 7. 配置项

本期后端继续使用：

| 配置项 | 说明 |
| --- | --- |
| `MAP_PROVIDER` | 当前已支持 `amap` / `mock`。 |
| `AMAP_WEB_SERVICE_KEY` | 服务端高德 Web 服务 Key。 |
| `AMAP_BASE_URL` | 高德 Web Service base URL。 |
| `AMAP_REQUEST_TIMEOUT_MS` | 地图请求超时。 |

新增配置是否需要：

| 配置项 | 是否需要 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_AMAP_URI_BASE_URL` | 可选 | 默认可写死为 `https://uri.amap.com/navigation`，通常不需要配置。 |
| 高德 JS API Key | 不需要 | 本期不使用 JS API 自绘地图。 |
| `securityJsCode` | 不需要 | 本期不使用 JS API。 |

## 8. 测试策略

### 8.1 单元测试

- `buildAmapRouteUrl`：
  - 不同交通方式生成正确 URL；
  - iframe URL 使用 `callnative=0`；
  - 打开导航 URL 使用 `callnative=1`；
  - 坐标和地点名正确编码。
- `routeConfirmation` 构造：
  - 成功包含起点、两个目的地、可用交通方式；
  - 地图失败时不返回；
  - 置信度 high/medium/low。
- `AmapRouteConfirmation`：
  - 渲染目的地按钮；
  - 渲染交通方式按钮；
  - 切换后 iframe URL 更新；
  - 打开高德按钮链接更新。

### 8.2 路由测试

- `/api/decision` 成功时返回 `routeConfirmation`；
- 地点需补充时不返回 `routeConfirmation`；
- 地图不可用降级时不返回 `routeConfirmation` 或返回不可用提示；
- API 响应不包含高德 Key 或原始高德 JSON。

### 8.3 E2E 测试

- 旅行成功结果展示 AI 建议和高德路线确认区；
- 可切换 B/C；
- 可切换交通方式；
- “打开高德地图导航”按钮存在并指向高德 URL；
- 手机视口下确认区不横向溢出；
- 日常板块不展示高德路线确认区。

## 9. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 高德 H5 页面禁止 iframe 嵌入 | 无法实现真正内嵌 | 提供 fallback：路线卡片/提示 + 打开高德地图按钮。 |
| AI 时间与高德页面时间不完全一致 | 用户可能困惑 | 同一坐标和交通方式，文案使用“约”，页面声明实际导航以高德为准。 |
| 高德 URI 参数限制 | 某些交通方式无法精准指定 | 先支持可稳定指定的方式，不稳定项隐藏或降级到打开高德。 |
| 移动端 iframe 体验重 | 页面滚动复杂 | 默认高度控制，必要时改为折叠展开。 |
| iframe 加载失败无法捕获 | 用户看到空白区域 | 使用加载超时兜底。 |

## 10. 待确认事项

进入实现前需要确认：

1. 内嵌区默认展开还是默认折叠；
2. 默认交通方式；
3. iframe 不可用时是否接受降级为“打开高德地图导航”；
4. 是否展示置信度；
5. 移动端内嵌区默认高度。
