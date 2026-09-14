# 模板仓库接入基线（dsh-template-registry-integration-v1）

## 当前接入状态

本切片只完成 seam 核对（1.1）与合同冻结（1.2），未写任何 host 连接逻辑或完整 pane。核对对象为三个 owner 仓：

- `backend-server/template-registry`：Go 服务，拥有 prompt 消费闭环（discovery/session/compile/export）与本地 stdio MCP 面（`internal/promptmcp` + `internal/promptprotocol`）。
- `shared/promptrepo`：Go SDK（模板目录/合同/编译引擎的公共库），无 TypeScript 发布面。
- `data/yeisme-prompt-templates`：官方内容仓（`catalog.json` + solutions），53 个 solution。

**证据等级：real（真实 stdio MCP 握手）**。2026-09-14 使用 backend-server/template-registry 发布产物（dist 内 linux/amd64 二进制，compiler 版本 `template-registry.prompt-compiler.v0.2`）在临时目录 spawn `mcp serve`，完成 initialize → notifications/initialized → `tools/list` → `tools/call`（repository_add / repository_sync / list / search / inspect / session_create / session_show / doctor）与 `resources/templates/list` 全链路实测。仓库指向官方内容仓本地 checkout（`file://` 源，trust=reviewed）。样例均为公开目录内容，无 secret/raw prompt/凭据；会话样例是探针自建的一次性会话。

## MCP 工具面（tools/list 实测摘要，脱敏）

服务器 `template-registry`，协议 `2025-06-18`，共 **32 个工具**，命名 `template_registry_<operation>`；每个工具带 `readOnlyHint/destructiveHint/openWorldHint` 标注。按 DSH 消费分组：

| 分组 | 工具（readonly=√） | 关键入参（inputSchema 实测） | DSH 消费决策 |
|---|---|---|---|
| 目录发现 | `list`、`categories`、`capabilities`、`consumers`、`stats`（均 ro=×，ow=√） | BrowseRequest：28 个可选过滤（repositories/categories/media_types/consumers/capabilities/tags/roles/template_locales/maturities/rights/compiler_states/source_states/query/group_by/sort/order/dedupe/metric/limit/offset/refresh/offline…），无必填 | 目录 pane 主数据源；`offline` 支持缓存降级 |
| 搜索 | `search`（ro=√） | `query`（必填）+ `locale/tags/required_capabilities/include_incompatible`，**schema 严格**：多传 `limit` 实测返回 `INPUT_INVALID` | 目录 pane 搜索框；不得假设 BrowseRequest 字段互通 |
| 模板检视 | `inspect`（ro=√） | `ref`（必填）+ `role/locale` | 详情/引导表单的合同来源（inputs/permissions/digest） |
| 会话 | `session_create`、`session_update`、`session_confirm`；`session_show`、`session_list`、`session_history`（后三者 ro=√） | create：`goal` 必填 + `ref/role/locale/recipe/preset`；update：`session_id+expected_revision` 必填（CAS）+ `fields/outputs/delete_fields`；confirm：`session_id+expected_revision+decision_ref` 必填 + `goal/fields/sources` | 编译 pane 全生命周期；`decision_ref` 为 host 侧显式确认凭据，绝不自批 |
| 编译导出 | `compile`；`export` | compile：`session_id+expected_revision` 必填；export：`compile_id+output` 必填 + `mode/step/format/allow_stale` | compile 零模型调用（doctor facts 实测 `provider_calls=0`）；export 落项目文件（见缺口 3） |
| 包 | `bundle_verify`（ro=√）、`bundle_import` | `path` 必填 | 导入导出包校验；本 change 只读校验，import 不接浏览器 |
| 仓库管理 | `repository_add/sync/set/enable/disable/remove`；`repository_list/show/doctor`（后三者 ro=√） | `id/source/revision/trust/all/credential_ref` | host 不做仓库管理 UI；`repository_list/show/doctor` 仅用于连接健康显示 |
| 诊断 | `doctor`（ro=√） | 无 | 已连接时的可选增强（parser/uv/OCR 能力与恢复建议） |

**MCP 面明确排除的操作**（server.go 过滤，保留为本地 CLI 动作）：`analysis.configure`、`parser.install`、`skill.install`、`session.resume`、`session.next`、`recipe.*`。因此无 CLI 恢复只能依赖 `session_show`（readonly）+ DSH 侧投影折叠；recipe 类动作整体留给后续 change。

**资源模板**（5 个，均在 `template-registry://session/**` 私有域）：`state`、`revision/{revision}`、`source/{source}`、`source/{source}/text`、`source/{source}/page/{page}`。owner 明示为私有会话内容，不进浏览器投影。

**返回信封**（每个工具统一）：`spec_version: "1.0"`、`status: success|partial|failed`、`summary`、`facts`（实测见 `id/revision/readiness/next_action/digest/output/provider_calls/complete/compiler/parser_available/uv_available/...`）、`actions[{name,command}]`、`error{code,message,retryable}`、`hints`。错误码实测/源码核对：`REVISION_CONFLICT`（CAS 失败）、`SESSION_STORE_BUSY`（唯一 retryable）、`INPUT_INVALID`、`RIGHTS_DENIED`、`PERMISSION_DENIED`、`TEMPLATE_LOCALE_REVIEW_ONLY`、`TEMPLATE_DIGEST_MISMATCH`、`SOURCE_*`、`PARSER_*`。

### 实测数据形状（脱敏样例）

- **browse 记录**（20 字段）：`ref`（`promptrepo://official/3d/3d-asset-review-beta@1.0.0-beta.1?locale=en&kind=template&role=main` 形）、`digest`、`title/summary/solution_title/solution_summary`、`tags[]`、`capabilities[]`、`consumers[]`、`media[]`、`category`、`repository/solution/role/locale/version`、`rights`（**字符串**，见下）、`maturity`、`compiler_status`、`source_state`、`search_aliases[]`（中英检索别名）。实测规模：112 entries / 111 unique_contents。
- **inspect 返回**：模板身份（ref/address/version/digest/solution_digest/snapshot_digest/locale/role）、`rights`（字符串）、`trust`（reviewed）、`maturity`、`tags/capabilities/title/summary/usage`、`contract{digest, inputs[], license, permissions[]}`、`inputs[]`（含 definition：`name/type/required/min_length/max_length/labels{en,zh-CN}/descriptions{en,zh-CN}` + status）、`issues[]`、`next_action{kind: supply_inputs, required_inputs[]}`、`compiler_status`（`contract_available`；list 侧为 `not_checked`）、`ready`。实测样例 permissions=`["execute_requires_review","preview"]`、license=`internal`。
- **会话视图**（session_create/show 同形）：`id`（`s`+32hex）、`revision`、`readiness`、`issues[]`（`GOAL_CONFIRMATION_REQUIRED` / `INPUT_REQUIRED`（field 带 step 前缀如 `main.asset_ref`）/ `SOURCE_ANALYSIS_REQUIRED` / `SOURCE_CONFIRMATION_REQUIRED` / `RECIPE_INVALID`）、`fields[]`、`sources[]`、`steps[]`（id/status/`needs_step_output`/missing）、`next_action`、`resource` URI。readiness 词表（state.go 核对）：`needs_input | needs_analysis | needs_confirmation | ready_to_compile | blocked`；next_action 词表：`session.update | source.analyze | session.confirm | compile | inspect`。
- **doctor facts**：`compiler` 版本、`parser_available=false`、`uv_available=true`、`local_ocr_available=true`、`analysis_backend_configured=false`、`provider_calls=0`（含恢复建议命令）。

### rights/permissions 模型（源码核对）

- solution 级 `rights` 字符串词表（catalog 实测）：`internal | free-evaluation | external-attributed`；编译期 pin 另见 `blocked/prohibited` → `RIGHTS_DENIED`。
- 模板合同级 `permissions[]` 词表：`preview | export | execute_requires_review | deny | blocked`；`deny/blocked` → `PERMISSION_DENIED`，`preview/export` 任一存在才放行（compile.go 核对）。
- 结论：脚手架的 `rights:{preview,export}` 布尔是**派生安全投影**，必须在 host 从 `contract.permissions` + solution `rights` fail-closed 派生，未知值一律按无权限处理。

## promptrepo 只读 catalog adapter 面

`shared/promptrepo` 是 **Go SDK**，TS host 不能直接 import。降级路径的真实数据源是内容仓 `catalog.json`（`schema_version: promptrepo.catalog.v0.1`）：

- 顶层：`repository{id,name,default_locale,taxonomy_version}`、`digest`（快照 digest，与 browse 的 snapshot_digest 同源）、`solutions[]`（53 个）。
- solution 字段：`package_id/id/version/digest/category/tags[]/capabilities[]/rights/maturity/locales{en,zh-CN:{title,summary,usage}}/templates[]`。
- BrowseDimensions 13 维（browse.go 核对）：repository/solution/category/media/consumer/capability/tag/role/template_locale/maturity/rights/compiler_status/source_state——目录 pane 过滤器直接对齐此维度集。
- 降级语义：只读、无网络、无编译、无会话（编译必须走 MCP）；digest 用于陈旧标注。

## 可复用性核对（本仓既有 seam）

| 复用项 | 位置 | 复用内容 | 与本 change 的关系 |
|---|---|---|---|
| `dsh-tool-hub` host | `packages/host/dsh-tool-hub` | typert contribution 装配（services/invocations）、`optionalGet` 结构探测、storageDomain open+table port、wire 失败码模式 | **模式复用**；其目录域是 skills/MCP/native 工具启用偏好，不含 prompt 模板目录——无能力重复 |
| `dsh-plugin-catalog` | `packages/catalog/dsh-plugin-catalog` | 静态插件目录构建/查询 | 面向 dsh 插件而非 prompt 模板；无重复，但命名须区分「插件目录」vs「模板目录」 |
| stdio MCP 客户端传输 | `packages/host/dsh-personal-radar/src/adapter.ts`（`createFixedArgvMarketTransport`） | spawn 固定 argv、无 shell、JSON-RPC id 复用、进程工厂注入（可测）、常量错误文案 | 2.1 连接管理的直接模板；探针/降级三态同 personal-radar probe 模式 |
| session 投影 | `packages/bundle/dsh-context`（`ctx.sessionProjections.register`） | 投影单元先例：事件折叠、projection cache 持久化、plain JSON 有界状态、`Object.is` 变更门控、`inject=['sessionProjections']` | 2.4 编译会话投影的唯一注册通道（非第二份状态） |
| storage domain 模式 | `packages/host/dsh-3d-director/src/scene-store.ts`、creator-studio 各 store | `yeisme_<域>_v1` 命名、**表名 snake_case（UNIT_NAME_RE 强制，camelCase 拒开）**、revision CAS、key 复合隔离 | 1.2 冻结 `yeisme_template_registry_v1` 的依据 |
| pane 合同与 UI 基建 | `packages/sdk`、`ui-surface`/`ui-visual-kit` | zod 合同家族、Surface/官方 primitive、状态矩阵规范 | 2.x/3.x 直接消费 |

**不重复已有 pane 能力**：tool-hub pane=工具启用偏好；`ui-pane-domain`=六 owner 领域 pane（Eikona/Sonora/Auctra/Pinax/Anatomia/Ordo）；search-center=全局会话/文件搜索（模板搜索是 registry 内搜索，不并入全局索引）；file-preview dispatch=文件预览分派；prompt-reference-creative-workspace=创作引用资产。模板目录发现 + contract 驱动引导编译 + 提示包导出在本仓为零覆盖（`packages/**` 对 template-registry/promptrepo 零引用，proposal 已核）。

## 缺口列表

1. **TS 侧无 promptrepo SDK**（Go-only）→ host 自带最小 stdio JSON-RPC 客户端（复用 radar 传输模式）+ catalog.json 直读降级；不引入 Go 编译依赖。
2. **MCP 面无 `session.resume`/`session.next`/`recipe.*`**（owner 刻意保留 CLI-only）→ 无 CLI 恢复合同只能靠 `session_show` + 投影折叠；recipe 运行器按 proposal 留后续 change。
3. **`export` 必须落项目文件**（`output` 必填，写 workspace 项目内）→ host 需要 workspace 项目目录与安全相对路径规则；浏览器只收导出回执摘要（compile_id/digest/provider_calls=0），不收绝对路径。
4. **无独立 preview 工具** → 正文预览从 `inspect` 合同 `permissions` 含 `preview` 派生受限 preview DTO；无权限 fail-closed（禁用+原因），不发明预览动作。
5. **编译 locale 约束**：`TEMPLATE_LOCALE_REVIEW_ONLY`——Agent 编译强制模板 locale；官方仓多数条目仅 `en` 可编译，`zh-CN` 常为 review-only 伴读。UI 须如实标注。
6. **DSH 侧无模板编译会话存储** → 本 change 1.2 冻结 `yeisme_template_registry_v1`（见 design.md）。
7. **3D 首批内容依赖** prompt-templates 仓 `official-3d-model-templates-beta-v1`（内容侧未完成，不阻塞本 change 合同层）。

## 验证

本切片为 seam 核对与合同冻结；MCP 实测证据已脱敏固化于本文档（tools/list 32 工具 + 信封/数据形状 + 错误码）。代码侧门禁：`pnpm --dir packages/host/template-registry run typecheck`、`run test` 通过；`openspec validate dsh-template-registry-integration-v1 --strict --no-interactive` 通过。host 连接/RPC/投影/pane 实现（第 2/3/4 组任务）保持未开始。
