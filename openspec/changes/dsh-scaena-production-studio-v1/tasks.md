# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Scaena Production API 与 review-package 合同：镜头/资产/声音动作、编排计划、导出、transport 逐项记录版本/digest、支持/缺失/未验证；与 agent/scaena 双向链接。 | evidence: implementation-baseline.md：合同初查完成（owner HEAD 087f7820）：Production四个只读合同+action descriptor+review-package镜头/资产/编排/导出/transport已逐项记录版本与支持状态；声音动作确认缺失（media路由未进catalog，404）。agent/scaena侧无本change反向链接（全文grep仅命中其他DSH change先例），owner侧配套与反向链接须由scaena-owner会话经5.1落地，本仓不代写，故保持未勾。
- [x] 1.2 冻结最小制作台 consumer 合同与 UI Contract；核对脚手架复用。 | evidence: implementation-baseline.md：最小consumer合同冻结（只读四合同/storyboard-packages动作+SSE游标恢复；声音动作与future inventory明确排除，未知critical版本拒绝）；UI Contract在design.md两节冻结（adopted workspace+inspector、State Matrix、Responsive、A11y，符合视觉系统§12字段）；脚手架复用核对CreatorActionComposer/artifact-workspace/SurfaceState与host gateway/validation。本切片无代码，openspec validate --strict 通过。
- [ ] 2.1 实现制作项目/镜头/资产列表 adapter：project scope、分页、freshness、诚实态。
- [ ] 2.2 实现动作发现/预览/确认：descriptor、权限、expected version/digest；stale 拒绝刷新不覆盖。
- [ ] 2.3 实现候选比较与采纳：复用既有候选通道；owner receipt、版本与目标 scope 分别取得。
- [ ] 2.4 实现编排预览：固定范围、将执行项与范围外输入阻塞清单；跨领域经 creative-workflow 的 Ordo 通道不重复实现。
- [ ] 2.5 实现导出交付消费：owner 回执与产物 ref 为准；部分成功保留已完成成果；关闭 Pane 不取消。
- [ ] 2.6 实现 review-package 固定版本消费与 transport 验证。
- [ ] 3.1 注册制作台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：创建或打开镜头→绑定图像/声音→制作→比较替换候选→保存镜头编排→审阅→合成或导出；逐能力标注fixture/real，至少一项拒绝与恢复：候选digest冲突、绑定失权、partial制作、声音时长不匹配、导出失败、unknown采用；零匹配/skip不能通过。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在agent/scaena创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-scaena-production-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.6、5.2；负责领域UI；补齐项目/剧集/场景/镜头导航、结构编辑、图像/声音绑定、候选替换、镜头顺序/时长与支持的合成/导出；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。
- [ ] 5.4 依赖5.3；负责验证；覆盖候选digest冲突、绑定失权、partial制作、声音时长不匹配、导出失败、unknown采用，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。
