# 工作流实现基线

## 恢复入口专项可访问性

完整浏览器重开后的恢复入口已验证实际 360/560/960px × zh/en 六组布局：查询/刷新按钮可通过 Tab 与 Shift+Tab 往返，焦点可见，真实 Pane 宽度正确，无横向溢出。逐组浏览均断言 owner 查询和 dispatch 次数为零；最后通过 Enter 显式查询一次，恢复已确认结果，写入次数不增加。

通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T135032946Z-3249531/`，截图 `artifacts/auctra-recovery-{360,560,960}-{zh,en}.png`；已检查 360px 英文。检查发现按钮焦点框贴近文字后，复用 cs-actions 的既有间距并再次通过；`check:surfaces` 通过。本轮补齐恢复入口自身的窄宽/双语/键盘证据，不借用固定保存编辑器的测试。未提交草稿持久化、200%缩放及 Ordo 完整流程仍开放。

## 主动恢复入口与完整浏览器重开

最终 client focused 通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T13-43-32-951Z-3127809/`，另明确区分确认失败与未知，失败不自动重试。最终 client build 通过。

已新增版本化待对账列表 Remote、controller/runtime 只读查询方法及成果工作区恢复提示。无需有效执行 descriptor 或先点击执行即可发现原请求；用户显式查询 owner 后显示完成/失败/未确认，未确认保留入口，不自动 dispatch。空对象状态也显示恢复入口，其他 owner 记录不混入当前 Pane。

最终真实浏览器通过：`temp/integration-test-runs/auctra-owner-http-20260908T133811476Z-3063694/`。真实保存响应丢失后确认 Host 恢复文件存在且无正文，关闭整个 Chromium 并清空测试端旧请求，启动新浏览器自动显示「查询上次结果」，点击查询恢复 completed，owner PUT 计数不增长，再打开已确认正文。截图 `artifacts/auctra-browser-reopened-recovery.png` 已检查。

**证据修正**：此前联合脚本只给只读 Context 挂了 storage，随后新建的写入 Context 未挂载。`auctra-owner-http-20260908T130142544Z-2666436/`、`auctra-owner-http-20260908T130446063Z-2707636/` 等此前联合运行不能证明真实写入 Context 的持久恢复；独立真实 storage 测试仍有效。最终运行已在写入 Context 挂真实存储并断言实际文件，补齐这一缺口。修复前重开入口超时记录 `auctra-owner-http-20260908T133054838Z-2996049/` 保留。

本轮还遇到并行 Checkpoint/Review 测试的过时无动作断言、类型推断和过短请求键；当前按独立动作不自动调用的真实写请求边界验证，未缩减 owner 正式版本计数断言。client focused（含主动查询、原键、身份隔离）通过 `creative-workspace-client-2026-09-08T13-41-27-960Z-3098091/`；client build、surface/plugin 门通过，固定保存中英六尺寸回归通过 `ui-visual-2026-09-08T13-39-41-943Z-3082388/`。未提交草稿持久化、恢复入口专项窄宽/键盘与 Ordo 全流程仍未完成。

## controller 发送前原键召回

修复新界面被 Host 旧请求拦截后仍拿新键对账的问题。controller 执行前召回持久原身份，完整上下文/owner/action/target 匹配时不 dispatch 新请求，只提示原操作对账；召回失败、跨身份/项目或期间 reset 不发送 owner 操作。reconcile 可重新召回原键，不依赖旧 controller 内存。

focused 通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T13-14-41-021Z-2830774/`，覆盖新 controller 原键恢复且 dispatch 零调用、对账不带 values、召回期间 reset、跨身份/项目拒绝；客户端 build 通过。尚未新增主动待对账列表或完整关闭浏览器的交互验证，不将本结果当作浏览器持久恢复已完成。

## Gateway 已收敛到发送前恢复索引

最终增加恢复读取后的上下文复核，相关 Gateway focused 与真实 HTTP 通过：`temp/integration-test-runs/auctra-owner-http-20260908T130615195Z-2730213/`。

当前 Gateway 只挂载 `OperationRecoveryStore`，在 owner 调用前持久保存原查询身份；同操作已有记录时返回 reconcile_required，不覆盖原键。落盘确认失败、上下文或 adapter 变化时不发送。unknown/pending/partial/accepted 保留记录，匹配 owner 的明确完成/失败/拒绝才可清理。旧 identity helper 仅保留兼容导出，不再运行于 Gateway。

实际 DSH JSON storage + Auctra HTTP 联合通过：`temp/integration-test-runs/auctra-owner-http-20260908T130142544Z-2666436/`；浏览器断线对账与分页回归通过：`temp/integration-test-runs/auctra-owner-http-20260908T130446063Z-2707636/`。初次浏览器运行 `auctra-owner-http-20260908T130240057Z-2684028/` 因 visual-kit 构建产物缺失未进入交互；验证入口已显式构建依赖，失败证据保留。

Gateway 的存储失败零发送、原键不覆盖、新 Gateway 召回和只在原回执确认后清理均有 focused 验证。仍不等同完整浏览器关闭恢复 UI 或草稿持久化；没有 storage seam 的兼容调用仍缺少该保证，任务 2.5 保持开放。

## 原查询身份存储层

最终通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T125454082Z-2570280/`，包含恢复 store 的重复请求、确认丢失、身份变化、容量不淘汰测试，以及真实 DSH storage-domain 关闭/重开与正文不落盘验证。初次替代键 fixture 少于 8 字符导致失败；另一次联合运行被并行 Gateway 测试的不存在 `ctx.stop` 方法打断，当前工作区该测试已修正。保留这些失败证据，不将其替换为本轮通过记录。

新增 `OperationRecoveryStore`，基于现有 storage-domain 保存原查询身份、目标版本和 descriptorRef；不保存正文、values、owner receipt 或执行状态。同 tenant/workspace/project/principal 的相同 owner/action/target 保留原键，跨会话可读取，其他身份隔离。单 Host 写队列串行化，项目上限 128 条且不淘汰未决记录，发送前持久确认失败应阻止 dispatch；只有完整匹配的可信 owner 确认可清理。

当前仅存储类和真实 DSH JSON storage 关闭/重开验证。本轮工作区还出现另一份 `OperationIdentityStore` Gateway 接入，其实现收到 unknown 后才 remember，无法覆盖发送期间进程中断；后续必须收敛到一个发送前持久化路径。新 RecoveryStore 尚未接入 Gateway，不能宣称浏览器关闭恢复完成，也不能将两个原键域都晋级为运行真源。保留未完成 2.5，后续对账只调用 owner 原键查询。

## 2026-09-08：纯草案范围解析

`packages/client/ui-pane-domain/src/project-canvas-workflow.ts` 的 `inspectCanvasRunScope` 消费画布共享document，返回 `draft-inspection`，不产生runnable/authorized、费用、运行状态或审批事实。

单节点只包含该操作；分支只沿execution edges选择下游；整图选择operation节点。参考边不参与运行和环路检查。范围外的operation必须有selectedArtifact，缺失则产生missing_external_output，不扩张范围；material/result使用复制出的固定artifact版本，draft只提供node ID，正文不进入control检查结果。预览后源对象在调用方被改动也不改变已复制的artifact版本。

输出保留映射的input/output/purpose和依赖，重复映射同一input时报告ambiguous_input，不猜测应该选择哪个来源。拓扑检查报告环路阻塞，原图保持可编辑。source/target类型的实际兼容性、owner权限/预算、人工审阅与计划冻结仍须由后续合同/执行适配完成；当前结果不能作为提交计划。

7项范围解析测试与10项共享编辑内核测试通过。父任务2.2还包含真实预览UI、owner输入核验和执行绑定，仍保持未完成；子任务2.2a只记录本纯函数与回归证据。

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-domain exec vitest run tests/project-canvas-workflow.spec.ts tests/project-canvas.spec.ts
```

下一步先将共享document接入画布renderer与host存储，并由工作流UI复用范围检查；不新增第二graph、调度器、Ordo替代品或fixture成功回退。
