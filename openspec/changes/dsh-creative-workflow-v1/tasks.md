# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对画布 document 合同与 Ordo managed-work 面：节点/引用消费接口、计划适配所需字段逐项记录支持/缺失/未验证；与 dsh-project-canvas-continuity-v1、agent/ordo 双向链接。
- [ ] 1.2 冻结执行边/用途/兼容合同与 UI Contract；核对脚手架复用；不建第二 graph document。
- [ ] 2.1 实现执行边编辑与兼容校验：输出版本+输入用途、不兼容保留草案并显示原因、有向无环校验；reducer 测试。
- [ ] 2.2 实现范围解析与预览：单节点/选中分支/完整流程、范围外输入固定版本检查、阻塞清单；不静默扩大范围。 | evidence: 进行中：已有单节点/分支/全图解析、固定外部输入、结构阻塞与上游变化notice；本轮修复预览保留旧结果，绑定生成时document对象/选择集合/范围种类，任何变化后隐藏旧预览并要求显式重新检查。实际画布UI回归覆盖修改文字及切换选中节点，3项view测试/typecheck通过。owner能力/输入类型/费用/授权的真实预览合同与Ordo计划仍未完成。
- [x] 2.2a 完成纯草案范围解析：单节点/执行下游/整图、固定范围外输入、环路和重复输入检查；不授予执行/预算权限，父2.2保持未完成。 | evidence: implementation-baseline.md；17 focused unit tests / 11 existing protocol tests / package typecheck passed；非UI或真实owner验收。
- [ ] 2.3 实现计划冻结与确认：冻结输入/参数/版本/摘要；预算 unknown 显式确认；范围/成本变化重新确认。
- [ ] 2.4 实现 Ordo 计划适配：选定执行图→可预览可确认的 Ordo 计划；不新增调度/审批语义。 | evidence: 已核实Ordo现有workflow.plan从OpenSpec编译runtime/filesystem lane，RunPlannerService面向team/runtime/plugin capability；未发现五创作owner端口图入口，不把通用plan或fake回退当适配完成。Ordo配套openspec/changes/ordo-dsh-creative-workflow-adapter-v1已由CLI创建，proposal/design/spec/tasks齐全并严格校验通过，覆盖固定输入/费用/确认/原身份对账/部分失败。执行适配与DSH联调仍未实现。
- [ ] 2.5 实现运行观察与恢复：订阅复用、游标恢复、generation 检查、unknown 对账；关闭 Pane 不取消、刷新不重放。 | evidence: 主动恢复入口及完整Chromium关闭/新建后的原键查询已通过。新增实际Pane360/560/960×zh/en六组恢复UI Tab/Shift+Tab焦点、无横向溢出、浏览零自动查询/dispatch，最后Enter仅查询一次通过 temp/integration-test-runs/auctra-owner-http-20260908T135032946Z-3249531/；surface门通过。此前存储覆盖修正见baseline。未提交草稿持久化、200%缩放、Ordo全流程仍待。
- [ ] 2.6 实现上游修改标记与重跑：受影响节点标记、已采用结果保留、重跑只产生新候选。 | evidence: 进行中：输入影响标记已随Host存储保留；本轮运行草稿预览增加external_input_changed notice：外部上游输入变化时明确提示本次仍用原选定输出版本，保留该版本、不自动重跑上游、不扩展所选范围，也不把草稿notice当owner阻断/授权。画布中英提示已接；固定输出版本4+单节点范围不变回归及view共12项/typecheck通过。真实owner确认、运行快照与新候选链仍待完成。
- [ ] 3.1 画布内嵌与 inspector 注册：token/locale/键盘等价、dispose/HMR 无残留。
- [ ] 4.1 依赖2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 Ordo staging 真实闭环验证：真实计划→确认→观察→恢复；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.2；实现模板、手动连线与Agent草案创建，scope编辑摘要/撤销；模板不带旧权限，不创建第二graph。
- [ ] 5.2 依赖1.1；对确认缺失的跨owner计划适配在agent/ordo创建配套OpenSpec/tasks并双向链接；单领域内部workflow直达原owner，不能全包进Ordo。
- [ ] 5.3 依赖2.2/2.3；实现人工候选选择/审阅点、preview revision fence、范围/预算变化再确认；运行中草案不改原计划。
- [ ] 5.4 依赖1.2及2.x稳定；完成工作流可丢弃原型与scope/环路/类型/费用unknown/partial/迟到/恢复矩阵；focused验证，真实执行仍归4.2。
