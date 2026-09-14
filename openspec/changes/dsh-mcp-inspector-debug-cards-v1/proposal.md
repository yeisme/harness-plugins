# dsh-mcp-inspector-debug-cards-v1

## Why

两个消费侧痛点，根方案已冻结（根仓 `openspec/changes/aigora-mcp-gateway-sidecar-unified-key-v1` §6.6 指定 DSH owner 交付"inspector 失败解码卡+能力地图卡"）：

1. **MCP 失败对使用者是黑盒**。ui-mcp-inspector pane 已能观察 MCP 调用错误（ConversationSnapshot 派生的 `errorCode`/`errorName`、`toolHub` client error code），但使用者拿到 401/403/空 tools/-32601 仍要去翻文档才能知道"这是什么、下一步做什么"。根仓已冻结消费者可见失败分类法（同 change §6.2，specs/aigora-mcp-observability-projections「Consumer-visible failures SHALL use the frozen taxonomy」）：`unauthenticated | permission_denied_or_unknown_action | approval_required | budget_exceeded | rate_limited | upstream_unavailable | protocol_error`（rate/budget 带 bounded `retry_after_seconds`）。该分类法目前没有任何消费侧 UI 呈现。
2. **能力发现靠手写速查**。哪些 Gateway 能力可用、公开名怎么拼，目前靠人肉维护的手写快速卡（gateway 消费者技能/文档的速查内容），漂移无人知。Gateway 侧将交付 `gateway_connect_doc.v1` 只读投影（compact faces + `doc_digest` digest_sha256_16）；消费侧缺一个"以连接文档为唯一真源、digest 漂移可见、漂移后显式重新发现"的能力地图。

## What Changes

既有 ui-mcp-inspector pane（`packages/client/ui-mcp-inspector`，pane kind `mcp-inspector`/`tools-manager` + `conversation.view` tab）内**新增两张 additive 卡，不加新 tab**：

1. **失败解码卡（failure-decode card）**：把会话内观察到的 MCP 失败信号映射到冻结分类法，每码渲染 `{title, likely causes, next actions}`；复用既有 doctor/smoke 失败语义（401→`unauthenticated`、403/空 tools→合并码、`approval_required`、`budget_exceeded`、-32601→`protocol_error`）。`permission_denied_or_unknown_action` 渲染**单一合并态**，next actions 在两种解释下都成立（capability 搜索拼写核对、申请授权、预算内重试）；卡 MUST NOT 区分策略拒绝、错名与故障（存在性预言机是根仓冻结治理决策），并以合同测试钉死合并态不可拆分。无法安全归类的信号呈显式 undecoded 态，不猜。
2. **能力地图卡（capability-map card）**：Gateway 连接文档可用时消费 `gateway_connect_doc.v1`（compact faces + `doc_digest` digest_sha256_16），取代手写快速卡；显示 digest 新鲜度，digest 漂移时显示 mismatch 横幅并链接到重新发现（恰好一次 tools/list，永不自动调用）；连接文档不可用时诚实降级（禁用态+原因），MUST NOT 静默回退到陈旧数据。

交付形态为三包形态增量：host 只读投影按需落在 `packages/host/dsh-tool-hub`（connect-doc 投影 + 一次性 re-discovery 动作），client 卡片组件落在 `packages/client/ui-mcp-inspector`，经既有 `@yeisme/dsh-mcp-inspector` bundle 注册（不加新 bundle）。**本 change 是设计工件 only**：任务面向后续实现，本次交付 proposal/design/tasks/spec delta。

## Boundary Decision

`split-owner`：失败分类法与连接文档的语义真源在根仓冻结合同与 Gateway owner——`gateway_connect_doc.v1` 由 Gateway 从已批准绑定与当前暴露自动派生（只读投影，不加审批权）；DSH 侧只做只读消费与呈现。浏览器 MUST NOT 直连 Gateway（无任意 fetch）；re-discovery 走 host 提供的 server-authored 动作。本 change 对在途 `dsh-mcp-inspector-v1`（6/7，待归档）零改动、零阻塞：只做 additive 扩展，不触碰其 L2 seam 任务。

## Capabilities

### New Capabilities

- `dsh-mcp-inspector-debug-cards`：inspector pane 内两张 additive 卡的呈现合同——失败解码（冻结分类法映射 + 合并码单一状态不可拆分 + bounded retry_after_seconds）与能力地图（connect doc 消费 + digest 漂移横幅 + 显式一次性 re-discovery + 无静默陈旧数据）。

### Modified Capabilities

无（`dsh-mcp-inspector` 主 spec 尚未同步入库，本 change 不触碰；既有 `toolHub` wire 合同 `list`/`setEnabled` 保持不变）。

## Impact

- 触碰 `packages/client/ui-mcp-inspector`、`packages/host/dsh-tool-hub`、（如需 additive 导出）`packages/bundle/dsh-mcp-inspector`；无新包、无新 tab、无 pane kind 变更、无官方 DSH seam。
- 外部依赖：Gateway `gateway_connect_doc.v1` 投影（根 tasks 6.4，gateway owner change 未建）落地前，能力地图卡按能力探针诚实降级（禁用+原因）；失败解码卡不依赖该投影，可先行交付。
- 完成门：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` + `check:plugins`/`check:surfaces`/`test:visual` + `openspec validate dsh-mcp-inspector-debug-cards-v1 --strict --no-interactive`；证据按仓约定脱敏落 `temp/integration-test-runs/<run-id>/`。不含启动官方 `dsh web`（治理约定）。
