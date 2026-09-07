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
- [ ] 4.1 focused 测试全绿后运行全门禁。
- [ ] 4.2 Anatomia staging 真实闭环验证：真实观察→范围分析→审阅→参考回填；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
