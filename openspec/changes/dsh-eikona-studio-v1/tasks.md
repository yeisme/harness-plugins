# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Eikona consumer contract matrix 与实际 registry/handler/SDK：generation/workflow/batch/asset/lineage/handoff 逐项记录版本或 digest、源码位置、支持/缺失/未验证；遮罩/局部编辑模型支持单独成表；与 cli/eikona 双向链接。
- [ ] 1.2 冻结最小生成台 consumer 合同与 UI Contract；核对现有 host/client/bundle 脚手架复用；项目列表 project scope/分页/freshness 语义冻结。
- [ ] 2.1 实现项目与资产列表 adapter：分页游标、freshness、空/错/禁用诚实态；不从列表顺序推断最新采用。
- [ ] 2.2 实现动作发现与预览：server-authored descriptor、输入类型、权限、费用状态、expected revision；缺失能力保留禁用入口并显示原因与owner任务。 | evidence: implementation-baseline.md：已区分owner费用unknown/零报价/估算；输入绑定预览、预算与实际动作发现未完成。
- [ ] 2.3 实现草案参数编辑：base revision、有限变更集、摘要与撤销；不原地修改 accepted artifact。
- [ ] 2.4 实现确认执行与取消：固定计划、idempotency、预算/权限复核；取消收到 owner 确认才显示 cancelled，unknown 只对账。 | evidence: implementation-baseline.md：已接增量原键对账schema/Host/Remote/controller/UI，13 Gateway+11 client focused通过；Eikona实际adapter、持久恢复、预览与取消未完成。
- [ ] 2.5 实现候选读取与比较：显式授权正文/媒体范围、内容与控制面摘要分离；复用既有候选组件不复制状态机。
- [ ] 2.6 实现采纳/写回/交接回执：分别取得 owner receipt、版本与目标 scope；资产按 ArtifactRefV1 回填画布节点。
- [ ] 3.1 注册生成台 Pane：token/locale/键盘等价操作、独立打开与重复绑定 focus 原 Pane、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行 typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual。 | evidence: implementation-baseline.md：共享Composer消费bundle外部require已修复；Director build/smoke/4 declaration及全局check:plugins通过，完整领域实施与全部质量门仍未完成。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：真实生成两候选→比较→基于选定结果修改→保留旧版并采用新版→固定版本引用/交接；逐能力标注fixture/real，至少一项拒绝与恢复：默认模型/不支持模型、遮罩过期、费用unknown、批量partial、重复点击、采用与交接分离；零匹配/skip不能通过。
- [ ] 4.3 保存脱敏证据并更新实际 readiness；不把协议测试当真实生成验收。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在cli/eikona创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。 | evidence: 已创建cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1配套9项tasks并双向链接；确认Phase A discovery及mint-only生成/review/handoff缺口；完整领域adapter与mask/batch矩阵未完成。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-eikona-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.6、5.2；负责领域UI；补齐生成配置与固定默认模型、参考图/区域/遮罩、批量候选、比较继续修改、资产lineage与固定引用；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。 | evidence: implementation-baseline.md：owner显式model选项支持时初始化canonical默认模型，保留用户选择，不自动降级；完整生成/遮罩/候选页面未完成。
- [ ] 5.4 依赖5.3；负责验证；覆盖默认模型/不支持模型、遮罩过期、费用unknown、批量partial、重复点击、采用与交接分离，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。 | evidence: implementation-baseline.md：46项client回归通过，确认随参数/计划变更失效，旧回执不清空后来草稿；真实owner与完整领域反例未完成。
