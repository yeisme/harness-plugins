# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Sonora workflow/subtitle/tts 合同：各 provider 声音/字幕/对齐/导出能力逐项记录版本/digest、支持/缺失/未验证；明确 segment-to-cue 与 word-level alignment 的边界；与 cli/sonora 双向链接。
- [ ] 1.2 冻结最小声音台 consumer 合同与 UI Contract；核对脚手架复用。
- [ ] 2.1 实现声音工作列表 adapter：project scope、分页、freshness、诚实态。
- [ ] 2.2 实现 provider 能力矩阵消费：owner 描述为源，缺失/未验证保留禁用入口并说明原因。
- [ ] 2.3 实现动作发现/预览/确认：descriptor、权限、费用状态；取消以 owner 确认为准。
- [ ] 2.4 实现试听与字幕/对齐产物消费：授权 rendition、固定版本、既有媒体 renderer；不做本地转码。
- [ ] 2.5 实现交接：owner receipt、版本与目标 scope 分别取得；回填画布/引用工作区。
- [ ] 3.1 注册声音台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：选定台词/片段→配音/音乐/音效→试听比较→审阅采用→字幕/对齐核验→镜头绑定或支持的导出；逐能力标注fixture/real，至少一项拒绝与恢复：unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production；零匹配/skip不能通过。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在cli/sonora创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-sonora-audio-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.5、5.2；负责领域UI；补齐台词/角色声音、TTS/music/SFX三类配置、试听/片段/候选、转写cue与精度、权利/质量、固定版本镜头交接；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。
- [ ] 5.4 依赖5.3；负责验证；覆盖unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。
