## ADDED Requirements

### Requirement: Drama 视图必须注册进 Pane Workbench runtime
AI Drama Director client MUST 通过 Pane Workbench 的 `registerView()` 注册 Context/Story/Visual/Audio/Run/Review 六个视图，注册 effect-scoped 且 dispose 精确；client MUST NOT 等待或假设官方 pane registry seam，也 MUST NOT 自建独立 shell/侧栏。

#### Scenario: Tier 0 下注册并打开视图
- **WHEN** Pane Workbench 以 overlay 宿主运行，drama client `apply()` 完成
- **THEN** 六个视图出现在 Quick Pick 与视图注册表中，打开任意视图在唯一 region 生成 tab

#### Scenario: 卸载 bundle
- **WHEN** drama bundle 被禁用或 HMR 替换
- **THEN** 六个视图注册被精确撤销，已打开的 drama tab 进入 orphaned 态而非崩溃

### Requirement: Drama capability probe 必须是真实组合探测
`probeDramaCapability` MUST 组合探测 Pane Workbench 注入面、Creator Studio projection transport 与 drama host transport 的真实可用性，MUST NOT 硬编码布尔结果；缺失的每个依赖 MUST 映射到具体视图/命令的禁用与标准 reason。

#### Scenario: Creator Studio projection 缺失
- **WHEN** host 侧 creator-studio projection capability 不存在
- **THEN** 依赖该投影的 Review/Run 视图禁用并写明原因，Context 视图与命令帮助仍可用

#### Scenario: 全部依赖就绪
- **WHEN** 三类依赖均 probe 成功
- **THEN** 命令组与全部视图启用，且发出一条脱敏的 capability-ready 证据事件

### Requirement: /drama 命令面必须经 command-experience `/` 目录贡献并可增强 probe
/drama 命令组（new/open/plan/generate/review/repair/evidence/handoff）MUST 以 `PaneCommandDescriptor` 形式贡献进 command-experience 的 live `/` 目录：标记 `presentation.launcher: true`，携带可选 `slash` 短名（`name` 匹配 `^[a-z][a-z0-9-]{1,31}$`、`aliases` ≤4、`hint` ≤80、`category` 为 work）；保留名冲突 MUST 按 pane-protocol 合同保持禁用。上游 command-experience seam（如 router 投影）MUST 只作为增强 probe，不作为注册前置条件。command-experience 面整体缺失时命令组禁用并给出标准 reason，且 MUST NOT 影响 pane 内已注册视图的可用性。

#### Scenario: 经 slash 目录注册
- **WHEN** command-experience 目录可用，drama client 贡献带 `slash.name: 'drama'` 的命令描述符
- **THEN** `/drama` 出现在 `/` 目录并带 typed selector，帮助与错误合同与命令组定义一致；卸载 bundle 后条目立即消失

#### Scenario: 保留名冲突
- **WHEN** 贡献的 slash 短名撞上保留 P0 名或已被占用
- **THEN** 冲突条目保持禁用并给出原因，其余命令不受影响

#### Scenario: command-experience 面缺失
- **WHEN** 当前 profile 未安装 command-experience
- **THEN** /drama 命令组禁用并附标准 reason，用户仍可通过 pane 内操作完成 review 流程

### Requirement: Director preset 必须经 preset service 应用并定义 Tier 0 塌缩语义
默认 Director preset（Context/Review/Run 默认可见，Story/Visual/Audio 按需）MUST 通过 Pane Workbench preset service 应用；Tier 0 下 preset MUST 塌缩为唯一 region 内的有序 tab 集，可见 tab 默认 ≤4，secondary 视图保持按需打开，MUST NOT 伪造多 region 布局。

#### Scenario: Tier 1 应用 preset
- **WHEN** seam 齐备的 Tier 1 环境用户执行 /drama open
- **THEN** Context/Review/Run 按 preset 分布到声明的 region/group，布局经原子提交完成

#### Scenario: Tier 0 应用 preset
- **WHEN** Tier 0 overlay 环境用户执行 /drama open
- **THEN** 三个默认视图成为单 region 的前三个 tab，active 落在 Context，不渲染任何 region 分隔

### Requirement: DramaContextV1 必须经 host transport 真实解析
Client MUST 经 drama host transport 解析 DramaContextV1（workspace/project/show/episode refs、owner versions、contextRevision、freshness），并在切换上下文时走 reconcile；unknown/partial/stale 状态 MUST 禁用 mutation 并要求 owner reconcile，MUST NOT 自动重试或本地编造。

#### Scenario: 上下文解析成功
- **WHEN** 用户打开一个剧且 host 返回完整 DramaContextV1
- **THEN** 视图头部展示有界摘要与 freshness，review/generate 等动作按 admission 启用

#### Scenario: 上下文 partial
- **WHEN** host 返回 partial（某 owner 段缺失）
- **THEN** 依赖缺失段的动作禁用并写明原因，mutation 全部禁用，不发起自动重试

### Requirement: 证据事件必须真实接线且脱敏
Client MUST 把命令发现、首次打开、review 完成、handoff 结果类别与 context 恢复时长接入既有证据管道；事件 MUST 只含类别与时长，MUST NOT 含 URL、token、文件路径、raw prompt、provider payload 或私有工具参数。

#### Scenario: 完成一次 review
- **WHEN** 用户完成一项 review
- **THEN** 证据管道收到 `review_completed` 类别事件，payload 无标识符与内容字段

### Requirement: 注册与 dispose 必须幂等
Client 的 `apply()`/disposer MUST 幂等：重复 apply 不产生重复注册，dispose 后再次 apply 能干净重建；命令、视图、preset 与键盘监听 MUST 全部 effect-scoped。

#### Scenario: HMR 重载
- **WHEN** 开发态 client 模块被 HMR 替换两次
- **THEN** 注册表中始终只有一份 drama 视图与命令注册，无泄漏的键盘监听

### Requirement: 键盘快捷键必须经共享 keymap 面注册
Drama 相关键盘快捷键 MUST 经 command-experience 共享 keymap 面（`CommandKeymapConfig`/`resolveKeymap`）声明与解析，MUST NOT 裸挂 window/document 级 keydown 监听；快捷键冲突 MUST 按 keymap 面优先级解析并可见。

#### Scenario: dispose 后无残留监听
- **WHEN** drama bundle 被禁用或 HMR 替换
- **THEN** 其快捷键从 keymap 面精确注销，全局监听计数不增加

#### Scenario: 快捷键冲突
- **WHEN** drama 声明的组合键与既有 keymap 绑定冲突
- **THEN** 冲突项按 keymap 面规则降级并展示原因，不产生双触发

### Requirement: Director preset 必须处理 settings owner receipt
Preset 的创建/更新/删除/重置 MUST 经 `PaneWorkspacePresetServiceV1` 并处理 `ok`/`rejected`/`permission_denied` receipt；持久化被拒 MUST NOT 阻断当前会话内的布局应用（布局应用是本地原子提交），但 MUST 禁用对应写操作并展示标准 reason。

#### Scenario: settings owner 拒绝保存
- **WHEN** 用户保存自定义 Director preset 变体且 owner 返回 `permission_denied`
- **THEN** 当前布局保持已应用状态，保存入口禁用并展示 owner 原因，不产生部分写入

#### Scenario: preset 应用失败回滚
- **WHEN** preset draft 校验失败或 apply 被拒绝
- **THEN** 现有布局保持不变，用户看到校验失败原因
