# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对 Eikona consumer contract matrix 与实际 registry/handler/SDK：generation/workflow/batch/asset/lineage/handoff 逐项记录版本或 digest、源码位置、支持/缺失/未验证；遮罩/局部编辑模型支持单独成表；与 cli/eikona 双向链接。
- [ ] 1.2 冻结最小生成台 consumer 合同与 UI Contract；核对现有 host/client/bundle 脚手架复用；项目列表 project scope/分页/freshness 语义冻结。
- [ ] 2.1 实现项目与资产列表 adapter：分页游标、freshness、空/错/禁用诚实态；不从列表顺序推断最新采用。
- [ ] 2.2 实现动作发现与预览：server-authored descriptor、输入类型、权限、费用状态、expected revision；缺失能力不渲染入口。
- [ ] 2.3 实现草案参数编辑：base revision、有限变更集、摘要与撤销；不原地修改 accepted artifact。
- [ ] 2.4 实现确认执行与取消：固定计划、idempotency、预算/权限复核；取消收到 owner 确认才显示 cancelled，unknown 只对账。
- [ ] 2.5 实现候选读取与比较：显式授权正文/媒体范围、内容与控制面摘要分离；复用既有候选组件不复制状态机。
- [ ] 2.6 实现采纳/写回/交接回执：分别取得 owner receipt、版本与目标 scope；资产按 ArtifactRefV1 回填画布节点。
- [ ] 3.1 注册生成台 Pane：token/locale/键盘等价操作、独立打开与重复绑定 focus 原 Pane、dispose/HMR 无残留。
- [ ] 4.1 focused 测试全绿后运行 typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual。
- [ ] 4.2 Eikona staging 真实闭环验证：真实生成→取消→候选比较→采纳回填；证据标注 fixture/real 与 owner capability。
- [ ] 4.3 保存脱敏证据并更新实际 readiness；不把协议测试当真实生成验收。
