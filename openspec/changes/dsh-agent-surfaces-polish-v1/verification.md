# 验证记录

由仓库命令从实际测试 summary 生成。完整真实执行、有限返工和人工验收继续由 dsh-ordo-project-command-center-v1 的未关闭任务跟踪；不把协议或合成数据测试当作真实模型证据。

- `temp/integration-test-runs/ui-visual-2026-09-12T18-12-04-672Z-2637642/summary.json`：passed
- `temp/integration-test-runs/2026-09-12T18-01-21-845Z-2514087-pane-subagent-profile/summary.json`：passed
- `temp/integration-test-runs/ui-visual-2026-09-12T18-06-23-076Z-2590064/summary.json`：failed
- `temp/integration-test-runs/ui-visual-2026-09-12T18-10-32-000Z-2626368/summary.json`：failed

本轮相关包测试：Subagents 24 项、Ordo UI 73 项通过；1 项真实 CLI 集成用例按其独立运行入口跳过。全仓构建与类型检查、29/29 bundle 合同、插件与 Surface 检查、DSH staging 兼容检查均通过。

全仓视觉套件在本轮未修改的 Market 与 Selection Actions 页面连续失败后主动中断，未声称全仓视觉通过。其遗留测试服务器造成一次后续端口占用失败；核实进程属于该轮后清理，再次单独运行本轮 8 项浏览器场景，全部通过。未修改范围外截图基线。

截图使用实际编译插件与合成数据。200% 用 CSS 渲染缩放检查布局，不等同于原生浏览器缩放或真实模型执行验收。

证据位于本地 temp 目录，重新检出后需通过任务中的验证命令重建。
