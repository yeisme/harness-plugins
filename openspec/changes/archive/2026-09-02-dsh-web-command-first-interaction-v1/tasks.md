## 1. 合同与纯状态基础

- [x] 1.1 在 `command-experience-core` 增加 presentation scope、context ranking、`CommandDetailProjectionV1` 与稳定 tie-break 纯函数，并保持现有 descriptor shape 兼容；detail 只能从 descriptor/capability 派生。
- [x] 1.2 增加 `CommandDraftV1` reducer 状态、逐层 Escape、唯一前缀补全、selector/argument/confirmation/receipt 转移和纯 keymap 测试。
- [x] 1.3 新建 `dsh-session-status` Host package，定义 `session.status.snapshot.v1alpha1`、strict schemas、safe refs、bounded limits 与 redaction tests。
- [x] 1.4 新建 `ui-session-status` Client package与 wire mirror，增加 Host/Client parity、unknown-field、credential-shaped payload 和短 shape 降级测试。

## 2. 双入口命令交互

- [x] 2.1 在官方 Composer seam 上接入最多 8 行的 Slash Assist，复用 live directory/reducer，禁止首次发现 RPC 与 DOM patch。
- [x] 2.2 将全局 `Ctrl/Cmd+K` Palette 改为同目录完整投影，补分组、最近命令、command detail、disabled/not-applicable reason、no-results 和 focus return。
- [x] 2.3 实现 command token、argument/selector steps、原 draft 恢复和 Composer 紧凑 model/preset/reasoning/permissions controls。
- [x] 2.4 实现 safe/confirm/destructive 三档确认；将 owner preview、receipt、stale/permission gates 接到既有 adapter。
- [x] 2.5 为旧 Command Menu seam 保留 probe-first fallback，并测试新壳缺失时既有命令继续可用。

## 3. Receipt、Activity 与 Pane handoff

- [x] 3.1 实现 Composer receipt lane：pending 防重复、success 4 秒折叠、error/partial/stale 保持及 accessible announcement。
- [x] 3.2 实现只读 `workspace.command-activity` navigator，从官方 `command/run|done` 恢复 durable timeline，不创建客户端日志。
- [x] 3.3 接入 result presentation descriptor 与 `paneWorkbench.openView()` preview/resourceKey/singleton；Pin、交互和 Pane 缺失 fallback 按 spec 验证。
- [x] 3.4 验证 command result 不进入模型历史、Activity 不含 raw prompt/provider payload/private args。

## 4. Session Status Host 与三层 UI

- [x] 4.1 接入 session identity/lifecycle 与 runtime summary owner sources；每个 source 独立 probe/freshness/reason。
- [x] 4.2 接入官方 tokenMeter/model context metadata；仅在 owner facts 完整时发布 used/limit/remaining，禁止 process-ledger 推导。
- [x] 4.3 增加 Provider limit adapter registry 与最多 4 个 bounded window；无 adapter 时返回 unsupported/unavailable，不从 balance 推导。
- [x] 4.4 实现 Header `SessionStatusCapsule`、Popover 与 `workspace.session-status` Pane，共用 view model、threshold tone 和 Tokens/Activity deep links。
- [x] 4.5 将 `/status` 接到同一 snapshot，按 Popover → Pane → safe text 顺序降级并保留 durable command events。
- [x] 4.6 保留并回归 `token-usage-open`、`workspace.token-usage`、overlay fallback 与 balance refresh 的原有行为。

## 5. Composer 建议、响应式与视觉系统

- [x] 5.1 将下一步建议默认收敛为 turn-end 后 1–3 个 chip，点击只写草稿；多选/并行移入显式展开面。
- [x] 5.2 使用 `ui-visual-kit`/`ui-surface` 统一 Slash Assist、Palette、receipt、Popover、Sheet 与 Pane 的 token、tone、radius、border 和 typography。
- [x] 5.3 实现 1024px+ anchored surface、768–1023px Sheet、<768px 全宽层与 ≥44px coarse-pointer hit targets。
- [x] 5.4 覆盖 nested Escape、active descendant、focus trap/return、screen-reader announcement、reduced motion 和 RTL/i18n-safe layout。

## 6. First-support 命令与集成验证

- [x] 6.1 将 `/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions` 接入统一主干并覆盖 success/disabled/stale/permission/owner-error。
- [x] 6.2 对完整当前 P0 catalog 做目录回归：五类命令、aliases、owner、danger、coverage、availability、disabled/not-applicable reason 与 canonical receipt 均不漂移；P1 候选无 handler 时不得出现可点击占位。
- [x] 6.3 增加真实 commands runtime + session events + Pane seam 的 integration runner，证据写入 `temp/integration-test-runs/<run-id>/`。
- [x] 6.4 增加 1440×960、1024×768、390×844 Playwright journeys 与 screenshots：slash、Palette、command detail、status、warning/critical、confirmation、Activity、Pane fallback。
- [x] 6.5 运行相关 package tests、typecheck、build、bundle conformance 与 `openspec validate dsh-web-command-first-interaction-v1 --strict --no-interactive`。

## 7. 文档、上游 seam 与 closeout

- [x] 7.1 更新 slash cookbook，说明完整 P0 命令族、双入口、command detail、结构化 token、确认、receipt、Activity、P1 边界与旧 fallback；中英文保持一致。
- [x] 7.2 为 status projection、Provider adapter、privacy boundary、fallback 和真实验证命令补 package README。
- [x] 7.3 若官方 Composer/Header/context seam 缺失，创建最小 `upstream-prs/<slug>/` patch/README/Agent Note；插件完成门仍保持 fail-visible local contract。
- [x] 7.4 完成稳定 diff review、compatibility 分类、evidence 索引和 OpenSpec closeout；不得把工作区工具或 Agent/Ordo 全迁移混入 V1 完成门。
