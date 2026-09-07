# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对画布 document 合同与 Ordo managed-work 面：节点/引用消费接口、计划适配所需字段逐项记录支持/缺失/未验证；与 dsh-project-canvas-continuity-v1、agent/ordo 双向链接。
- [ ] 1.2 冻结执行边/用途/兼容合同与 UI Contract；核对脚手架复用；不建第二 graph document。
- [ ] 2.1 实现执行边编辑与兼容校验：输出版本+输入用途、不兼容保留草案并显示原因、有向无环校验；reducer 测试。
- [ ] 2.2 实现范围解析与预览：单节点/选中分支/完整流程、范围外输入固定版本检查、阻塞清单；不静默扩大范围。
- [ ] 2.3 实现计划冻结与确认：冻结输入/参数/版本/摘要；预算 unknown 显式确认；范围/成本变化重新确认。
- [ ] 2.4 实现 Ordo 计划适配：选定执行图→可预览可确认的 Ordo 计划；不新增调度/审批语义。
- [ ] 2.5 实现运行观察与恢复：订阅复用、游标恢复、generation 检查、unknown 对账；关闭 Pane 不取消、刷新不重放。
- [ ] 2.6 实现上游修改标记与重跑：受影响节点标记、已采用结果保留、重跑只产生新候选。
- [ ] 3.1 画布内嵌与 inspector 注册：token/locale/键盘等价、dispose/HMR 无残留。
- [ ] 4.1 focused 测试全绿后运行全门禁。
- [ ] 4.2 Ordo staging 真实闭环验证：真实计划→确认→观察→恢复；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
