# Eikona 生成台实施基线

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
