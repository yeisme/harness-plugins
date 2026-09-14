# @yeisme/dsh-client-ui-template-registry

DSH template-registry client plugin（变更 `openspec/changes/dsh-template-registry-integration-v1/`）：

- **模板目录 pane**（`template-registry.catalog`，navigator Surface）：类别/标签/能力过滤、结果列表（主滚动区、方向键 roving 选择）、inspect 详情与 fail-closed 预览权限；状态矩阵全覆盖（loading 骨架 / 离线错误+重试 / 降级 catalog 快照徽标 / 过滤空态+清除 / owner 错误码 / 禁用+原因）。
- **引导编译 pane**（`template-registry.compile`，workspace Surface）：以 host inspect 合同为唯一事实源的表单（中英 i18n 标签、必填/长度约束、待补字段逐条可读）、显式确认门（`dsh.template-registry.confirm.v1:<session>:<revision>` 决策引用仅在用户点击时提交）、编译结果卡（`provider_calls = 0` 声明、焦点移至结果标题）、导出（digest 漂移禁用 + 重新固定路径）。

浏览器面在 `./client`：`apply(ctx)` 先 probe `paneWorkbench` 与 `templateRegistryHost`（结构校验 `dsh.template-registry.host.v1` + 全方法面），未过时只提供携带禁用原因的 probe-only face；通过后注册两个 view 与 `/template` 命令，disposer 精确对称（重复 apply no-op，dispose 后可重建）。

宿主 Remote 由 `@yeisme/dsh-template-registry` 的 `createTemplateRegistryService(...)` 组装提供；本包不直连 stdio MCP，不触碰第二份领域状态。键盘路径：过滤框 → 结果列表（ArrowUp/Down/Home/End）→ 详情 → 表单字段 → 确认/编译/导出；reduced-motion 下关闭过渡与骨架动效（scoped kill switch + 共享 Surface 基线）。

```bash
pnpm --dir packages/client/ui-template-registry run test        # vitest
pnpm --dir packages/client/ui-template-registry run typecheck
pnpm --dir packages/client/ui-template-registry run build
```
