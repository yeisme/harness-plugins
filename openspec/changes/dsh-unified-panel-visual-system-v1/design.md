## Context

用户产品阶段：创作侧 owner 工具（host 合同、投影、action gateway）已完成，下一步是面板交互体验与统一风格。现状是"四代样式并存"：creator-studio 自绘 CSS、pane-workbench chrome token fallback、desktop-workbench/subagent 同义词词汇、domain panes 完全无样式；同一 `--dsw-alias-*` token 名在仓库内携带 2–4 个 fallback（`region-chrome.ts` 单文件内 `bg-elevated` 4 值），状态色/圆角/控件高度/交互底线各异。完整审计表见 `docs/design/dsh-unified-panel-visual-system.md` §1。

## Goals / Non-Goals

Goals：
- 一个 token registry（canonical 名 + 唯一 fallback + 同义词归一），官方 host 变量始终优先。
- 一个 scoped 面板 chrome 构建器（base/chrome/state 三层），交互底线齐备。
- 按用户价值分片采纳：先零样式的 domain panes 与 creator-studio，再 chrome 与工具面板。
- 采纳面板有样式断言测试，防回归。

Non-Goals：
- 不定义 host 主题、不写宿主变量、不 fork DSH core、不引入 CSS runtime/新重依赖。
- 不改 owner/host 合同、投影数据、mutation 门。
- 不把官方 `dsh web` 合入/截图/host 变量存在作为完成门。
- commodity-parked lane（chrome 拆分、codicons、xterm、390px chrome tokens）不复活。

## Decisions

| 决策 | 理由 | 代价/风险 |
|---|---|---|
| 新包 `@yeisme/dsh-client-ui-visual-kit`，零运行时依赖 | 面板 bundle 各自内联一份相同规则串，避免共享 runtime/版本协调；scope 隔离使重复无害 | 每包 bundle 体积 +~2-3KB；接受 |
| token fallback 只在面板根 `[data-<scope>]` 单点声明（`--vk-*` 链到 host 变量） | 结构性杜绝"同 token 多 fallback"；host 定义仍优先 | 调试时需看根块变量 |
| canonical 值选择规则：chrome 容器值优先，否则众数 | 面板与所居住的 Pane 框架视觉连续 | creator-studio 底色从 `#151517` 归一到 `#171719`（微调，测试保障结构不回退） |
| 状态 tone 五档 + 词表外 neutral | 与 creator-studio 已发布语义一致；诚实降级 | 词表维护在 kit 单点 |
| domain pane 空态不设手动重试按钮 | `DomainOwnerSourceBridge.reread()` 合同限定 open/transport 恢复；仓库纪律禁 unknown/offline 自动 retry | 空态文案解释自动权威重读；未来 host reconcile action 可作 recovery 入口 |
| creator-studio 采纳走 `extra` 保留 cs-* 设计语言 | 避免重写 views markup 的大改风险；token/状态色/scope 已归一 | cs-* 类名保留，后续切片可逐步换 vk-* |

## Risks / Trade-offs

- 各面板样式串重复内联：接受（无共享 runtime 的代价）。
- 视觉微调（底色、secondary 文本色）：canonical 化的目的本身；结构断言 + views 渲染测试保障不回退。
- 同义词迁移期新旧名并存：registry 映射保证同 fallback，视觉无差。

## Migration Plan

1. kit 落地（2.x）→ 2. domain panes（3.1，零样式→统一 chrome）→ 3. creator-studio（3.2，token 归一）→ 4. chrome fallback 归一（3.3）→ 5. 工具面板（3.4）→ 6. desktop-workbench/subagent 同义词迁移（3.5）。每步独立可回滚（移除依赖与 `<style>` 注入即回退）。

## Open Questions

- host 是否会在未来发布官方 design-token 文档/`--dsw-alias-*` 权威清单？若发布，registry 以 canonical 名对齐，fallback 语义让位（上游 canary 工作流跟踪）。
