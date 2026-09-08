# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Anatomia 公共接口与视频观察合同：时间坐标、来源/关键帧访问、范围分析、审阅、固定版本参考包逐项记录版本/digest、支持/缺失/未验证；与 agent/anatomia 双向链接。
- [ ] 1.2 冻结最小分析台 consumer 合同与 UI Contract；核对脚手架复用；时间坐标换算收敛到 adapter 层。
- [ ] 2.1 实现观察列表与详情 adapter：project scope、分页、freshness、空/错/禁用诚实态。
- [ ] 2.2 实现授权关键帧/来源访问：只用 owner rendition/范围；无授权显示原因，不做客户端截帧。
- [ ] 2.3 实现范围分析动作发现/预览/确认：descriptor、权限、expected revision；idempotency 与取消语义与 owner 合同一致。
- [ ] 2.4 实现观察订阅与游标恢复：gap 触发一次权威重读，unknown 不自动 mutation。
- [ ] 2.5 实现审阅动作与固定版本参考包消费：stale 标注、显式刷新比较、版本固定引用回填画布/引用工作区。
- [ ] 3.1 注册分析台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：导入授权视频→分析→镜头/证据定位→审阅观察→提取固定版本参考包→交接；逐能力标注fixture/real，至少一项拒绝与恢复：来源失权、时间基准错配、partial coverage、冲突审阅、stale revision包、取消未知；零匹配/skip不能通过。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在agent/anatomia创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-anatomia-analysis-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.5、5.2；负责领域UI；补齐来源导入/分析配置、播放器+镜头/场景/字幕/关键帧、范围选择、observed/inferred/coverage/冲突、revision审阅和参考提取；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。
- [ ] 5.4 依赖5.3；负责验证；覆盖来源失权、时间基准错配、partial coverage、冲突审阅、stale revision包、取消未知，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。
