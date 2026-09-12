# DSH Creator Studio Host

This package is the safe Host boundary for Creator Studio. It selects one
typed local or configured service adapter per owner, freezes the DSH context,
validates snapshots and action receipts, and exposes only bounded projections
to the browser.

The additive V2 surface freezes an optional project ref, exposes Host-paginated
current/all-project asset queries, and maps the mounted Ordo Agent Ops service
into separate generation and approval projections. Legacy jobs/reviews remain
available for one release.

Canonical text, media, ProductionGraph, analysis, scheduling, approvals, and
terminal results stay with Auctra, Eikona, Sonora, Scaena, Anatomia, Pinax,
and Ordo. The directory never retries an uncertain mutation or falls back to a
second transport after dispatch.

## Eikona 固定准备

安装 bundle 注册 `creatorStudio.prepareEikonaGeneration(input)`，通过选中的 Eikona adapter 调用上述准备服务。Gateway 校验输入和安全结果，并在返回前复核会话、项目和 adapter 世代；未提供该可选方法的 adapter 返回 unavailable。这个 Remote 只创建准备，不批准或执行生成。

`EikonaDiscoveryClient.prepareGeneration(context, input)` 接收 `prompt_id`、固定 `prompt_version`、可选变量和单图 typed controls。连接须单独设置 Host 核验的 `admission.preparationApproved`；它只允许创建准备，不批准费用或执行。项目由 credential scope 填入，调用者不能传 `project_ref`。未知响应返回 unconfirmed，不自动重发；调用者应保留草稿并明确处理恢复。

`createEikonaDiscoveryAdapter(client, configured, selectedPreparation)` 的第三个参数可选，由 Host 按完整 context 返回 `{ preparationRef, digest }` 或 `undefined`。固定准备经实际 owner 读取、引用及摘要匹配，并在读取后复核选择，才作为 `generation-preparation` 资源进入既有 snapshot。不要从列表顺序推断选中准备。

资源保留有界参数和 `cost: unknown`、`execution: not authorized`，不包含提示词正文，不发布生成动作。该入口用于展示已由 owner 创建的准备；配置、显式费用批准和执行仍须接通对应 owner 合同。


### Eikona 生成组合入口（接线中）

`withEikonaGeneration(base, client, selection)` 增量包裹既有 Eikona adapter，保留采用等原动作。`selection(context)` 必须来自 Host 已核验的批准绑定，返回 `EikonaApprovalResult` 的 approved 投影；不得直接相信浏览器草稿 checkpoint。组合器会重新读取 owner 准备和批准状态，并要求连接 `generationExecutionApproved: true` 与 generation discovery 准入。缺省无生成动作，不自动启用权限。

提交沿用 Gateway 确认、原幂等键与操作恢复；只读 reconcile 使用原 target/key，不依赖当前 selection 或执行权限。该入口已导出但尚未在默认 registry 装配，真实 owner 联调及完整生成页面验收仍由 `dsh-eikona-studio-v1` 跟踪。
