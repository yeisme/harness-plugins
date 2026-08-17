## ADDED Requirements

### Requirement: Pane Workbench SHALL use a bounded canonical layout

Pane Workbench SHALL represent Right/Bottom regions、split tree、pane group、Tab、active group 与 region visibility in versioned `PaneWorkspaceV1`. Split tree depth MUST NOT exceed 2，visible pane 默认上限 SHALL 为 3、硬上限 MUST 为 4，且每个 split MUST 满足全局与 view descriptor 的最小尺寸。

#### Scenario: 用户尝试创建第五个可见 pane

- **WHEN** 当前 canonical layout 已有四个可见 pane，用户把 Tab 拖到 edge drop zone
- **THEN** edge zone SHALL 显示 disabled reason，center merge SHALL 保持可用
- **AND** 系统 MUST NOT 创建第五个 pane 或更深 split

#### Scenario: 拆分会产生不可用尺寸

- **WHEN** 目标容器尺寸不足以同时满足 source 与 target view 的最小宽高
- **THEN** split intent SHALL 被拒绝或回退为在合格 group 中打开 Tab
- **AND** 已有 pane ratio 与 view state SHALL 保持不变

### Requirement: Open routing SHALL use pane semantics instead of pointer focus

每个 view descriptor SHALL 声明 `PaneRole`、preferred region、reuse policy、singleton/duplicate policy 与 accepted target。`OpenView` SHALL 按显式 target、existing resource、preferred role、preferred region、bounded split、fallback group 的顺序解析，MUST NOT 仅因某 pane 最后获得 pointer focus 就把所有新视图打开到该 pane。

#### Scenario: Navigator 获得焦点后打开文件预览

- **WHEN** 用户在 locked Navigator 中单击文件，而当前 active group 是 Navigator
- **THEN** 文件 SHALL 在既有或新建的 `content` group 中打开
- **AND** Navigator singleton tab MUST NOT 被文件预览替换

#### Scenario: 分屏后继续打开同类预览

- **WHEN** layout 中同时存在 `navigator` 与 `content` group，用户依次打开文件 A 和 B
- **THEN** A 与 B SHALL 进入 `content` group 的 preview/pinned 生命周期
- **AND** B MUST NOT 因 Navigator 最近被点击而进入 `navigator` group

### Requirement: Tabs SHALL distinguish preview, pinned and dirty lifecycle

每个 pane group SHALL 最多保留一个 preview tab。单击资源 SHALL 复用 preview；双击、显式 Pin、编辑、dirty state 或 provider 声明不可替换 SHALL 将其转为 pinned。关闭 dirty tab MUST 由 view owner 返回 allow、confirm 或 deny，Pane Workbench MUST NOT 合成保存成功。

#### Scenario: 单击多个文件

- **WHEN** 用户单击文件 A 后再单击文件 B，且 A 仍为 clean preview
- **THEN** B SHALL 在同一 group 替换 A 的 preview instance
- **AND** group 中 SHALL NOT 因连续单击产生无界 Tab

#### Scenario: 编辑 preview 后打开另一个文件

- **WHEN** 文件 A 的 preview 产生 dirty state，随后用户单击文件 B
- **THEN** A SHALL 自动转为 pinned，B SHALL 成为新的 preview
- **AND** A 的 view state MUST 保留

### Requirement: Drag operations SHALL be atomic, constrained and reversible

Tab reorder、跨 group move、跨 region move 与 edge split SHALL 通过 typed layout intent 原子提交。拖拽 SHALL 在 movement threshold 后开始，Escape、pointer cancel、window blur、HMR 或 source unmount SHALL 取消 session 并恢复 source focus/scroll。无效 drop MUST NOT 先删除 source 再尝试插入 target。

#### Scenario: 跨 Right 和 Bottom 移动 Tab

- **WHEN** 用户把 Right region 的 Terminal Tab 拖到 Bottom group center
- **THEN** reducer SHALL 通过一个 `MoveView` intent 更新 source 与 target
- **AND** 任一验证失败时 Terminal SHALL 仍留在 source group

#### Scenario: 拖走最后一个 Tab

- **WHEN** 用户把未锁定 group 的最后一个 Tab 移到另一 group
- **THEN** reducer SHALL 移除空 group、合并父 split 并规范化 ratio
- **AND** locked empty group 或当前有效 drop target MAY 保留

### Requirement: Layout actions SHALL have keyboard and menu equivalents

Tab SHALL 实现 WAI-ARIA `tablist`、`tab` 与 `tabpanel` 语义，并支持 Arrow、Home、End、Enter/Space、Delete 与 Shift+F10。Move、split、close、pin、duplicate、region move、maximize、reset 等 pointer action MUST 在 context menu、command 或 keyboard move mode 中提供等价路径。

#### Scenario: 键盘用户把 Tab 移到右侧 split

- **WHEN** 用户通过 command 进入 keyboard move mode，选择目标 group 的 right zone 并按 Enter
- **THEN** 系统 SHALL 执行与 pointer edge drop 相同的 `SplitWithView` intent
- **AND** live region SHALL 宣布 source、target、zone 与完成结果

#### Scenario: 关闭当前 Tab

- **WHEN** focus 位于可关闭 Tab 且用户按 Delete
- **THEN** 系统 SHALL 关闭该 Tab，并把 focus 移到相邻 Tab 或合格恢复入口
- **AND** dirty/deny close policy SHALL 显示 owner-authored confirmation 或 reason

### Requirement: Responsive layout SHALL be a non-mutating projection

Pane Workbench SHALL 从同一 canonical `PaneWorkspaceV1` 生成 wide、compact 与 sheet projection。容器变窄 MUST NOT 把 Bottom Tab 迁移到 Right、重写 split tree 或改变 canonical region；只有显式用户 move intent 才能改变 canonical layout。

#### Scenario: 窄屏后恢复桌面

- **WHEN** 用户从 wide layout 缩窄到 sheet，再恢复到 wide
- **THEN** Right/Bottom region、group、Tab 与 split ratio SHALL 恢复到缩窄前 canonical 值
- **AND** 在 sheet 中切换当前 pane MUST NOT 改写其原 region

### Requirement: Resize SHALL preview at pointer cadence and commit once

Divider resize SHALL 在 pointerdown 同步禁用 transition，在 rAF 中更新临时视觉尺寸，并在 pointerup flush 最新坐标后提交一个 `ResizeSplit` intent。Store MUST NOT 在每个 pointermove 重建完整 workbench。Divider SHALL 支持 keyboard adjustment、reset 与 accessible value。

#### Scenario: 快速拖动 divider 后松手

- **WHEN** pointerup 时仍有未执行的 rAF resize frame
- **THEN** 系统 SHALL 先应用最新 pointer coordinate，再提交最终 ratio
- **AND** pane edge SHALL 不发生回弹或使用上一帧尺寸覆盖最终值

### Requirement: Heavy views SHALL activate only when visible and measured

View descriptor SHALL 声明 `keep-alive`、`snapshot` 或 `recreate` retention。Size-sensitive view MUST 在 projection 可见且容器连续两帧宽高大于零后 activation；隐藏、关闭、plugin unload 和 session switch SHALL 按 descriptor 与 resource budget suspend 或 dispose。

#### Scenario: Bottom region 首次展开 Terminal

- **WHEN** Bottom container 在展开动画开始时高度为零
- **THEN** Terminal provider MUST NOT 收到 activate/open 调用
- **AND** 容器稳定为非零尺寸后 SHALL 只 activate 一次

#### Scenario: 单个 view 渲染失败

- **WHEN** active view 在 render 或 activate 中抛错
- **THEN** 该 Tab SHALL 显示 Retry、Reload View、Close Tab 与 safe diagnostic
- **AND** TabBar、pane menu、其他 group 与 Reset Layout MUST 保持可用

### Requirement: Persistence SHALL store only safe presentation state

Pane Workbench SHALL 只持久化 schema version、region visibility/size、split ratio、group role/lock、view kind、safe resource ref、preview/pinned、active ids 与 provider-approved metadata。正文、terminal output、credential、raw prompt、provider payload、private arguments 与 absolute path MUST NOT 写入 layout storage。

#### Scenario: 恢复包含未知 view kind 的旧布局

- **WHEN** 当前 client 未注册旧布局中的 view kind
- **THEN** 系统 SHALL 将该 Tab 恢复为 orphaned placeholder 或安全丢弃不可解析 metadata
- **AND** 其他已知 group、Tab 与 ratio SHALL 继续恢复

#### Scenario: 布局违反硬上限

- **WHEN** persisted tree 包含循环、重复 id、无效 ratio 或超过四个可见 pane
- **THEN** normalize SHALL 修复已知安全字段或回退默认 preset
- **AND** MUST NOT 执行远端动作或删除领域数据
