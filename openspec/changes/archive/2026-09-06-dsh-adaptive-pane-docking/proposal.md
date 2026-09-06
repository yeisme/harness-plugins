# Pane 自适应停靠体验

## Why

当前拖拽仅在固定约 40px 边缘命中，反馈是空矩形而非真实空间让位；窄窗口仍沿固定轴和比例压缩面板。用户要求更自然的自动贴边与自适应体验。

## What Changes

- 使用与目标面板尺寸成比例的吸附区，并为已命中的边缘提供退出容差。
- 拖到另一组内容区可合并标签，Alt 拖动保留明确的自由悬浮。
- 展示真实分屏尺寸与相邻 Pane 让位，松手前不提交布局；取消回到原状态。
- 空间不足时投影为上下排列，并约束可读尺寸；恢复宽窗口时还原保存的比例。
- 收敛标签视觉，扩大分隔线命中区，双击恢复均衡比例。

## Capabilities

### New Capabilities
- `adaptive-pane-docking`: 磁性停靠、临时布局预演及响应式几何。

### Modified Capabilities

无。现有 Pane 引用、会话身份、布局版本和插件合同不变。

## Impact

Owner 分类为 split-owner：DSH staging 的 ui-layout 维护宿主展示几何，harness-plugins 维护 upstream-prs 补丁、既有 UI 合同及联合验收。不开长期 core fork，不复制会话、草稿或轨迹数据，不推送或调用外部业务。
