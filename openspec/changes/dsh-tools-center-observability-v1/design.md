## Context

现有 `@yeisme/dsh-client-ui-mcp-inspector` 已从最初只读 MCP 活动扩展为 Tools 目录、启停和活动组合面；`@yeisme/dsh-tool-hub-host` 已提供 generation CAS、prefs guard 和 safe catalog projection。当前实现仍有四类断层：

1. `vk-body` 作为满高 CSS Grid 时 auto rows 被拉伸，Catalog 与 Session activity 之间产生大面积无意义空白。
2. 目录、筛选和状态均以卡片/按钮堆叠，首屏无法同时回答目录与运行态问题。
3. transport 失败直接把 `toolHub.list transport failure: {...}` 放入 status 文案，暴露实现细节且没有稳定 recovery 语义。
4. locale 字典已存在，但组件主体仍硬编码英文；可访问性、窄容器和最终人工视觉验收没有完整合同。

当前工作树包含其他并行功能；本 change 只拥有 `ui-mcp-inspector`、`dsh-tool-hub`、对应 bundle 的必要兼容导出、OpenSpec 与验收脚本。实现不得回退或重写其他脏改动。

## Goals / Non-Goals

**Goals:**

- 用户进入 Tools 后 5 秒内看懂目录覆盖、启停、异常、本会话调用、失败和运行中状态。
- 使用一个紧凑状态条、一个高密度目录列表和一个活动/详情区域完成体验，不新增 dashboard 卡片墙或并列主壳。
- 保持 DSH session/tools/skills/plugin inventory/未来 MCP health 的 canonical owner；插件只投影 safe summary。
- 只做 backward-compatible additive 合同扩展。
- 自动测试生成脱敏视觉证据；最终 closeout 必须有人工 `accept` 回执。

**Non-Goals:**

- 不提供直接调用、重试、取消工具的动作。
- 不编辑 MCP 配置、credential、command、env、header 或 provider payload。
- 不做跨 session 历史、费用、token 或长期遥测。
- 不读取 tool arguments 推断 Skill 名称。
- 不复制 Workbench 工具中心、不修改官方 DSH 主题、不 fork DSH core。

## Decisions

### 1. 使用状态条 + 双栏工作台，而不是纵向卡片或三层 dashboard

```text
┌ Tools  目录完整 · 18 项 · 14 已启用 │ 本会话 27 调用 · 2 失败 · 1 运行中 ┐
│ 覆盖度 [████████ 已启用][██ 已关闭][! 不可用]              [重新检测] │
├ 目录 58% ───────────────────────────┬ 活动 / 详情 42% ───────────────┤
│ 搜索…  [全部 MCP Skills 内置] [状态]│ 活动 [列表 | 时间线] [全部/失败] │
│ ● github · MCP · 12 tools     [启用]│ 10:31 create_issue  1.2s  成功 │
│ ● writer · Skill             [关闭]│ 10:30 web_search     3.8s  失败 │
│ ● read_file · 内置           [启用]│ ─────── 调用耗时瀑布时间线 ───── │
└─────────────────────────────────────┴────────────────────────────────┘
```

- >=1100px 容器使用 `58% / 42%`；700-1099px 使用内部 `目录 / 活动 / 详情` tabs；<700px 使用单列、折叠筛选和 44px 触控目标。
- 断点以 root container query 为准，因为该插件可驻留在不同宽度的 DSH slot 中。
- 目录条目使用分隔行而非 card；活动 group 只在 server 分组确实有语义时使用轻量 section。
- 右栏默认 Activity；选择目录条目后进入 Details，提供明确返回动作，不新增 drawer/focus trap。

### 2. 一个 outer layout，内容从顶部开始，不再让 CSS Grid 拉伸 auto rows

插件 root 设置 `container-type: inline-size`、`align-content: start` 和 `min-height: 0`。桌面两个区域各自保持可滚动内容边界；中窄布局只保留一个可见区域，避免同时出现父/子双滚动轴。任何 viewport 首屏都必须看到状态条和至少一个目录/活动内容面。

### 3. 统一活动派生是纯函数，保留旧 MCP API

新增 `deriveToolActivity(nodes, runningCalls)`：

- `mcp__<server>__<tool>` → `itemId=mcp:<server>`、family `mcp`。
- 非 MCP 普通 tool name → `itemId=tool:<name>`、family `native`。
- name 为 `skill` 时只显示 aggregate `Skill invocation`；不读取 arguments。
- malformed/empty 名称丢弃，不猜测。
- 所有记录仅含 item/tool safe name、time、duration、running/error；不含 args/result/raw payload。

旧 `deriveMcpActivity`、`McpServerActivity` 和公开导出保持，内部可复用新函数或保留原实现。没有 deprecation/removal。

### 4. `toolHub.list@1` 只做 optional widening

```ts
interface ToolHubCatalogV1 {
  specVersion: '1.0'
  observedAt?: number
  healthAvailable?: boolean
}

type ToolHubReasonCodeV1 =
  | 'disabled_by_user'
  | 'not_model_invocable'
  | 'loader_disabled'

interface ToolHubHealthV1 {
  state: 'connected' | 'disconnected' | 'syncing' | 'unknown'
  observedAt: number
}

interface ToolHubItemV1 {
  reasonCode?: ToolHubReasonCodeV1
  health?: ToolHubHealthV1
}
```

- `specVersion`、remote descriptor id、method、已有字段与 `disabledReason` 保持不变。
- client strict codec 验证 optional 字段；字段缺失按旧版本处理，未知运行时值按 unknown/fallback 处理。
- 旧消费者忽略新增字段；rollback 可只停止发送 optional 字段，无数据迁移。

### 5. MCP health 是 optional provider projection

```mermaid
flowchart LR
  SESSION[DSH ConversationSnapshot] --> ACT[deriveToolActivity]
  SKILLS[ctx.skills] --> HUB[dsh-tool-hub safe projection]
  TOOLS[ctx.tools] --> HUB
  PLUGINS[ctx.pluginInventory] --> HUB
  MCP[optional ctx.mcpServers.list] --> HUB
  PREFS[storageDomain prefs CAS] --> HUB
  HUB --> REMOTE[toolHub.list@1 / setEnabled@1]
  REMOTE --> UI[Tools catalog + details]
  ACT --> UI
  UI --> RECEIPT[local screenshot + human acceptance evidence]
```

`ctx.mcpServers.list()` 可选返回 `serverName/transport/toolCount/status/lastSyncAt`；Tool Hub 只取 server、toolCount、status、observed time，不传 transport config、command line、env、headers。provider 缺失时 `healthAvailable=false` 且 item 无 `health`；UI 显示“未提供连接健康”，不得显示 disconnected/offline。health 超过 60 秒由 client 显示 stale 文本，但不改 wire state。

### 6. 错误先归一，再本地化

client/controller 使用安全错误码：

| Code | 用户主文案 | Recovery |
| --- | --- | --- |
| `endpoint_not_found` | 工具目录服务未安装或版本不兼容 | 重新检测；检查 web profile host/client |
| `host_unavailable` | 工具目录服务暂不可用 | 重新检测 |
| `contract_mismatch` | 工具目录合同不兼容 | 更新匹配版本 |
| `storage_unavailable` | 无法保存启停偏好 | 保持旧状态，可重试 |
| `catalog_unavailable` | 工具目录不可用 | 活动保持可用 |
| `unknown` | 无法读取工具目录 | 折叠安全技术摘要 |

primary UI 只显示 code 对应的 locale copy；技术详情最多包含 code 和脱敏 safe summary，禁止 raw JSON/stack/request body。重新检测只做安全 read/probe，不自动执行 mutation。

### 7. 启停仍由 CAS 决定，不做 optimistic success

- 点击后仅该 row 进入 pending；其他目录行仍可读。
- 成功或 generation conflict 后 authoritative refresh。
- conflict 显示“目录已变化，已重新加载”；用户可重新操作。
- storage/transport failure 不改变当前 UI enabled state。
- 关闭条目只影响后续 `ctx.tools.guard` admission，不取消已运行调用；详情区明确说明。

### 8. 所有可见 copy 进入 locale

组件通过传入的 `t()` 读取 `mcpInspector` namespace。新增状态、详情、错误、筛选、活动模式、时间/耗时、健康与验收相关 keys；English 作为 fallback dictionary，不在 JSX 中散落业务文案。

### 9. 浏览器证据只增加一个最小 Playwright lane

现有 Vitest 能验证纯函数和 DOM 语义，但不能产出固定容器宽度截图、focus 与 reduced-motion 证据。新增一个 package-local Playwright fixture/runner，仅渲染静态 Tools tree states，不启动官方 `dsh web`，避免把上游 host seam 变成完成门。若依赖造成环境问题，rollback 为移除 Playwright dev dependency，保留 Vitest 与人工浏览器 fixture；但没有截图证据时不得通过本 change 人工 gate。

### 10. 人工验收回执由 CLI 生成

`pnpm run ui:acceptance` 提供：

- `prepare --change <id>`：创建 run 目录，运行截图 lane，写 minimum evidence files、board 和 checklist。
- `record --run-id <id> --decision accept|reject --reviewer-role <role>`：读取当前 commit、受影响源码 digest 与截图 SHA-256，生成 `human-acceptance.json`；若源码已不同于 prepare 时的状态则拒绝记录。
- `verify --run-id <id>`：校验 decision=accept、commit 与受影响源码状态未变化、必需截图存在且 digest 一致、summary passed。

结构化 JSON 均由脚本生成。回执只记录 reviewer role，不记录 credential/个人敏感信息。Agent 不得自代人工执行 `record --decision accept`。

## Interaction State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale |
| --- | --- | --- | --- | --- | --- |
| Catalog | compact rows skeleton | 解释当前无条目 + recheck | 安全 alert；Activity 不隐藏 | dense list + coverage | partial banner + known rows |
| Search/filter | controls disabled only before catalog ready | clear filters action | no independent error | result count | selected detail closes if item filtered out |
| Toggle | row pending; no optimistic flip | N/A | old state retained + localized reason | authoritative refreshed row | generation conflict refresh |
| Activity | session snapshot settling note | compact contextual empty | malformed records dropped | list/timeline | missing duration `—` |
| MCP health | N/A | not reported | unknown, never guessed offline | connected/disconnected/syncing | >60s displays stale |
| Details | disabled until selection | explanation | item disappeared returns Activity | safe metadata + recent activity | unsupported facts labeled unavailable |

## Accessibility And Motion

- status strip、coverage、tabs、filters、rows、details 均有 landmark/heading/label；状态不只靠颜色。
- family 使用 segmented buttons；state 使用 native `<select>`，避免引入 dropdown library。
- row name 是独立 details button；toggle 是独立 button/`aria-pressed`，不嵌套交互控件。
- timeline 同时渲染可读 list/ARIA summary；图形不是唯一信息来源。
- 只对 hover/focus/background 做短 CSS transition；无 bounce、stagger、连续 glow。`prefers-reduced-motion` 关闭非必要 transition/shimmer。

## Risks / Trade-offs

- [Dirty worktree overlaps target files] → 只做局部 patch，先读当前内容；不恢复 HEAD、不覆盖锁文件并行变更。
- [Health provider 当前不存在] → provider-present fixture 验 consumer；真实 provider adoption 独立交付，不伪造 production-ready。
- [Container-query support] → 当前 DSH Web 目标浏览器为现代 Chromium；fallback 为单列 flow，核心内容仍可读。
- [Screenshot dependency cost] → 只加 package-local dev dependency，不引入 runtime 依赖或动画库。
- [Large sessions] → summary 对全部安全记录计数；UI 只渲染最近 200 条，避免新增 virtualization 依赖。
- [Human receipt becomes stale] → receipt 绑定 commit、受影响源码 digest 与 artifact digests；任何代码/截图变化必须重新验收。

## Migration Plan

1. 创建并验证 OpenSpec；冻结 additive wire shape。
2. host/client mirrors 同步 optional fields，增加 old/new contract tests。
3. 新活动派生与 UI 双栏落地；保留所有旧 export/id。
4. 增加 screenshot/evidence/acceptance CLI，运行自动门禁。
5. 进入 `awaiting_human_acceptance`：不由 Agent 写 accept 回执。
6. 人工 accept 后运行 verify，再归档 change。

Rollback：回退 UI/tree/styles/activity/optional projection 相关 commit，重新发布上一版 bundle；旧 `toolHub.list@1` 与 prefs 数据无需迁移。若只回退 provider health，可停止发送 optional health 字段，客户端自动显示未提供。

## Open Questions

无。真实 `ctx.mcpServers` provider 的发布与上游接入是独立后续，不阻塞本 change 的 consumer/degraded 合同与人工 UI 验收。
