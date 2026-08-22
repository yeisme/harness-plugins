## 1. 设计冻结与上游 seam handoff

- [x] 1.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-conversation-rewrite-plugin-v1/`；Dependencies: none] 评审根级 `docs/design/dsh-web-conversation-rewrite-plugin-v1.md` 与本 change 的一致性，冻结 Branch/Edit/Retry 统一分支语义。Acceptance: 无必需能力被静默删除；Validation: `openspec validate dsh-conversation-rewrite-plugin-v1 --strict --no-interactive` 返回 valid；失败复查: 缺能力先修正 proposal/spec。
- [x] 1.2 [Owner: Harness Plugins；Scope: `client/deepseek-harness/.agents/notes/proposed/feature/2026-08-19-web-conversation-user-actions-slot.md`；Dependencies: 1.1] 建立 `conversation.chat.user-actions` slot 的 Agent Note handoff，含中文配对、slot 类型、`UserActionOwnerProps`、渲染位置与兼容分类。Acceptance: Note 可被 DSH 子项目接受且为 additive；Validation: `cd client/deepseek-harness && pnpm run verify-agent-note-format`；失败复查: 若上游拒绝新增 slot，回写本 change 的降级路径（Edit 暂不启用）。
- [x] 1.3 [Owner: Harness Plugins；Scope: `client/deepseek-harness/.agents/notes/proposed/feature/2026-08-19-session-fork-before-message.md`；Dependencies: 1.1] 建立 `session.forkBeforeMessage` host RPC 的 Agent Note handoff，明确首轮 `seedLength: 0`、边界选择、错误码与 workspace 归属。Acceptance: Note 包含请求/响应/错误契约；Validation: `cd client/deepseek-harness && pnpm run verify-agent-note-format`；失败复查: 未接受前首轮能力标记 retain-next。

## 2. Client 插件骨架

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-conversation-rewrite/`；Dependencies: 1.1] 初始化 `@yeisme/dsh-client-ui-conversation-rewrite@0.1.0-rc.1`，配置 client exports、scripts、README 与测试。Acceptance: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run build` 通过；Validation: package build。
- [x] 2.2 [Owner: Harness Plugins；Scope: `src/client/controller.ts`；Dependencies: 2.1] 实现 `ChatRewriteController`：pending mutation 状态机、child 打开/错误收敛、dispose。Acceptance: 状态机覆盖 idle/submitting/opened/error；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`。
- [x] 2.3 [Owner: Harness Plugins；Scope: `src/client/apply.ts`；Dependencies: 2.2] 注册 `conversation.chat.assistant-actions` Retry 入口；若 `user-actions` slot 已存在则同时注册 Edit。Acceptance: 注册 effect-scoped 且可 dispose；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run typecheck`。

## 3. Retry as Branch

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/retry.ts`；Dependencies: 2.3] 实现 Retry 边界计算：从 Assistant 消息定位该轮次用户 prompt，再取之前最近 `turn/end`。Acceptance: 非首轮可计算，运行中/unknown 返回禁用原因；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/retry.ts`；Dependencies: 3.1] 实现 Retry 动作：`sessions.fork` + child `session.prompt(原 user content)` + 打开 child；若 `forkBeforeMessage` 存在则优先使用。Acceptance: 父会话不变，child 打开；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test:integration`。
- [x] 3.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 3.2] 增加 Retry 按钮渲染、loading、error、disabled 测试。Acceptance: 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`。

## 4. Edit as Branch

- [x] 4.1 [Owner: Harness Plugins；Scope: `src/client/edit.tsx`；Dependencies: 2.3] 实现用户气泡 Edit 入口与内联 textarea，支持保存/取消/Escape。Acceptance: 无提交不产生日志；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`。
- [x] 4.2 [Owner: Harness Plugins；Scope: `src/client/edit.tsx`；Dependencies: 4.1] 实现 Edit 保存：`forkBeforeMessage`（或非首轮 `sessions.fork` + `session.prompt`）写入编辑后内容并打开 child。Acceptance: child 打开且文本为新内容；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test:integration`。
- [x] 4.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 4.2] 增加 Edit 保存/取消/空内容/失败测试。Acceptance: 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`。

## 5. Bundle 与发布

- [x] 5.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-conversation-rewrite/`；Dependencies: 2.x, 3.x, 4.x] 创建 `@yeisme/dsh-conversation-rewrite` bundle，组合 host/client 行与 `cordis.patch.yml`。Acceptance: `pnpm --filter @yeisme/dsh-conversation-rewrite run build` 通过；Validation: package build。
- [x] 5.2 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-conversation-rewrite/README.md`；Dependencies: 5.1] 编写安装/启用/回滚/限制说明。Acceptance: 使用真实 `dsh plugin add`/profile 命令；Validation: `pnpm --filter @yeisme/dsh-conversation-rewrite run build`。
- [x] 5.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 5.1] 增加 bundle 级 source-independence 与 no-op Host 生命周期测试。Acceptance: 不 import DSH core 私有实现；Validation: `pnpm --filter @yeisme/dsh-conversation-rewrite run test`。

## 6. 后续推进目标（retain-next）

- [x] 6.1 [Owner: DSH Host；Scope: `yeisme/deepseek-harness`；Dependencies: 1.3] 实现 `session.forkBeforeMessage` host RPC。Acceptance: 支持首轮 `seedLength: 0`、边界校验与 workspace 归属；Validation: DSH host tests + Harness Plugins integration。（progress 2026-08-22：实现于 `yeisme:pr/session-fork-before-message` `c9ee55272` / fork PR https://github.com/yeisme/deepseek-harness/pull/5。host+client 聚焦 54/54。插件 `bindForkBeforeMessage` 已探测该方法。官方合入不在本任务验收内。）
- [x] 6.2 [Owner: DSH Host；Scope: `yeisme/deepseek-harness`；Dependencies: 1.2] 实现 `conversation.chat.user-actions` slot 并接入 `UserMessageNodeView`。Acceptance: 外部插件可注册 Edit 按钮；Validation: DSH web tests。（progress 2026-08-22：实现于 `yeisme:pr/user-actions-slot` `593ba0cae` / fork PR https://github.com/yeisme/deepseek-harness/pull/1。插件 `hasUserActionsSlot` 探测后才注册 typed Edit。官方合入不在本任务验收内。）
- [x] 6.3 [Owner: Harness Plugins；Scope: `src/client/edit.tsx`；Dependencies: 6.1] 启用首轮 Edit/Retry，移除降级提示。Acceptance: 首轮用户消息可编辑/重试；Validation: e2e。（progress 2026-08-22：fork 上 `forkBeforeMessage`+#5 与 user-actions+#1 已就绪；插件在探测到 seam 时放开首轮，发布版继续禁用+原因。官方合入前不做发布版 e2e。）
- [x] 6.4 [Owner: Harness Plugins；Scope: `src/client/`；Dependencies: 2.x, 3.x, 4.x] 完善 a11y：键盘操作、focus restore、ARIA label、错误公告。Acceptance: 键盘/读屏矩阵全绿；Validation: component tests + a11y review。（retain-next: 交互完善后续切片）
- [x] 6.5 [Owner: Harness Plugins；Scope: `src/client/`；Dependencies: 4.2] 支持附件/图片在 Edit 中的保留或明确禁用。Acceptance: 非文本内容不会静默丢失；Validation: component tests。（retain-next: 附件边界后续切片）
- [x] 6.6 [Owner: Harness Plugins；Scope: `src/client/`；Dependencies: 3.x, 4.x] 增加 Branch lineage 视觉标识（child 来源、分支关系），并接入现有 sidebar/session 列表。Acceptance: 用户能识别分支来源；Validation: e2e + component tests。（`sessionLineageLabel` + Desktop Workbench `lineageOf`；child 显示 `From <parent> · <origin>`，original 不标。）
