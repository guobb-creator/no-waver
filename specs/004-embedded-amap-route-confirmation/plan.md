# 技术方案：旅行内嵌高德路线确认区

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 对应规格 | `004-embedded-amap-route-confirmation/spec.md` |
| 版本 | 0.2（已确认产品决策，待 iframe 可行性验证） |
| 阶段 | Plan |
| 状态 | 已确认仅手机端并进入实现 |

## 2. 目标与技术边界

本方案在旅行模块已有高德 Web 服务路线查询基础上，新增路线确认数据返回和前端内嵌高德路线区。

核心边界：

- 仍由服务端调用高德 Web 服务获取路线摘要，并供 AI 生成结论；
- 前端内嵌高德 URI/H5 路线页面，用于用户确认路线和跳转导航；
- 前端不调用高德 Web Service；
- 本期不使用高德 JS API 自绘地图；
- 本期不接入小红书；
- 不保存用户输入、路线或导航记录。
- 内嵌区默认折叠，默认交通方式为公共交通。
- 不展示置信度。
- 不接受“路线卡片 + 打开高德地图”的替代降级实现；若 iframe 验证不可行，则停止实现并重新讨论方案。

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
              - 高德路线确认区（默认折叠 iframe）
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
| iframe 可行性 | 开发前先做真实浏览器 spike | 用户不接受降级实现，必须先确认能内嵌再开发。 |
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

type RouteConfirmation = {
  origin: RouteConfirmationPlace;
  candidates: [RouteConfirmationCandidate, RouteConfirmationCandidate];
  defaultCandidateId: string;
  defaultMode: RouteConfirmationMode;
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

默认交通方式已确认：

1. 优先公共交通，即 `transit` / 高德 URI `mode=bus`；
2. 如果某个目的地没有公共交通结果，才按驾车/打车、骑行、步行顺序选择第一个可用方式；
3. 交通方式切换区仍展示该目的地所有可用交通方式。

### 5.3 高德 URL 生成

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

官方文档已确认的关键参数：

- 服务地址：`https://uri.amap.com/navigation`
- 起点：`from=lon,lat,name`
- 终点：`to=lon,lat,name`
- 交通方式：驾车 `mode=car`、公交 `mode=bus`、步行 `mode=walk`、骑行 `mode=ride`
- `callnative=0/1` 控制是否尝试调起高德地图 App

## 6. iframe 可行性验证

由于用户明确不接受降级实现，正式开发前必须完成一个小型 spike。

### 6.1 验证方法

1. 生成一个最小页面，只包含：
   - 折叠按钮；
   - iframe；
   - 高德 URI 路径规划 URL；
   - 打开高德地图按钮。
2. 使用真实高德 URI 参数：
   - `from=116.478346,39.997361,startpoint`
   - `to=116.3246,39.966577,endpoint`
   - `mode=bus`
   - `callnative=0`
3. 分别在本地预览和线上预览域名测试。
4. 用 Playwright 检查 iframe 是否成功加载非空内容。
5. 人工在手机浏览器确认滚动、展开和跳转体验。

### 6.2 初步网络层结果

已用示例 URL 做初步 header 检查：

```text
https://uri.amap.com/navigation?from=116.478346,39.997361,startpoint&to=116.3246,39.966577,endpoint&mode=bus&policy=0&src=buzaiyaobai&callnative=0
```

结果：

- 高德 URI 返回 302；
- 重定向到 `//ditu.amap.com/dir?...`；
- 最终响应 200；
- 响应头未发现 `X-Frame-Options`；
- 响应头未发现明显禁止 iframe 的 CSP `frame-ancestors`。

该结果不能替代真实浏览器验证，但说明继续 spike 是合理的。

### 6.3 验证结论规则

- 如果 iframe 在目标环境可稳定展示高德路线页，则进入实现；
- 如果 iframe 被浏览器或高德页面阻止，则停止实现，并重新讨论是否改用非内嵌方案；
- 不实现“路线卡片 + 打开高德地图”作为本规格替代方案。

### 6.4 当前 spike 结果

2026-07-20 已完成初步真实浏览器验证：

| 验证项 | 结果 |
| --- | --- |
| 高德 URI `navigation` + 移动 UA | 可内嵌，公交/驾车/步行/骑行均可展示路线。 |
| 高德 URI `navigation` + 桌面 UA | 不稳定，公交出现登录浮层，骑行会转为驾车页。 |
| 高德移动 H5 直链 + 移动 UA | 可内嵌，公交页面接近目标截图。 |
| 高德移动 H5 直链 + 桌面 UA | 会被转到桌面地图页，不满足目标界面。 |

技术判断：

- 若产品范围限定为手机端浏览器，可以继续实现；
- 若必须支持桌面浏览器也稳定内嵌目标高德路线界面，则当前 iframe 方案不满足实现前置条件；
- 按“不接受降级”的约束，进入正式开发前需要用户确认是否接受“旅行路线确认区仅在手机端展示/支持”。

用户已确认：仅手机端即可。因此正式实现范围限定为手机端展示，桌面端暂不展示内嵌高德路线区。

## 7. 前端设计

### 7.1 页面状态

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

### 7.2 新增组件

建议新增：

```text
components/AmapRouteConfirmation.tsx
```

职责：

- 展示标题“高德路线确认”；
- 默认折叠，显示“查看高德路线”入口；
- 展开后展示一致性说明；
- 展示目的地切换按钮；
- 展示交通方式切换按钮；
- 渲染 iframe；
- 提供“打开高德地图导航”按钮。

### 7.3 iframe 异常处理

iframe 可能受以下因素影响：

- 浏览器安全策略；
- 移动端 WebView 限制；
- 网络或跨域加载失败。

本规格不接受功能性降级。如果实现前 spike 确认 iframe 不能稳定内嵌，则不进入开发。

上线后如果出现个别网络加载失败，组件可显示临时加载失败提示和重试入口；这不作为替代产品方案，只是运行时错误处理。

### 7.4 移动端布局

建议：

- 路线确认区放在 AI 建议文本下方；
- 默认宽度 100%；
- iframe 高度设置为移动端约 560px，桌面端约 640px；
- 目的地和交通方式按钮可横向滚动；
- 按钮尺寸适合触摸；
- 不让 iframe 造成页面整体横向滚动。

## 8. 配置项

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

## 9. 测试策略

### 9.1 单元测试

- `buildAmapRouteUrl`：
  - 不同交通方式生成正确 URL；
  - iframe URL 使用 `callnative=0`；
  - 打开导航 URL 使用 `callnative=1`；
  - 坐标和地点名正确编码。
- `routeConfirmation` 构造：
  - 成功包含起点、两个目的地、可用交通方式；
  - 地图失败时不返回；
  - 默认交通方式为公共交通。
- `AmapRouteConfirmation`：
  - 默认折叠；
  - 渲染目的地按钮；
  - 渲染交通方式按钮；
  - 切换后 iframe URL 更新；
  - 打开高德按钮链接更新。

### 9.2 路由测试

- `/api/decision` 成功时返回 `routeConfirmation`；
- 地点需补充时不返回 `routeConfirmation`；
- 地图不可用降级时不返回 `routeConfirmation` 或返回不可用提示；
- API 响应不包含高德 Key 或原始高德 JSON。

### 9.3 E2E 测试

- 旅行成功结果展示 AI 建议和高德路线确认区；
- 可切换 B/C；
- 可切换交通方式；
- “打开高德地图导航”按钮存在并指向高德 URL；
- 手机视口下确认区不横向溢出；
- 日常板块不展示高德路线确认区。

## 10. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 高德 H5 页面禁止 iframe 嵌入 | 无法实现本规格 | 实现前 spike；若不可行，停止开发并重新讨论方案。 |
| AI 时间与高德页面时间不完全一致 | 用户可能困惑 | 同一坐标和交通方式，文案使用“约”，页面声明实际导航以高德为准。 |
| 高德 URI 参数限制 | 某些交通方式无法精准指定 | 先支持可稳定指定的方式；若公共交通 iframe 不可稳定指定，则停止本规格实现。 |
| 移动端 iframe 体验重 | 页面滚动复杂 | 默认折叠，并控制展开后的 iframe 高度。 |
| iframe 加载失败无法捕获 | 用户看到空白区域 | 上线前用浏览器 spike 验证；运行时保留重试提示。 |

## 11. 已确认事项

1. 内嵌区默认折叠；
2. 默认交通方式为公共交通；
3. 不接受降级实现，必须先确认 iframe 可用；
4. 不展示置信度；
5. 移动端内嵌区高度约 560px。

## 12. 实现范围确认

1. 接受该功能限定为手机端浏览器使用；
2. 桌面端暂不展示内嵌高德路线区。
