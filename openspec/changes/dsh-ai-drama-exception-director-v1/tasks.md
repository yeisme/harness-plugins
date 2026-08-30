## 1. 异常优先默认投影

- [ ] 1.1 将默认 `director` preset 收敛为 Context、Review、Run；Story/Visual/Audio/Delivery 与旧 `show-control` 转为按需打开的 legacy/advanced 视图，additive，不删除既有 pane 实现。
- [ ] 1.2 实现 `/drama` 默认投影：当前 context、primary blocker、影响范围、owner reason、一个 owner-approved next action 与 Review/Run/Delivery 深链；多阻塞只呈现排序后首个并给出计数与 Workbench 深链。
- [ ] 1.3 固定 unknown/partial/stale/owner 不可用行为：显示 typed 状态并禁用 mutation；不自动 retry、不替换 writer、不从展示状态推断 owner 终态。

## 2. 共享 decision token consumer

- [ ] 2.1 接入 owner-authored decision token 的 typed action 消费（费用、版权、canonical accept、外编 apply、final export），提交一律先呈现 exact target/effect/owner/expiry preview 并以 server-minted token CAS。
- [ ] 2.2 实现幂等 receipt 刷新：已终态 token 返回原 receipt 或 stale/already_decided 时只 refetch；digest/context revision 漂移返回 stale 并禁用 mutation；不建本地审批状态机。

## 3. Handoff 与兼容窗口

- [ ] 3.1 Workbench/外编 handoff 只传 Bridge V2 语义（`DramaContextRef`/`ArtifactRef`/`ActionIntent`/`ReceiptRef` + launch ref）；拒绝 raw route/URL/绝对路径；不信任 DSH 缓存为 canonical state。
- [ ] 3.2 旧 full-show operational panes 标记 deprecation 与 Workbench handoff，保留至少两个连续插件发布窗口，读取相同 owner projection 并记录使用率；退役由后续独立 removal change 处理。
- [ ] 3.3 确认未复制 Workbench scene graph、Scaena `EditRevision`/bundle/diff/rebase、Ordo ledger；不建 scheduler、writer lease、approval ledger、capacity reservation 或 terminal result。

## 4. 证据与回滚

- [ ] 4.1 异常优先投影、decision 幂等、legacy pane deprecation 的组件 golden 与契约用例；digest 漂移、duplicate decision 正负用例。
- [ ] 4.2 集成运行写 `temp/integration-test-runs/<run-id>/`（summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/），脱敏 secret/raw prompt/private tool args/absolute path，失败保留原始 exit code。
- [ ] 4.3 验证命令：`cd agent/harness-plugins && openspec validate dsh-ai-drama-exception-director-v1 --strict --no-interactive`、`pnpm run typecheck`、`pnpm run test`、`pnpm run build`、`pnpm run check:bundles` 全绿；回滚 = 恢复旧导航优先级，不改 owner state。
