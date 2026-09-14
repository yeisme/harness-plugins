# @yeisme/dsh-template-registry-bundle

DSH 可安装 bundle：模板目录（`template-registry.catalog`）与引导编译（`template-registry.compile`）两个 pane，加 `/template catalog`、`/template compile` 命令入口。变更：`openspec/changes/dsh-template-registry-integration-v1/`；集成参考（目录/编译/降级/恢复/权限边界）：[docs/design/dsh-template-registry-panes.md](../../../docs/design/dsh-template-registry-panes.md)。

## 结构

- `@yeisme/dsh-template-registry`（host 库）：stdio MCP 连接管理、目录/会话 typed RPC、`yeisme_template_registry_v1` 存储 domain、`templateRegistryCompile` 会话投影。host 侧根入口是 no-op cordis 插件；把 `createTemplateRegistryService(...)` 组装为 `templateRegistryHost` Remote 是宿主运行时（profile）的组合步骤。
- `@yeisme/dsh-client-ui-template-registry`（client）：浏览器面 `./client` —— capability probe（pane 槽 + `templateRegistryHost` 结构校验）通过后注册两个 pane 与命令；probe 未过时不注册任何入口，只在 context 提供 probe-only face（`templateRegistryPane`）并携带禁用原因。

## 目录（catalog pane）

连接态经 `template_registry_list`/`search` 浏览（13 维 browse 过滤对齐）；详情抽屉来自 `template_registry_inspect` 的合同（中英 i18n 标签、必填与长度约束——引导表单唯一事实源）；预览为 inspect 派生受限 DTO，rights 不允许时 fail-closed（禁用 + 稳定原因码）。

## 编译（compile pane）

合同表单（host inspect 合同为唯一事实源）/ 确认门（显式 `decision_ref = dsh.template-registry.confirm.v1.<session>.<revision>`，仅在用户点击时提交，绝不自动）/ 结果卡（`provider_calls = 0` 声明）/ 导出（digest 漂移禁用 + 重新固定）。本 bundle 不产生任何模型调用。

两个 host 侧翻译由 host 库拥有（4.1 真实二进制实测发现）：

- 字段 wire 键：owner 要求 `<step-id>.<输入名>`（如 `main.asset_ref`）；pane 与投影保持合同名规范形，host 在 wire 边界翻译。
- `decision_ref` 分隔符：owner 字符集 `^[a-zA-Z][a-zA-Z0-9_.-]{0,159}$` 拒绝冒号，因此用 `.` 分隔。

## 降级（诚实三态）

- `connected`：探针过（initialize 身份 + `tools/list` ⊇ 9 工具集），全功能。
- `degraded`：探针失败/传输断开且 promptrepo `catalog.json` 可读——目录只读降级快照（partial 徽标 + digest 陈旧标注），编译/导出/会话动作禁用；`probe()` 一次探测即恢复。
- `offline`：无 MCP 且无 catalog，不捏造数据。
- 断开折叠为常量 `template_registry_disconnected`；owner 错误码（`REVISION_CONFLICT`/`FIELD_INVALID`/`USER_DECISION_REF_REQUIRED` 等）原样透传。

## 恢复（无 CLI 场景）

未安装 template-registry CLI 的 profile 下 pane 仍可用：参数与恢复合同全部来自 MCP `tools/list`/`inputSchema`。重开时编译会话从 `templateRegistryCompile` 投影折叠 + `compile_sessions` 存储行恢复（字段、确认态、双 digest、compileId 完整；键按 DSH 会话隔离）；导出门：digest 未漂移 ⇒ 可导出，漂移 ⇒ `digest_stale` 禁用直至重新固定，seam 断开 ⇒ host guard `degraded` 拒绝。

## 权限边界

- 浏览器只收 safe projection（exact ref、digest、标题/摘要、tags/capabilities、rights、合同输入 schema、有界预览）；不传 token/cookie、绝对路径、raw 模板正文、provider payload、`template-registry://session/**` 私有资源。
- rights 双层 fail-closed：未知/缺失按无权限；preview/export 各需自身合同权限。
- 编译会话本体留在 owner workspace 项目 store；本域只存投影/恢复合同，不是第二份状态。

## 安装

`dsh plugin add @yeisme/dsh-template-registry-bundle`（等价于本包 `cordis.patch.yml` 的 `dsh-template-registry` 行）。

## 验证

以下命令均实际执行过（2026-09-14）：

```bash
pnpm --dir packages/bundle/dsh-template-registry run test      # metadata + build + smoke → BUNDLE SMOKE: PASS
pnpm --dir packages/client/ui-template-registry run test      # 45 个组件/控制器用例
pnpm --dir packages/host/template-registry run test           # 145 个 host 用例（含 4.1 回归）
pnpm run check:bundles                                        # client.js 自包含（无 @yeisme/* require）→ 29/29 PASS
pnpm run check:surfaces                                       # adopted Surface 分类 → 29 client 通过
```

真实二进制与无 CLI 场景验收（4.1）：

```bash
TEMPLATE_REGISTRY_BIN_DIR=<bin-dir> TEMPLATE_REGISTRY_SOURCE=file://<官方内容仓> \
  pnpm --dir packages/host/template-registry run smoke:real-binary        # → run.json (passed)
TEMPLATE_REGISTRY_BIN_DIR=<bin-dir> TEMPLATE_REGISTRY_SOURCE=file://<官方内容仓> \
  TEMPLATE_REGISTRY_CATALOG_FILE=<catalog.json> \
  pnpm --dir packages/host/template-registry run smoke:no-cli-recovery     # → 21/21 ok
```
