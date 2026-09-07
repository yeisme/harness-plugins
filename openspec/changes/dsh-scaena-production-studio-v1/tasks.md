# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Scaena Production API 与 review-package 合同：镜头/资产/声音动作、编排计划、导出、transport 逐项记录版本/digest、支持/缺失/未验证；与 agent/scaena 双向链接。
- [ ] 1.2 冻结最小制作台 consumer 合同与 UI Contract；核对脚手架复用。
- [ ] 2.1 实现制作项目/镜头/资产列表 adapter：project scope、分页、freshness、诚实态。
- [ ] 2.2 实现动作发现/预览/确认：descriptor、权限、expected version/digest；stale 拒绝刷新不覆盖。
- [ ] 2.3 实现候选比较与采纳：复用既有候选通道；owner receipt、版本与目标 scope 分别取得。
- [ ] 2.4 实现编排预览：固定范围、将执行项与范围外输入阻塞清单；跨领域经 creative-workflow 的 Ordo 通道不重复实现。
- [ ] 2.5 实现导出交付消费：owner 回执与产物 ref 为准；部分成功保留已完成成果；关闭 Pane 不取消。
- [ ] 2.6 实现 review-package 固定版本消费与 transport 验证。
- [ ] 3.1 注册制作台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 focused 测试全绿后运行全门禁。
- [ ] 4.2 Scaena staging 真实闭环验证：真实动作→候选→编排预览→导出；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
