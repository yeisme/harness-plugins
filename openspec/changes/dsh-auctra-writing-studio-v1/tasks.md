# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Auctra Service API 与 text working copy 合同：各文本类型结构映射、正文授权读取、候选、版本链、保存回执逐项记录版本/digest、支持/缺失/未验证；与 cli/auctra 双向链接。
- [ ] 1.2 冻结最小文本台 consumer 合同与 UI Contract；核对脚手架复用；结构映射收敛 adapter normalizer。
- [ ] 2.1 实现文本项目/结构列表 adapter：project scope、分页、freshness、诚实态。
- [ ] 2.2 实现正文授权读取：显式范围、内容与控制面摘要分离；未授权类型不渲染正文。
- [ ] 2.3 实现编辑与 Agent 候选通道：owner candidate、变更摘要、可撤销；不修改已采纳版本。
- [ ] 2.4 实现候选比较与采纳：复用既有候选/diff 通道；采纳与保存分离。
- [ ] 2.5 实现保存/冲突恢复：owner receipt 确认保存态；冲突保留输入，提供重读/比较/另存草案。
- [ ] 3.1 注册文本台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：打开小说/剧本/文本→编辑并确认保存→选区交给Agent→比较并采用candidate→Checkpoint/Review→固定版本导出；逐能力标注fixture/real，至少一项拒绝与恢复：IME/emoji、并发编辑、candidate base过期、autosave失败、atomic change-set失败、采用不晋级Canon；零匹配/skip不能通过。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在cli/auctra创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-auctra-writing-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.5、5.2；负责领域UI；补齐三类结构/正文编辑、选区到Agent、候选Diff、Working Copy/Checkpoint/Review/Canon、fixed-version导出；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。
- [ ] 5.4 依赖5.3；负责验证；覆盖IME/emoji、并发编辑、candidate base过期、autosave失败、atomic change-set失败、采用不晋级Canon，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。
