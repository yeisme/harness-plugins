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
- [ ] 4.1 focused 测试全绿后运行全门禁。
- [ ] 4.2 Auctra staging 真实闭环验证：真实读取→候选→采纳→保存/冲突恢复；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
