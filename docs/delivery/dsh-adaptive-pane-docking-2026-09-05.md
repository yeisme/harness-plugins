# Pane 自适应停靠体验修正

本轮解决固定窄边缘难以命中、拖动只出现空框、窄屏硬挤，以及标签像独立小窗口的问题。继续使用现有宿主布局和 session 身份；轨迹仍与对应对话同 Pane。

## 操作变化

- 靠近目标边缘即可感应，不必精确对准最外侧。面板越大，合理的感应范围越大。
- 拖拽时相邻内容提前让位，蓝色区域显示松手后的真实占用空间。边缘轻微抖动不会反复切换落点，更接近另一个边缘时仍会切换。
- 拖到另一组中间直接合并标签；Alt 拖动可临时关闭吸附，继续自由悬浮。悬浮组标题栏仍可移动整组、贴边停靠。
- 窄窗口优先按可读宽度改为上下排列；变宽后恢复原比例。窗口变化和悬停预演不会改写保存的布局。
- 分隔线更容易抓取，双击可恢复均衡比例。标签按空间收缩，关闭按钮在选中／悬停／键盘聚焦时出现。

本文保留历史验收数据；当前入口及清理、回退说明统一见 [DSH 本地工作台](../runtime/dsh-workbench.md)。

## 实测前后

- [修改前：拖到目标内侧时邻居尺寸不变](../../temp/integration-test-runs/adaptive-panes-before-2026-09-05T14-07-20-504Z/artifacts/before.png)，[几何记录](../../temp/integration-test-runs/adaptive-panes-before-2026-09-05T14-07-20-504Z/artifacts/baseline.json)。
- [修改后：真实分屏让位预演](../../temp/integration-test-runs/adaptive-panes-2026-09-05T14-37-10-826Z/artifacts/magnetic-preview.png)。
- [窄窗口自动上下排列](../../temp/integration-test-runs/adaptive-panes-2026-09-05T14-37-10-826Z/artifacts/responsive-stack.png)。
- [宽窗口恢复后的工作区](../../temp/integration-test-runs/adaptive-panes-2026-09-05T14-37-10-826Z/artifacts/after.png)。

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 宿主布局相关测试 | 82 项通过 | [日志](../../temp/integration-test-runs/adaptive-panes-2026-09-05T14-37-10-826Z/artifacts/host-unit.log) |
| 磁性停靠与自适应浏览器专项 | 6 条动作链通过 | [结果](../../temp/integration-test-runs/adaptive-panes-2026-09-05T14-37-10-826Z/summary.json) |
| 原有完整工作台浏览器回归 | 21 条动作链通过，保留对话／轨迹／草稿／恢复／取消 | [结果](../../temp/integration-test-runs/unified-workbench-2026-09-05T14-37-09-758Z/summary.json) |
| Surface、视觉、插件门禁 | 三项通过，未更新视觉基线 | [结果](../../temp/integration-test-runs/full-plugins-2026-09-05T14-37-11-650Z-727694/summary.json) |
| 本机主 web | 32 bundle 加载、23 视图打开 | [结果](../../temp/integration-test-runs/unified-main-2026-09-05T14-39-24-160Z/summary.json) |

同一工作树的并发改动曾移除 Desktop 等待统一注册器的逻辑，导致 Git 入口在启动时丢失；本轮恢复等待逻辑并通过相关包 typecheck、测试和构建。没有覆盖其他业务改动。

补丁继续由 upstream-prs/unified-multi-pane-workbench 维护，不改安装目录、不新增长期 fork、不复制业务数据、不发送模型请求、不发布或推送。
