# Eikona 生成台实施基线

## 2026-09-08：owner 运行绑定补齐查询授权与 review/handoff

Eikona `eikona-dsh-owner-runtime-binding-v1` 已把 status/receipt/reconcile/cancel 绑到当前 caller 的项目授权；跨项目或失权查询不再泄漏原操作。typed generation/review/handoff 可注册 canonical adapter：generation 写真实 runstore 产物，review 写 decision ledger，handoff 固定版本并保留 partial children。Discovery 只在 typed production adapter 已注册且 kill switch 打开时报告 `available`；默认 serve 仍是 Phase A `needs_contract`。mock-provider 闭环证据见 Eikona `temp/integration-test-runs/integration-20260908T080653.104629102Z/`。真实 provider 出图与 DSH 页面验收仍未授权，不能勾选 4.2。

## 2026-09-08：canonical绑定拒绝路径

owner组合包增加准备失败、模型/固定prompt版本不一致、错误操作类型、夹带批量任务的拒绝测试；未取得running执行权或项目不匹配时不得调用prepare，响应无私有异常或成果引用。测试通过并保留[owner证据](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)，生产与真实使用验收仍未完成。

## 2026-09-08：canonical运行链路接通本地provider替身

Eikona新增上层ownergeneration组合adapter，实际调用原app.GenerationService/ProviderRunner/runstore。测试通过真实owner鉴权与原幂等键提交，生成可解码PNG，读取真实request/result确认固定模型与prompt_ref；重提不重复生成。预算缺失拒绝、dry-run模式不可提升为foreground也已验证。证据见[owner组合绑定设计](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。

这比仅mint outcome refs前进一步，但provider仍为本地fixture；生产prepare/serve/discovery及DSH adapter未启用，不能据此勾选真实生成验收。默认模型测试入口保持openai/gpt-5.4-image-2，fixture模型改写只在测试provider内部。

## 2026-09-08：共享配置的项目草稿隔离

修复共享Composer只按task/descriptor入口重置、导致项目切换仍可能携带旧values的问题。现在按可信snapshot的项目与身份维度缓存临时草稿，切换时在新表单commit前恢复本scope输入；旧scope迟到回执不调用新表单回调或清空输入；旧项目descriptor仍显示时禁止执行。缓存不是跨刷新持久化，父5.4继续open。

新测试完成A输入→提交→切B空输入→B编辑→A迟到结果→回A恢复→回B恢复，确认零额外dispatch；也验证旧scope descriptor禁用。修改后的初轮Composer+artifact workspace30项及类型检查通过，Surface检查通过。此证据是jsdom组件合同，不是真实DSH双栏会话或owner运行。

## 2026-09-08：三个专业工作页

`creator.visual`已在既有WorkspaceView中组合生成配置、候选与修改、资产与来源三页。新EikonaStudioPages只管理导航和已访问页面，复用原配置/成果/资源组件，没有新领域状态或执行入口。首次进入候选/资产页才挂载；切页保留已访问组件与配置输入，暂停其媒体。WorkspaceView汇总配置与候选脏状态，避免未编辑区域覆盖其他区域的未保存标记。

实际CreatorStudioView的组件测试验证独立打开visual、切页保留输入、脏状态仍true、Home/End键盘导航；独立页面测试验证按需挂载、切页调用pause、已访问候选不重建。整包55项通过后，新增媒体测试与views focused共9项通过。后续测试计数不作为任务完成比例。

真实页面导航组件配合合成内容的浏览器测试在360/560/960和zh/en下6项通过，验证焦点、切页、草稿保留、无横向溢出；最新截图/日志：`temp/integration-test-runs/ui-visual-2026-09-08T03-37-08-745Z-3462336/`。已查看窄Pane截图，补vk-btn修复原生按钮白底低对比。首次浏览器失败源于fixture将locale对象传给要求字符串的translator，修正测试页面后通过；未修改产品校验规避失败。

client类型检查、client及Creator Studio bundle构建通过。构建中一次因并行清理ui-surface产物失败，产物恢复后复验成功。Surface和插件检查通过：`temp/toolchain-runs/2026-09-08T033534457Z-toolchain/`。

边界：浏览器内容是fixture，不证明实际owner生成、完整候选数据、遮罩、lineage或专业Pane/画布同步。页面只在当前Pane生命周期保留状态，跨项目草稿恢复、刷新续接、200%zoom/IME、真实媒体行为仍须验收。父3.1/5.2/5.3/5.4保持未完成。

## 2026-09-08：owner资源限制校验

Eikona admission现在拒绝显式全零或负数CostLimit，保留正数限制与no-cost兼容；owner/HTTP包回归通过，证据见[owner设计](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。资源数量不等于金额预算或费用授权，DSH固定运行预览与canonical预算绑定仍未完成。

## 2026-09-08：owner固定prompt版本读取

Eikona新增只读RenderEntryVersion入口：已保存历史模板按原变量规则渲染，缺失版本/正文拒绝，不回落当前内容或改usage。两个focused及prompts/HTTP prompt包回归通过，证据与兼容边界见[owner设计](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。尚需冻结opaque prompt_version身份映射与项目权限并接canonical生成，不将此读取能力当作真实生图完成。

## 2026-09-08：owner typed生成adapter接入

Eikona已有WithAdapter注册表现在被SubmitGeneration实际消费；可选typed接口接收已准入的固定prompt版本与资产引用，结果使用adapter回执而非替换为合成ref，同key不重复调用。owner与HTTP包CGO_ENABLED=0回归通过，详见[owner生成接入点记录](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。当前验证adapter是fixture；canonical app.GenerationService、历史prompt内容解析与预算映射仍未接完，真实生成台验收保持open。

## 2026-09-08：owner并发重复执行修复

Eikona已有owner骨架中，两个请求可同时读到accepted并分别执行；真实SQLite同步测试复现两次adapter调用。现通过accepted→running的条件更新授予唯一执行权，原操作unknown/取消中重提也不再自动执行。并发与存储故障10轮、owner/HTTP两个包回归均通过，详见[owner验收记录](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。该修复补强生成台重复点击不重复执行的owner前置条件，不证明真实provider、重启对账或整个2.4任务已完成。

## 2026-09-08：owner提交持久化失败修复

已在Eikona配套change内修复SubmitAuthorised忽略running/最终结果写入错误的问题。running写失败禁止dispatch；最终写失败保持原running事实与原键，不宣称成果完成。故障测试先红后绿，CGO_ENABLED=0的ownerprovider与HTTP包回归通过，证据见[owner设计及验收记录](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/design.md)。这是实际owner代码修复，仍未接真实canonical生成或调用收费provider，生成台真实验收保持未完成。

## 2026-09-08：共享Composer消费bundle解析修复

上一节记录的Director外部require失败已修复：`packages/bundle/dsh-ai-drama-director/tsdown.config.ts`沿用其既有源码alias策略，显式将`@yeisme/dsh-client-ui-creator-studio/projection-components`指向共享源码。没有复制Composer、修改业务逻辑或将Yeisme依赖加入external白名单。此消费bundle如今稳定内联共享组件，不依赖其临时lib子路径解析。

在该bundle目录运行`pnpm run build`、`pnpm run smoke:bundle`、`pnpm run test:declaration`均通过；smoke验证ModuleLoader apply及install/duplicate/uninstall/reinstall清理，4项声明测试通过。全局`pnpm run check:plugins`六项全部通过，证据`temp/toolchain-runs/2026-09-08T030622498Z-toolchain/`。这些结果只关闭该构建缺陷，不关闭生成台父4.1：真实领域页面与其他required测试仍未完成。

## 2026-09-08：费用状态与模型默认值

共享Composer现在总是展示费用状态：owner未提供cost显示“费用未知”，明确amount=0保留零报价，estimate=true标为预计费用，estimate=false标为owner报价。不推算费用，不把缺失报价当免费。当前descriptor仍不是输入绑定的完整运行计划，预算授权与unknown费用确认规则仍须在owner adapter/preview中完成，父2.2/2.4保持未完成。

Eikona image动作仅在owner显式声明`model`选择字段且选项包含`openai/gpt-5.4-image-2`时初始化该默认值；显式initialValues保留用户选择。完成后开始新草稿时重新应用该支持默认值；未提供该模型的owner不自动选择其他模型。其他字段名不从label猜测映射，不新增未声明字段。本条是生成配置的最小客户端支持，不证明owner模型能力、遮罩或实际生成已可用。

新增组件测试覆盖unknown/零/估算报价和默认模型/显式选择/不支持模型；5项Composer focused测试及client类型检查通过。费用展示后的静态Creator三宽度截图回归通过，证据`temp/integration-test-runs/ui-visual-2026-09-08T03-00-07-738Z-2514179/`，不作为新字段交互或真实owner证据。

后续client整包52项测试通过，最终包构建与Surface检查通过。第一次构建期间并行构建清理了`ui-pane-workbench`依赖产物，恢复后复验成功。全局`check:plugins`最终未通过：`packages/bundle/dsh-ai-drama-director/lib/client.js`残留`@yeisme/dsh-client-ui-creator-studio/projection-components`外部require；重建该消费bundle仍复现，属于当前消费bundle解析问题，不能归为已解决的暂态。证据`temp/toolchain-runs/2026-09-08T030343018Z-toolchain/`；其余五项检查通过。本轮未改该消费包配置，父4.1质量门继续open。

## 2026-09-08：确认owner生产绑定缺口

继续沿HTTP handler到application service检查后，不能将下方“接口已存在”理解为production ready：

- `cli/eikona/internal/ownerprovider/contract.go:DiscoveryAt`固定Phase A：generation/review/handoff为needs_contract，new mutation/reconcile开关关闭。`internal/api/ownerprovider/handler.go:discovery`即使有app也调用同一固定函数。旧archive明确生产promotion尚未完成，不能为了DSH按钮将开关直接改开。
- `typed_service.go:SubmitGeneration`实际回调只mint run/asset引用，无canonical generation调用，DryRun与非DryRun分支都返回succeeded；review/handoff回调也只生成相应引用。已有真实Eikona进程canary证明操作骨架，不证明真实图像、decision或交接已写入canonical服务。
- `service.go:Reconcile`是原operation/receipt/idempotency查询，不自动dispatch；但方法不接caller/project上下文，完整HTTP授权边界须进一步核实。不能据此断言存在漏洞，也不能假定项目级查询权限已经验证。

已在实际owner通过OpenSpec CLI创建[eikona-dsh-owner-runtime-binding-v1](../../../../../cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1/tasks.md)，包含proposal/design/spec及9项未完成任务，严格验证通过；owner consumer matrix已链接回本生成台。该change要求先找canonical入口，再补运行绑定、动态readiness、授权查询、重启恢复和真实产物验证，不新建provider/资产状态机。影响本change任务1.1/2.2/2.4/2.6/4.2/5.1/5.3/5.4，仍未完成。

本轮没有执行收费生成，没有修改owner运行代码或打开生产开关。下一步可以继续开发DSH页面和受控adapter，同时推进owner本地canonical绑定；真实provider验收须单独有费用授权。

## 2026-09-08：增量原操作对账链路

本节更新下方早期“无reconcile方法”的记录。共享协议、Host、Remote、runtime/controller和UI现已提供可选原操作查询路径；实际Eikona adapter及跨刷新持久恢复仍未完成。

- 新增严格`PaneActionReconcileRequestSchema`：owner/action/target/context/原幂等键，无values或正文。原dispatch合同不改。Host adapter与runtime新增可选方法，未实现的旧adapter返回unknown/reconcile_unavailable，不回落到dispatch。
- Gateway前后校验可信上下文，要求回执owner/action匹配；无需有效生成descriptor即可查询原操作，由owner负责查询权限。客户端保留原键，不能把重新编辑的值发进查询；拒绝查询不代表原执行失败。
- 共享Composer增加中英“核对原操作”控件；缺少runtime能力时禁用并说明原因。该入口调用reconcileAction而不是dispatchAction，保留当前草稿。
- 兼容性：协议新schema、Host新Remote、optional adapter/runtime方法均为增量；旧调用不改，无弃用窗口。回滚移除新入口即可，未引入数据迁移。

### 验证

Host Gateway13项通过，其中新增3项覆盖原键查询、零dispatch/snapshot、拒绝values/伪造scope、旧adapter、错误回执与查询异常。客户端整包49项通过，随后新增按钮测试与controller focused共11项通过；本轮共有1项controller和1项按钮新测试，其他测试数量也受并行工作影响，不将全部增量归于本任务。bundle10项通过。Host/client类型检查与构建通过；初次schema实现错误使用了带refinement对象的pick，测试加载失败，改为独立严格对象并复用字段schema后通过，未放宽原schema。

`check:surfaces`与`check:plugins`通过，证据`temp/toolchain-runs/2026-09-08T025212797Z-toolchain/`。360/560/960静态Creator fixture截图3项通过，证据`temp/integration-test-runs/ui-visual-2026-09-08T02-52-24-106Z-2347883/`；该截图不是新增查询链路或真实owner验收。对账链路当前证据为unit/组件合同，未调用真实provider。

### 剩余边界

原键只在当前controller生命周期内保留，刷新后恢复仍不可用；Host尚未保存安全操作身份。Eikona已有Reconcile接口，但未在本轮接到CreatorOwnerAdapter。后续应先验证owner实际授权与身份映射，再接持久恢复；不能把任何未知响应映射成失败或新任务。父2.4/5.4保持未完成。

## 2026-09-08：共享执行入口与初步 owner 接口核对

生成台尚未完成真实生成验收。本轮先修复所有专业 Pane 复用的执行入口，避免在已有重复提交和草稿覆盖问题上继续叠加页面。任务1.1、2.4、5.3、5.4保持未完成；下列证据只覆盖明确列出的客户端行为。

### 已实现的客户端保护

`packages/client/ui-creator-studio/src/controller.ts` 在实际提交前同步登记当前tenant/project/owner/action/target的在途操作。同一目标操作仍pending时再次调用不会发出第二次Remote；unknown、reconcile_required或pending回执继续保留保护。刷新descriptor、改变输入、reset后重读同一项目均不能绕过unknown。确认failed/rejected等终态才释放本地保护；下一次显式提交使用新的UUID幂等键。

回执明确携带owner/action时必须匹配请求，否则按unknown处理。切换项目后迟到回执不写入新项目状态，也不把旧成功回执交给新上下文继续处理。刷新不会清掉同上下文的pending显示。本地保护仅属于交互控制，不推导owner终态、自动重试或调度工作。

`projection-components.tsx` 的确认绑定当前descriptor和输入值；参数、固定引用、权限/费用预览等改变后原确认失效。提交过程中编辑下一份草稿，旧操作完成不再清空新输入。`views.tsx` 原有重复的ActionField/CreatorActionComposer已移除，保留原导出名并重导出共享实现，避免两个入口行为分叉。

### 本地验证

```bash
pnpm --filter @yeisme/dsh-client-ui-creator-studio run test
pnpm --filter @yeisme/dsh-client-ui-creator-studio run typecheck
pnpm --filter @yeisme/dsh-client-ui-creator-studio run build
```

8个测试文件46项通过：controller 7项、确认/草稿组件2项、既有artifact workspace20项及其他回归。typecheck/build通过。新增确认组件测试初次因使用了不存在的按钮名称“执行”失败；改为产品现有名称“执行操作”后通过，未改变产品文案。证据是unit与jsdom组件测试，不是收费provider或真实Host路径。

随后Creator Studio安装包构建、`check:surfaces`与`check:plugins`全部通过；插件检查证据：`temp/toolchain-runs/2026-09-08T024317686Z-toolchain/`。`node scripts/run-ui-visual-tests.mjs --grep creator`的360/560/960静态fixture截图3项通过，证据：`temp/integration-test-runs/ui-visual-2026-09-08T02-45-04-786Z-2261830/`；该门只证明既有surface视觉未回归，不验证新执行行为。OpenSpec严格校验与`git diff --check`通过。

### 已核对的 Eikona 源码接口

核对时 owner HEAD：`97b90193a6c33daca7a73bfed5014ee5973f1bd7`。HEAD不代表工作区无修改，因此同时记录所读接口文件SHA-256：

- `cli/eikona/sdk/go/eikona/owner_provider.go`：`52fa8960ae07199c4186579197b2ccd62ce9dc166b503c159bf5c89ca742e575`
- `cli/eikona/internal/api/ownerprovider/handler.go`：`2864a44e2fdcfc3a6d65b34d2872d70e2e095bbf9b4976fdc2293b97eb3e2af5`

| 操作 | 已看到的源码事实 | 消费边界与待验证项 |
|---|---|---|
| 能力发现 | SDK `OwnerDiscovery`读取`GET /api/v1/owner`；包含contract/schema/sdk digest、operation状态、幂等/status/reconcile/cancel能力及kill switch | 必须按实际响应启用；文件存在不等于真实service已配置 |
| 生成 | SDK `OwnerSubmitGeneration`与handler的`/owner/generation:submit`；输入是project、prompt版本、模型、输入资产引用、expected version | 不能直接把Pane文本塞进prompt_version；提示词版本化入口仍须核对；默认模型保持`openai/gpt-5.4-image-2` |
| 审阅/交接 | `OwnerSubmitReview`、`OwnerSubmitHandoff`；handoff资产固定version/digest | 采用与交接必须分别映射，不能以提交生成的accepted当采用 |
| 查询/恢复/取消 | `OwnerOperationStatus`、`OwnerReceiptLookup`、`OwnerReconcile`、`OwnerCancel`及对应handler | 原owner已有接口，不应重新创建恢复API；DSH仍缺完整消费适配 |
| 丢失提交响应 | handler读取`Idempotency-Key`，明确支持通过原key定位operation进行reconcile；key限制1–128字符`[A-Za-z0-9._-]` | 新UUID客户端key兼容；Host adapter必须原样传递，不能只生成新的本地receiptRef |
| 事件 | `OwnerEvents`提供有界page、cursor、has_more、resync_required | 需适配现有订阅和snapshot repair，不另建运行事实 |

Creator Studio现有`CreatorOwnerAdapterV1`支持snapshot/listAssets/dispatch/resolveArtifact/readArtifactContent；它没有通用reconcile方法。目前可通过owner提供的专门action表达恢复，但尚未证明生成台有该descriptor映射。因此本轮unknown仅拦截重提；尚不能从UI对账解除保护。

### 必须继续完成

- 任务1.1继续核对完整registry、generation/workflow/batch/asset/lineage/handoff、局部编辑/遮罩模型矩阵和版本；本表不是完整合同验收。
- 任务2.4/5.4补齐Host持久化原幂等键和unknown恢复映射；浏览器重建controller后不能只依赖本轮内存保护。必须保留可对账标识、支持owner确认后解除保护；不同客户端/会话的去重仍由owner负责。
- 执行预览必须由owner绑定输入/参数并显示费用unknown；本轮确认绑定只是UI确认失效规则，不替代owner的不可变计划和预算验证。
- 完成独立生成配置、默认模型、参考/遮罩、批量候选、继续修改与固定版本采用页面。无真实模型调用、取消、对账或交接证据，所有对应父任务保持未完成。

## Owner 绑定现状复核（2026-09-08）

当前 owner 配套 `cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1` 已记录 canonical generation/review/handoff、原键查询和 mock-provider 验证；真实 provider 任务 3.2 仍开放。源码 `internal/ownergeneration/canonical_generation.go` 确认 GenerationPreparation 是受信任应用依赖，必须解析固定 prompt version 与 owner 批准计划，不能由 DSH 提供 callback 或原始执行参数来替代。该 adapter 当前只接 image.generate 单图，拒绝 Jobs 批量，不代表 edit/mask/batch 已完成。

Host 接入优先消费已有 `/api/v1/owner` discovery、`generation:submit`、`review:decide`、`handoff:prepare` 和 operation status/receipt/reconcile 合同；完整清单以 owner `docs/interfaces/consumer-contract-matrix.md` 为准。正式 serve 仍默认 Phase A，未注册 production adapter；no-cost canary mint 不得变成生产可用状态。是否配置 verifier、kill switch 与受信任 preparation 均归 owner，Host 不接管领域准备或伪造权限。

下一段本地实施应交付：授权 discovery 的 Host adapter、固定 project/descriptor digest 的准入、Phase A 的 needs_contract 原因展示、实际 owner fixture HTTP 读取验证。随后才接单图提交与原键恢复；局部编辑、遮罩和批量继续独立核对实际能力。Owner mock-provider 已通过不等于 DSH 完整生成台已通过，也不等于真实 provider 调用已授权。

## 项目与资产列表接口核对

已核实 owner 源码：`cli/eikona/internal/api/projectservice/handler.go` 的 `/api/v1/projects` 返回 `eikona.projects.list.v1`、projects 和 total，目前不提供游标；该列表是实例注册表投影，Host 不能仅凭 registry 条目授予项目访问权。

`internal/api/workbench/handler.go` 的 `/api/v1/assets` 返回 `eikona.asset_graph.v1`、assets、count、pagination；`assets.go` 提供 limit/cursor/run_id/tag/scenario 查询字段。项目权限范围来自 handler 传给索引的 `middleware.ScopeFromContext(...).Projects`，不是客户端在取回一页后自行解释。需在完整 middleware 路径核验 Host 的当前项目身份如何形成 owner scope；不能把多项目页做事后过滤后声称分页完整，也不能给不存在的 project_id query 编造语义。

assetSummary 有 artifact_id、handle、uri、project_id、artifact_uri、mime_type、sha256、尺寸与来源 run/review 引用；sha256 为 optional。固定内容摘要存在且通过权限和资产读取复核前，不生成可执行引用。无摘要旧资产可列出并标记待核验，但不能用 created_at、handle、数组位置或随机值代替版本；按时间排序不代表已采用。

实施任务 2.1 的验收至少包括：同一 scope 下游标续页、权限收缩后的旧游标、同名跨项目资产、缺摘要旧记录、索引不可用、空项目以及跨 scope 页拒绝；owner 已有索引 API 应被复用。当前只有源码核对，没有新的列表 adapter 或真实列表验收。

## 候选媒体访问合同核对

正确的候选预览入口来自 Eikona `internal/api/comparisonshandler/handler.go`：`POST /api/v1/artifacts/{handle}/access-grants`，请求正文 `confirm=true`，允许携带原 Idempotency-Key。handler 检查当前 actor（admin/operator）与 credential project scope，调用 `internal/artifactaccess.Service`，不要求已采用。响应 `eikona.artifact_access_grant.v1` 包含 artifact_uri、url、expires_at、grant_id、sha256、size_bytes。URL 由已配置 public_base_url 生成，GET/HEAD 使用 bearer capability，可撤销；Host 不把 URL 或 grant token 写进目录、画布、日志或任务证据。

ResolveAccessFromRunstore 明确接受完整 `eikona://artifacts/<run>/<artifact>`，也接受原 handle/manifest URI；Host 应对完整 URI 做 URL 路径编码，不猜测 owner 文件路径。响应 artifact_uri 可能是 manifest 的 canonical URI，不能未经核对将两个不同字符串当作同一个引用。来源映射与固定 SHA-256 都需验证。

不要使用旧 `internal/api/artifactdelivery` 的 `/download-grants` 代替候选预览：它要求最新 feedback accepted、权利确认，并绑定 actor/project 的一次性下载。自动接受候选来满足旧下载条件违反采用边界。

下一实施片段：扩展 Host 显式媒体读取，不扩宽已有只读列表；用户选择固定内容摘要后确认访问，owner 二次鉴权并返回有界媒体。失败/失权/摘要不符保留目录与旧采用版本，不自动补发 grant，也不把目录 observed_digest 升级成已采用。采用、写回与交付仍使用原来的独立 owner 操作。
# 固定版本比较增量

资产页允许选择两张具有明确内容摘要且受支持的图片，跨分页保留选中的安全引用，并提供独立的清空选择操作。确认读取后，两张图片分别通过既有 Host 访问授权与内容校验链读取，交给共享 `MediaCompareRenderer` 展示并排、滑动和透明度比较。选择本身不读取图片；比较不产生采用、写回或交付事实。

两张图片任一失权、摘要不匹配或读取失败时，不展示半组结果；用户明确重试时保留各自读取身份。关闭比较、清空选择、切换项目和组件销毁均释放临时图片地址，迟到结果不重新打开界面。项目或授权改变后，必须重新经 Host 核验，浏览器缓存不构成授权。

组件测试覆盖显式读取、两个固定版本、部分失败、原键重试、关闭释放及销毁后的迟到结果。真实 Go owner HTTP 的图片读取与浏览器预览另有独立证据；它们不能替代两张真实生成候选的比较、继续修改、采用和交接验收。完整任务 2.5 继续开放。

## 采用确认表单与恢复的当前证据

现有 Composer 已消费真实 `createEikonaAdoptionDescriptor`：固定 run、candidate、内容摘要与 decision version 自动带入；确认复选框和执行按钮分别操作，读取描述符和勾选确认都不提交。Owner 替换描述符后，旧确认失效，固定版本重新初始化。用户在不同动作间切换时保留各自的临时草稿，不跳回第一个动作；返回已有草稿仍需重新确认。

`temp/integration-test-runs/eikona-discovery-20260908231806Z-2651934/` 记录本次组件与实际 Go HTTP 集成验证，包含上述 14 项 Composer 测试、候选审阅及图片组件测试，并重验实际 Gateway 采用、响应丢失后的持久恢复和原键对账。Client typecheck 同时通过。组件确认使用模拟 dispatch，Go 集成使用本地测试授权与资产 fixture；本次未运行浏览器，也未验证正式 Typert/profile 接入或收费生成。

任务 2.6 继续开放：正式界面选择到 Host 的绑定、浏览器确认链、独立写回/交接回执和画布固定引用仍需验收。持久恢复仅保存安全 lookup 信息，不保存表单正文或完整 action values；恢复必须按原幂等键查询 owner，不能从当前候选版本拼出一次新提交。

浏览器增量证据：`temp/integration-test-runs/eikona-discovery-20260908232147Z-2692785/` 已覆盖真实 Composer → CreatorStudioController → Gateway → 本地 Go owner 采用路径。Controller 自行生成幂等键；加载和勾选确认阶段零提交，点击执行后仅一次提交并收到完成回执。Owner 刷新移除已采用动作后，完成回执继续展示；此前截图发现回执随动作消失，已修复并加入刷新后的稳定断言。此次 25 项组件测试与 Go/browser 集成通过，560px 中文截图经人工检查。Host/client typecheck 通过。

该浏览器使用测试桥连接 Gateway，正式 Typert、用户 profile、生产选择来源和完整生成修改闭环仍未验证。截图中回执的状态及 owner 摘要仍为英文，正式中英页面验收继续开放。独立写回、交接与画布回填也未由这次采用测试证明。

回执呈现后续修复：通用操作状态按中英界面翻译，Eikona 已确认采用显示独立文案，明确采用不等于写回或交付。状态与摘要分行并允许长内容换行；没有后续动作时不再声称 owner 从未发布动作。`temp/integration-test-runs/eikona-discovery-20260908232612Z-2740232/` 重验 25 项组件测试及 Go/browser 集成，覆盖 360px 中英结果、无横向溢出、语言切换零新增提交。上一轮同尺寸中英截图已人工检查；Host/client typecheck 通过。这只收敛采用结果的呈现问题，完整专业 Pane 的中英、200% 缩放和键盘验收仍开放。

## 显式候选选择的 Host 接入

新增可选 `selectEikonaCandidate` adapter 能力与严格选择输入/结果合同。`createSelectableEikonaReviewAdapter` 在读取实际 owner 审阅投影并核对 canonical artifactRef/内容摘要后，保留完整上下文下的临时选择。选择不提交 decision、不授权媒体，也不提供执行许可。后续 snapshot 和 dispatch 继续复用原 review adapter 的重新核验。

缓存最多保留 64 个上下文；只存安全引用与摘要，重新选择立即使同上下文旧选择失效。迟到请求和已淘汰请求都不能恢复选择。核验失败后不沿用之前的候选。切换任一上下文字段均不能继承另一上下文的采用动作；缓存生命周期与 adapter 一致，不改 owner 历史和进行中的操作。

兼容性为增量：旧 adapter 无需实现该可选方法，原 `createEikonaReviewAdapter` 注入函数签名不变；没有存储迁移或旧 Workbench 标识重解释。回退时恢复原注入选择 adapter，丢弃临时选择即可，owner 操作仍按原键恢复。

证据 `temp/integration-test-runs/eikona-discovery-20260908233104Z-2786198/`：四组选择隔离/交错/失权/淘汰测试，以及实际 Go owner HTTP 下无选择无动作、核验选择后发布动作且选择零提交、后续采用与恢复通过。Host typecheck 和本 change strict validation 通过。本轮尚未接 Gateway Remote、安装包导出或正式页面选择按钮，不宣称用户已能在正式 Pane 完成选择。

Remote 接入增量：已添加 Gateway `selectEikonaCandidate`、安装包 invocation、client 严格版本化 Remote 与 controller 方法，并导出可选 adapter。Gateway 在 owner 响应后重查上下文、directory generation 和 adapter 身份，核对返回的选择与原输入一致；controller 拒绝迟到、reset 后及不匹配结果，不自动重试或提交。旧 adapter 未实现该方法时返回 unavailable，不影响原有接口。

本地验证：26 项 Gateway、28 项 controller/Remote、14 项 bundle 测试通过；Host build、client/bundle typecheck 通过。首次 Gateway 测试遗漏 expected context 的夹具问题已修正，不改变无上下文拒绝行为。`temp/integration-test-runs/eikona-discovery-20260908233622Z-2842778/` 进一步覆盖实际 Gateway 清除选择→无采用动作→核验固定选择→零提交→采用与持久恢复。正式 Pane 按钮、刷新和用户 profile 仍待接通，本次未运行浏览器。

正式资产组件接线：资产行新增显式候选选择，缺少固定摘要时禁用并说明原因；页面提供清除选择。选择期间禁止重复点击，切换 scope 后不显示旧请求结果。Eikona Pane 调用 controller 选择并在同一上下文刷新 snapshot；采用 Composer 移到资产页，配置页不再混入采用动作。两处继续共用 owner descriptor、controller 和回执，不创建第二执行路径。

`temp/integration-test-runs/eikona-discovery-20260908234143Z-2904374/` 通过 27 项组件测试、4 项选择 adapter 测试及 Go/browser 集成：真实资产列表按钮→controller→Gateway→实际 owner 核验→刷新采用动作→单独确认执行，选择阶段零提交，执行一次；360px 中英无横向溢出，切换语言不重复提交。此前同布局中文截图已人工检查；另有 12 项 views/pages 测试与 client typecheck 通过。浏览器仍使用测试桥和本地 fixture 授权，正式 Typert 会话装配、用户 profile 以及完整生成/修改/交接路径继续开放。

实际 Typert 分发增量：集成测试从本项目 staging 加载真实 `TypertRegistry` 和 API Gateway，使用安装包 `apply` 注册原 contribution，而非手写替代 invocation。选择与 dispatch 通过真实 `typertGateway.invoke`；浏览器资产列表、选择、snapshot 刷新和采用也经该分发。未暴露方法被拒绝，非法远程图片地址不能作为选择输入；采用仍只提交一次。清理卸载 contribution 并销毁测试 Context。

证据 `temp/integration-test-runs/eikona-discovery-20260908234611Z-2959375/`：27 项组件、4 项选择 adapter 及 Go/browser 集成通过，Host typecheck 通过。这证明安装包 contribution 与实际 Typert registry/Gateway 兼容，但浏览器到 Typert 仍用测试桥，尚未覆盖物理 Remote HTTP/WebSocket、正式用户 profile 或生产凭据。后续复用 upstream API Gateway 的 connection/webserver 测试装配核验物理传输，不创建第二套 RPC。

物理 HTTP 增量：新增测试装配复用 staging 的真实 DSH Connection `/api` handler，挂到临时 loopback HTTP server；浏览器会话由 Connection 自己签发，凭据记录只在内存。请求采用原 client-request/server-response 合同并校验 rpcId。未认证请求返回 401，不能清除既有选择；授权请求经安装包 Typert contribution 完成选择及采用。

首轮 `temp/integration-test-runs/eikona-discovery-20260908234847Z-2994010/` 失败来自测试夹具误将纯文本 unauthorized 按 JSON 解析，修复仅在非 200 分支按原状态处理。随后非浏览器证据 `.../eikona-discovery-20260908234924Z-3004333/` 和浏览器证据 `.../eikona-discovery-20260908234953Z-3013274/` 通过，包含 27 组件、4 选择 adapter 和实际 owner 集成；Host typecheck 通过。浏览器测试桥现在由 Node 调用真实 HTTP，不再直接调用 Gateway；浏览器原生 connection client、WebSocket、正式 profile 仍未验证。测试完成清理临时 cookie、内存凭据、HTTP server、registry contribution 和 Context，不接触用户凭据。

## 原生浏览器 Remote 验证（2026-09-09）

采用页现在挂载真实 DSH Connection、Typert registry 和 API Gateway 的浏览器源码，使用本项目 `resolveCreatorStudioRemote` 挂载版本化 Remote。页面与 `/api` 同源；WebSocket upgrade 交给原 Gateway handler，Connection 自行建立世代。采用测试不再注入 `ownerStudioDispatch` 等桥接函数，浏览器直接发 HTTP RPC；前面的图片预览子路径仍保留原只读测试桥，不能混为整条原生媒体路径已验收。

此路径揭露安装缺陷：client 执行前调用 `recallOperationIdentity`，但 bundle contribution 未注册它，物理 HTTP 返回 404，client 保持 unknown 且零 owner 提交。失败证据 `temp/integration-test-runs/eikona-discovery-20260908235654Z-3089506/` 包含脱敏回执与截图，`.../eikona-discovery-20260908235809Z-3104891/` 单独确认 HTTP 404。修复是在安装包增量注册原身份查询和恢复列表，不删除执行前身份核验；bundle 回归检查两条 invocation。

最终证据 `temp/integration-test-runs/eikona-discovery-20260909000124Z-3150273/`：27 组件、4 选择 adapter、实际 owner/HTTP/原生 browser 集成通过；浏览器连接世代就绪、无提交桥、一次身份查询及一次 dispatch、选择零提交、采用完成回执保留、中英窄 Pane 均有断言。14 项 bundle 测试及 Host/bundle typecheck 通过。真实 client 源码单独构建到测试页，尚未通过正式 ModuleLoader/profile 全应用装配；owner 凭据为临时 fixture、没有收费生成。完整原生媒体读取、持久恢复与生产 profile 仍需综合验收。

原生媒体与审阅增量：采用测试页也接入原有 `readEikonaCandidateImage` 和 `readEikonaReview` Remote，经实际浏览器 Connection → HTTP → Gateway → Go owner 读取。图片预览提示阶段零请求，明确确认后读取一张 640px fixture 并关闭；双候选比较再读取两张固定版本，三种比较模式切换不增加读取，比较也不提交采用。采用前后分别重新读取 owner 审阅并检查未决定/已采用状态。

证据 `temp/integration-test-runs/eikona-discovery-20260909000509Z-3194168/`：27 组件、4 adapter 与完整集成通过，Host typecheck 通过；`artifacts/eikona-native-comparison-560-zh.png` 已人工检查。前一轮失败仅为测试使用了不存在的审阅文案，记录保留于 `.../eikona-discovery-20260909000356Z-3179090/`。此增量覆盖正常原生媒体/比较/采用路径，不替代正式 ModuleLoader/profile、原生断线/失权恢复或真实生成修改验收。

原生 unknown 恢复增量：浏览器采用所用 Gateway 已挂载真实 DSH storage/json/domain，恢复记录落在临时目录。测试令 Go owner 完成采用后丢失响应，页面显示 unknown；HTTP 恢复列表与磁盘均保留同一个原幂等键，磁盘没有 action values。用户点击“核对原操作”后，client 从 Host 重读原身份并只发送 reconcile，完成后清除恢复记录。整个路径一个 dispatch、一个 owner 提交、一个 reconcile；两次身份读取分别发生在执行前和对账前。

证据 `temp/integration-test-runs/eikona-discovery-20260909000925Z-3239095/`：27 组件、4 adapter 及实际 owner/原生 browser 集成通过，Host typecheck 通过。首轮 `.../eikona-discovery-20260909000803Z-3222364/` 因测试错误假定只有一次身份读取而失败，已按源码中的两阶段核验修正；没有修改 client 的安全核验。该路径验证当前浏览器的响应丢失恢复，Host 重启持久恢复仍由后续独立路径验证，尚未证明浏览器刷新/重开后的完整恢复界面。

浏览器刷新恢复增量：正式 Eikona 资产页复用 `OperationRecoveryNotice`，按完整上下文挂载，原来的候选/成果工作区继续使用同一组件。响应丢失后刷新整个测试页面，原 client 内存被丢弃；新 Connection 建立世代后从 Host 恢复列表展示原操作。页面无执行按钮，加载恢复记录不触发 dispatch；用户点击“查询上次结果”后只发原键 reconcile，完成后恢复行清除并显示完成回执。

没有动作 descriptor 或成果正文时，Eikona 恢复行现在用 canonical 引用中的 run/candidate 标识和“采用候选”标签定位对象，不展示原幂等键；旧通用 owner 回退保持兼容。证据 `temp/integration-test-runs/eikona-discovery-20260909001410Z-3289634/`：27 组件、4 adapter 与实际 owner/原生 browser 集成通过；另 14 项 views/recovery 组件与 client typecheck 通过，刷新恢复截图已检查前一版布局并据此补充对象标签。浏览器刷新与 Host 独立重启分别有证据，同时重启整个正式应用/ModuleLoader/profile 仍需综合验收。

未知结果时的执行控件：增量可选 runtime 方法 `hasUnresolvedAction(descriptor)` 只投影 controller 已持有的原操作状态。Composer 据此禁用再次执行，并显示先核对原结果的说明，对账按钮继续可用。判断按当前上下文、owner、action 和 target 绑定，更新 descriptorRef 不能绕过，同 owner 的另一个目标不被误锁；成功对账后释放。该 UI 投影不替代 Host 持久身份查询，也不创建新的执行权威，旧 runtime 未实现可选方法仍保持兼容。

验证：44 项 controller/Composer/runtime 测试及 client typecheck 通过；`temp/integration-test-runs/eikona-discovery-20260909001822Z-3329868/` 的原生 browser 在真实 owner 响应丢失后确认执行按钮禁用、说明可见，再刷新并走存储恢复。该运行包含 28 项组件、4 项 adapter 与 Go/browser 集成。正式 profile 和完整生成/修改/交付任务仍开放。

对账失权增量：刷新后的恢复界面首次查询由测试 fetch 边界注入 owner 403。界面仍显示未确认，原幂等键和恢复记录不丢失，也不恢复执行按钮；恢复访问后第二次查询同一原键成功，清除恢复行。整个流程一个 dispatch、一个 owner 提交、两次只读 reconcile。采用 unknown/reconcile_required 的说明现在随中英界面翻译，明确先恢复访问并查询原操作，底层回执事实不变。

证据 `temp/integration-test-runs/eikona-discovery-20260909002211Z-3373699/`：28 组件、4 adapter 及 Go/原生 browser 集成通过，client typecheck 通过。此前失权截图已人工检查并据此补上中文说明。403 是可控错误注入，未改真实凭据或权限；它证明 consumer 的拒绝处理与原键保留，不能替代正式授权策略的整体验收。

## 生成闭环的 owner 配套任务（2026-09-09）

重新核对生产路径后确认：已有 canonical generation adapter 仅接收受信任 `GenerationPreparation`，当前没有生产解析器。`prompts.RenderEntryVersion` 可复用固定模板版本，但项目归属、变量、引用、typed controls 与 owner 费用批准仍需绑定。DSH 不改用旧 generation REST 绕开既定幂等/批准合同，也不传入 callback 或 app.SubmitRequest。

已通过 `openspec new change` 在 `cli/eikona` 建立 `eikona-dsh-generation-preparation-v1`，并用 tasks CLI 创建 10 项任务，覆盖合同核对、固定版本解析、不可变准备、明确批准、canonical 装配、CLI/HTTP/SDK、fixture/原生 DSH/真实 provider 及质量门。Proposal/design/spec/tasks 已落盘并 strict 校验通过，owner consumer matrix 有回链。此 change 为 split-owner 的缺口实施，影响本 change 的 1.1、1.2、2.2–2.4、5.1、5.3、4.2；全部 required 图像能力保持原范围，首段单图不替代编辑/mask/batch。当前完成的是缺口定位和实施规格，生产生成仍未就绪。
