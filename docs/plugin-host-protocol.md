# 插件完成门与 host 协议

Harness Plugins 做产品功能。DeepSeek Harness 只提供 typed 协议面。两边必须分开验收。

## 完成门

插件 change 完成，当且仅当：

1. 插件代码只消费公开协议：slot 名、capability 字符串、typed RPC、receipt。
2. 协议缺失时 capability probe 失败可见：禁用入口并写明原因，不伪造 host。
3. 本仓库 `typecheck` / 包测试 / `build` / `check:bundles` / `openspec validate` 通过。
4. 证据来自本仓库测试或协议 conformance，不要求官方 DSH 已实现该 seam。

下列事项**不是**插件完成门：

- 向 `deepseek-ai/deepseek-harness` 开官方 PR 或等待官方合入
- 启动官方 `dsh web`、真实 profile Playwright、官方 browser runner
- 在插件里实现 AppFrame 几何、Details 优先级、PTY duplex 或其他 host 职责
- 把 `client/deepseek-harness` 源码 fork 当运行时依赖

官方 `dsh plugin add` 与 Web boot 是可选 host 集成。用户文档可以写这些命令；测试门禁不得依赖它们。

## 需要改 host 时

1. 在 `upstream-prs/<slug>/` 固化 patch、new-files、apply.sh、README。
2. 在 staging worktree 对干净上游 checkout apply，并跑该系列 focused 测试。
3. 推 `yeisme/deepseek-harness` 的 `pr/<slug>`。
4. README 登记分支名与 compare URL，状态写 `fork-ready`。
5. 插件继续 probe。官方合入后才把 README 改为 `merged`。

不要向 `deepseek-ai/deepseek-harness` 开官方 PR。也不要在 `yeisme/deepseek-harness` 的 `master` 上开审查 PR：`master` 只跟踪上游，开 PR 会误触发上游 CI，并把版本差显示成自己的 diff。handoff 是分支 + compare URL。

同步 fork master：

```bash
gh repo sync yeisme/deepseek-harness --source deepseek-ai/deepseek-harness
```

## OpenSpec

- 新 capability 用 `## ADDED Requirements`。目标主 spec 不存在时，禁止写 `## MODIFIED Requirements`。
- 归档前确认 `openspec/specs/<capability>/spec.md` 已存在，或本 change 只 ADDED。
- `MODIFIED` 只能改本仓库已有主 spec 里已存在的 requirement 标题。
- 插件 spec 写探测、降级、bundle 合同；不要把 host AppFrame / 官方 CLI / 官方合入写成 SHALL 完成条件。

## 反例

| 错误 | 正确 |
| --- | --- |
| 「等官方合入再勾任务」 | 分支 + compare + 插件 probe 即可勾 |
| 在 `yeisme/deepseek-harness` 的 `master` 上开审查 PR | 只推 `pr/<slug>`，登记 compare URL |
| 「真实 DSH profile Playwright 才算完成」 | 包测试 + 协议 conformance 算完成 |
| `MODIFIED` 一个还不存在的 spec | 先 ADDED，或先归档产生该 spec 的 change |
| 插件实现四列两行几何 | 探测 `workspaceLayout`，缺席则失败可见 |
| fork `master` 停在旧 rc | `gh repo sync yeisme/deepseek-harness --source deepseek-ai/deepseek-harness` |
