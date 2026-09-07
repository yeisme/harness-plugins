# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Sonora workflow/subtitle/tts 合同：各 provider 声音/字幕/对齐/导出能力逐项记录版本/digest、支持/缺失/未验证；明确 segment-to-cue 与 word-level alignment 的边界；与 cli/sonora 双向链接。
- [ ] 1.2 冻结最小声音台 consumer 合同与 UI Contract；核对脚手架复用。
- [ ] 2.1 实现声音工作列表 adapter：project scope、分页、freshness、诚实态。
- [ ] 2.2 实现 provider 能力矩阵消费：owner 描述为源，缺失/未验证不渲染对应入口。
- [ ] 2.3 实现动作发现/预览/确认：descriptor、权限、费用状态；取消以 owner 确认为准。
- [ ] 2.4 实现试听与字幕/对齐产物消费：授权 rendition、固定版本、既有媒体 renderer；不做本地转码。
- [ ] 2.5 实现交接：owner receipt、版本与目标 scope 分别取得；回填画布/引用工作区。
- [ ] 3.1 注册声音台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 focused 测试全绿后运行全门禁。
- [ ] 4.2 Sonora staging 真实闭环验证：真实配音/字幕→试听→交接；证据标注 fixture/real。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
