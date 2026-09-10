# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 卸载web与ui-acceptance插件依赖及bundle注册 | evidence: 两个活动profile通过npm pkg与dsh plugin remove移除；读取package.json断言依赖及bundle数组均不含目标插件。备份profile与用户数据未改。
- [x] 1.2 旧bundle变为空操作并移除交互空间自动挂载，验证构建与无UI冒烟 | evidence: 彻底删除client/bundle及lib、专属tests/runners/fixture和截图；移除桌面事件监听、设置UI和目录行；lockfile/catalog重生成且无目标包。workspace/desktop类型检查、surface/plugin检查通过；命令目录6项测试通过；保留surface视觉冒烟通过temp/integration-test-runs/ui-visual-2026-09-09T16-34-48-005Z-1950209。历史审计/引用协议及用户数据保留。
- [x] 1.3 记录退役范围和停止样式迭代，保留用户数据 | evidence: 两包README与历史设计标记退役，视觉change 1.3记录取消；本change设计明确数据保留、旧页面刷新以及不继续开发。
