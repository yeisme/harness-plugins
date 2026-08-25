# dsh-pane-drag-motion Specification

## Purpose
TBD - created by archiving change dsh-pane-workspace-interaction-v4. Update Purpose after archive.
## Requirements
### Requirement: Drag SHALL 使用单一跨 region generation
Right 与 Bottom React roots SHALL 共享一个 `PaneDragCoordinator` generation、source view、target、announcement 和 cleanup lifecycle。插件 MUST NOT 为每个 region 创建独立 drag truth 或在 pointermove 期间直接修改 canonical layout。

#### Scenario: Tab 从 Right 拖到 Bottom
- **WHEN** 用户在 Right 开始 drag 并进入 Bottom target
- **THEN** 两个 roots SHALL 观察同一 source/target generation
- **AND** drop 前 controller SHALL 不提交 move/split intent

### Requirement: Drag start SHALL 区分点击、滚动和拖动
Fine pointer SHALL 在移动超过 6px 后进入 dragging；coarse pointer SHALL 支持约 180ms 长按并在滚动手势确认前保持 pending。普通点击、双击、context menu 和 touch scroll MUST NOT 误触 layout drag。

#### Scenario: 触摸横向滚动 Tab strip
- **WHEN** 用户在 Tab 上快速横向滑动且未完成长按
- **THEN** Tab strip SHALL 滚动而不开始 drag
- **AND** canonical layout 与 source focus SHALL 保持不变

### Requirement: Active drag SHALL 提供 ghost、source placeholder 和稳定 target
Dragging SHALL 渲染不含 view body 的 Tab ghost，并在 source 保留占位；target group SHALL 显示 center insertion marker 或 edge split zone。Ghost SHALL 展示安全 icon、bounded title 和状态，不得复制 terminal/media/domain content。

#### Scenario: 拖动 dirty Tab
- **WHEN** dirty Tab 进入 dragging
- **THEN** ghost SHALL 表达 dirty 状态，source placeholder SHALL 保留原宽度
- **AND** view body SHALL 保持原宿主直到 drop commit

### Requirement: Drop zone SHALL 有尺寸门、hysteresis 和禁用原因
Center/left/right/top/bottom zones SHALL 基于 group rect、最小 Pane 尺寸、max depth/group、locked role 和 provider policy计算。Edge target SHALL 使用最小可命中区域和 hysteresis，避免 pointer 在边界附近反复切换；禁用 target SHALL 保持可见并说明原因。

#### Scenario: 目标无法再拆分
- **WHEN** edge split 会违反 280×180px、深度 2 或最多 4 个可见 group
- **THEN** edge zone SHALL 显示 disabled reason，center move/reorder 若合法仍可用
- **AND** drop 在禁用 zone MUST NOT 先移除 source

### Requirement: Drop SHALL 只提交一个原子 layout intent
Reorder、move、cross-region move 或 split SHALL 在 pointer release 后转换为一个 typed reducer intent。验证失败 SHALL 保持 source group、Tab order、active state 和重型 view attachment 不变。

#### Scenario: Drop 前 source provider 卸载
- **WHEN** drag 期间 source view 变为 orphaned 或被移除
- **THEN** coordinator SHALL 取消 session并宣布 source 不再可用
- **AND** MUST NOT 对 target 提交残缺 intent

### Requirement: 成功 drop SHALL 使用有界 FLIP layout motion
成功 intent 后，Workbench SHALL 测量受影响 Tab/group 的 first/last rect，并使用 transform-based FLIP 或等价方式在默认 140ms 内收敛。真实 view lifecycle SHALL 按 old suspend/dispose 后 new attach/activate 串行执行，MUST NOT 因动画产生双 terminal、双 playback 或双 owner subscription。

#### Scenario: 播放中的媒体 Tab 跨 region 移动
- **WHEN** media Tab 从 Right drop 到 Bottom
- **THEN** ghost/Tab chrome SHALL 连续过渡到目标，old renderer SHALL 先 suspend，new host 再 activate
- **AND** MUST NOT 出现双音轨、双 decoder 或重复 access handle

### Requirement: 取消 SHALL 完整恢复视觉、焦点和资源
Escape、pointercancel、window blur、locale switch、HMR、source unmount 或 invalid drop SHALL 取消 drag，移除 ghost/portal/DOM flags/listeners、清除 target、恢复 source scroll/focus，并保持 canonical layout 不变。

#### Scenario: 按 Escape 取消跨区 drag
- **WHEN** ghost 位于 Bottom target 且用户按 Escape
- **THEN** ghost 和 target indicator SHALL 消失，focus SHALL 回到 source Tab
- **AND** source Tab SHALL 仍位于原 Right group

### Requirement: Reduced motion SHALL 保留状态信息但取消位移动画
当系统或 user preference 为 reduced motion 时，Workbench SHALL 禁用 ghost flight、FLIP 位移和非必要 region transition；source placeholder、target indicator、disabled reason、commit/cancel announcement SHALL 保留。

#### Scenario: Reduced motion 下 reorder
- **WHEN** 用户在同一 group 拖动 Tab 并 drop
- **THEN** order SHALL 即时更新且 screen reader 收到结果
- **AND** 不得播放 transform、spring、bounce 或 opacity pulse 动画

### Requirement: Keyboard move SHALL 使用同一 target 与 intent 语义
Keyboard/command move mode SHALL 列出与 pointer drag 相同的合法 target、edge、禁用原因和 reducer intent。Arrow/Home/End SHALL 导航 target，Enter 应用，Escape 取消；live region SHALL 宣布 source、target、结果。

#### Scenario: 键盘拆分到右侧
- **WHEN** 用户从 Tab menu 进入 Move，选择目标 group 的 right edge 并按 Enter
- **THEN** Workbench SHALL 执行与 pointer edge drop 相同的 `split_with_view` intent
- **AND** focus SHALL 移到新 group 的活动 Tab

### Requirement: Drag performance SHALL 有可验证预算
Pointermove SHALL 每 animation frame 最多更新一次 ghost transform/target snapshot，drop 前 reducer dispatch 数 MUST 为零，drop 时 layout dispatch MUST 恰好一次。Drag SHALL 不触发整个 view tree 或 owner projection 的逐帧 rerender。

#### Scenario: 高频 pointermove
- **WHEN** browser 在一帧内发送多个 pointermove events
- **THEN** coordinator SHALL 合并到一个 visual update
- **AND** component evidence SHALL 证明 owner view body render count 不随每个 raw event 增长

