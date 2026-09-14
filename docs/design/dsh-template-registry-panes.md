# 模板仓库：目录与引导编译 Pane

状态：已实现并通过无 CLI 场景验收（`dsh-template-registry-integration-v1` 4.1/4.2）。host 侧以 template-registry 本地 stdio MCP 为主通道，promptrepo `catalog.json` 为只读降级；本页是集成参考，覆盖目录、编译、降级、恢复与权限边界。

唯一任务入口：[tasks](../../openspec/changes/dsh-template-registry-integration-v1/tasks.md)；[完整设计](../../openspec/changes/dsh-template-registry-integration-v1/design.md)；[实施基线（真实 stdio MCP 实测）](../../openspec/changes/dsh-template-registry-integration-v1/implementation-baseline.md)。

## 组成

| 包 | 角色 |
|---|---|
| `packages/host/template-registry` | stdio MCP 连接管理（固定 argv `mcp serve`）、目录/会话 typed RPC、`yeisme_template_registry_v1` 存储 domain、`templateRegistryCompile` 会话投影 |
| `packages/client/ui-template-registry` | 浏览器面：目录 pane（navigator Surface）与引导编译 pane（workspace Surface）、typed host seam（`templateRegistryHost`） |
| `packages/bundle/dsh-template-registry` | 可安装 patch 层：两个 pane + `/template catalog`、`/template compile` 命令；probe 未过时零注册 |

## 目录（catalog pane）

- 数据源：连接态 `template_registry_list`/`search`（browse 维度对齐 13 维过滤）；过滤 query/tag/capability 双侧折叠。
- 详情：`template_registry_inspect` 返回的合同（contract `inputs[]` 含中英 i18n 标签、必填与长度约束）是引导表单唯一事实源。
- 预览：无独立预览工具，由 inspect 合同派生受限 DTO；rights 不允许时 fail-closed（禁用 + 稳定原因码）。

## 编译（compile pane）

旅程：pin 合同 → 填字段 → 显式确认 → 编译 → 导出。

- **字段 wire 键翻译（4.1 实测发现）**：owner 侧字段键为 `<step-id>.<合同输入名>`（如 `main.asset_ref`），直接提交未加前缀的合同名会被拒 `FIELD_INVALID`。pane 与投影保持合同名规范形，host 在 wire 边界翻译（`toWireFieldKey`/`fromWireFieldKey`，step id 从 session 视图 `steps[]` 学习并在 host 服务实例内记忆）。
- **确认门**：`decision_ref` 仅在用户点击确认时提交，格式 `dsh.template-registry.confirm.v1.<session>.<revision>`。owner 校验字符集 `^[a-zA-Z][a-zA-Z0-9_.-]{0,159}$`——冒号分隔的旧写法会被拒 `USER_DECISION_REF_REQUIRED`，因此分隔符为 `.`。
- **编译零模型调用**：`compile` 后 owner 的 `facts.provider_calls` 必须为 0，否则 host fail-closed 丢弃结果；结果卡显式声明 `provider_calls = 0`。
- **导出**：回执只含 owner 相对 `outputRef`（compile id、digest、providerCalls=0），不暴露绝对路径；digest 漂移禁导出（见下）。

## 降级（诚实三态）

| 状态 | 条件 | 行为 |
|---|---|---|
| `connected` | initialize 身份校验 + `tools/list` ⊇ 9 工具集 | 全功能 |
| `degraded` | 探针失败/传输断开 **且** `catalog.json` 可读 | 目录只读降级（partial 徽标 + 快照 digest 陈旧标注）；编译/导出/会话动作禁用，预览 fail-closed（目录无合同权限） |
| `offline` | 无 MCP 且无 catalog | 不捏造任何数据 |

断开检测：传输失败折叠为常量 `template_registry_disconnected`，目录读取回落 catalog；`probe()` 重新拉起子进程，一次探测即恢复。owner 错误码（`REVISION_CONFLICT`、`FIELD_INVALID` 等）原样透传，不算断开。

## 恢复（无 CLI 场景，4.1 验收）

未安装 template-registry CLI 的 profile 下 pane 仍可用：参数与恢复合同全部来自 MCP `tools/list`/`inputSchema`（如 `inspect` 必填 `ref`、`session_confirm` 必填 `decision_ref`），不依赖本机 CLI。重开恢复链：

1. **投影折叠**（`templateRegistryCompile`）：按 dsh-context sessionProjections 合同折叠会话工具流量（`tool/call` 按名+参武装、`tool/result` 按 callId 配对解析信封），恢复字段值（合同名规范形）、确认态、`decision_ref`、digest、compileId；有界（会话环 8/digest 图 128/挂起 32）。
2. **存储行**（`yeisme_template_registry_v1` 表 `compile_sessions`，键按 DSH 会话隔离）：携带 exact ref + 双 digest + `confirmedKeys` + revision/readiness 的恢复合同；跨会话互不可见。
3. **导出门**：投影侧 digest 未漂移 ⇒ 可导出；漂移 ⇒ `digest_stale` 禁用直至 owner 显式重新固定；seam 断开时 host 侧 export 以 guard `degraded` 拒绝（诚实降级，不伪装成功）。

实测证据（脱敏）：`temp/integration-test-runs/template-registry-no-cli-recovery-2026-09-14T20-45-45-626Z-1932775/summary.json`——connected 相（真实二进制）走完整 pane 旅程并折叠投影，reopen 相（PATH 无二进制）21 项检查全过：字段/确认/digest/compileId 完整恢复、跨会话隔离、未漂移可导出、漂移禁导出、无 CLI 导出被拒。

## 权限边界

- 浏览器只收 safe projection：exact ref、digest、标题/摘要、tags/capabilities、rights、maturity、合同输入 schema、有界预览、action。不传 token/cookie、绝对路径、raw 模板正文、provider payload。
- rights 双层 fail-closed：`deny`/`blocked` 权限或 `blocked`/`prohibited` rights 级别一律无权限；preview/export 各需自身合同权限；未知值按无权限。
- `template-registry://session/**` 5 个资源模板均为 owner 私有域，不进投影；`repository_*` 管理、`bundle_import`、`session_read` 不经浏览器触发；`report`（destructive）不消费。
- 编译会话本体留在 owner workspace 项目 store；DSH 侧只存投影/恢复合同，不是第二份状态。unknown/stale 只禁 mutation 并要求 owner 对账。

## 验证

以下命令均实际执行过（2026-09-14，develop 分支）：

```bash
# host 单测（含 wire 键翻译、降级三态、投影折叠、恢复合同回归）
pnpm --dir packages/host/template-registry run test
# → Test Files 12 passed (12)；Tests 145 passed (145)

# client 组件/控制器用例
pnpm --dir packages/client/ui-template-registry run test
# → Test Files 4 passed (4)；Tests 45 passed (45)

# bundle：metadata 校验 + 自包含构建（client.js 245.99 kB CJS，零 @yeisme/* require）+ ModuleLoader smoke
pnpm --dir packages/bundle/dsh-template-registry run test
# → BUNDLE SMOKE: PASS（install 1 / duplicate 1 / reinstall 1 / probe-fail 0）

pnpm run check:bundles     # → BUNDLE CONTRACTS: 29/29 PASS
pnpm run check:surfaces    # → Web surface conformance passed (29 client, 8 bundle packages)

# 真实二进制 smoke（wave2 证据；TEMPLATE_REGISTRY_BIN_DIR 指向含 template-registry 二进制的目录）
TEMPLATE_REGISTRY_BIN_DIR=<bin-dir> TEMPLATE_REGISTRY_SOURCE=file://<官方内容仓 checkout> \
  pnpm --dir packages/host/template-registry run smoke:real-binary
# → evidence: .../template-registry-wave2-real-binary-<run>/run.json (passed)

# 无 CLI 场景验收（4.1；connected 相用真实二进制，reopen 相 PATH 无二进制）
TEMPLATE_REGISTRY_BIN_DIR=<bin-dir> TEMPLATE_REGISTRY_SOURCE=file://<官方内容仓 checkout> \
  TEMPLATE_REGISTRY_CATALOG_FILE=<catalog.json 路径> \
  pnpm --dir packages/host/template-registry run smoke:no-cli-recovery
# → {"outcome":"passed","checks":"21/21 ok", ...}

openspec validate dsh-template-registry-integration-v1 --strict --no-interactive
```

注意：`TEMPLATE_REGISTRY_BIN_DIR` 必须指向**当前构建**的二进制（如 backend-server/template-registry 的根 `dist/`）。旧版发布产物（goreleaser 平台子目录，早于 `discovery` 注记进入 catalog）会因 `catalog.json is invalid` 将仓库隔离（quarantined），探针报 `tools_missing`——这是 owner 侧 fail-closed，不是插件缺陷。
