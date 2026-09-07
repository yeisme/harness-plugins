## ADDED Requirements

### Requirement: PCP-01 Compact reference blocks in the existing composer
系统 SHALL 复用宿主唯一输入框。引用默认 SHALL 显示来源标题及约三行内容，媒体显示缩略图或时间段；SHALL 提供展开、折叠、编辑、查看来源、刷新及移除。目标信息 SHALL 在当前上下文只显示一次。

#### Scenario: Collapse multiple long references
- **WHEN** 用户统一折叠多条长引用
- **THEN** 实例位置与发送顺序不变，输入区保持可写，操作栏可访问，完整名称仍可查询

#### Scenario: Host already identifies the conversation
- **WHEN** 宿主当前输入区已经明确显示目标会话
- **THEN** 插件复用该信息及切换能力，不再增加重复 Target 行

### Requirement: PCP-02 Lossless inline source editing
引用编辑 SHALL 在原位置使用同一草稿与宿主编辑器事务，显示、源码和展开输入视图往返 SHALL 保留正文字符、空白、围栏、光标及撤销重做状态。自由输入的 HTML SHALL 使用受控展示，不能在宿主执行。

#### Scenario: Roundtrip complex Markdown
- **WHEN** 用户多次切换包含嵌套围栏、中文、空行和代码的引用视图与源码
- **THEN** 未编辑的正文保持逐字符一致，编辑可撤销且不创建重复引用

#### Scenario: Compose Chinese text and leave source view
- **WHEN** 用户使用中文输入法编辑源码并完成编辑
- **THEN** 合成期间 Enter 不触发发送或候选误选，完成后显示修改内容；Escape 退出视图不隐式丢弃已输入内容

#### Scenario: Delete and undo a reference
- **WHEN** 用户通过键盘或移除动作删除引用并撤销
- **THEN** 引用正文、媒体范围、实例位置及编辑状态恢复

### Requirement: PCP-03 Preview and submission share one projection
发送预览与实际提交 SHALL 使用相同草稿 revision 的提示词投影及实际附件解析。预览 SHALL 按需打开，并显示用户正文、引用展开内容、媒体范围及能力说明，不暴露隐藏系统提示词。内容超限或无效 SHALL 明确提示，不能静默截断或删除。

#### Scenario: Draft changes after preview
- **WHEN** 预览打开后用户修改引用或正文
- **THEN** 预览更新至新 revision，发送使用对应内容，不提交与可见预览不同的旧快照

#### Scenario: Projection exceeds supported limits
- **WHEN** 引用展开内容超过发送限制
- **THEN** 系统定位超限内容并提供缩小范围动作，不显示完整内容却发送截断文本

### Requirement: PCP-04 Revision-aware acknowledgement and immutable history
提交 SHALL 冻结正文、实例 revision、附件和请求身份。确认 SHALL 仅消费本次已提交且未被随后修改的草稿范围；失败或未知结果 SHALL 保留草稿。历史 SHALL 使用实际发送快照。

#### Scenario: Edit an existing reference during submission
- **WHEN** 请求等待确认期间用户改写同一引用并追加文字
- **THEN** 确认不清除改写内容或新增文字，历史只显示冻结提交的旧内容

#### Scenario: Send the retained edited occurrence again
- **WHEN** 第一次提交确认后用户发送期间改写的引用仍在草稿，且用户发起下一次发送
- **THEN** 系统保留其编辑正文并按当前来源权限完成必要授权更新，不因首次授权被消费而永久锁死该草稿，不绕过权限或自动重发第一次请求

#### Scenario: Duplicate click or unknown settlement
- **WHEN** 用户重复点击发送或提交结果未知
- **THEN** 相同提交保持同一请求身份等待对账，不自动重发或更换发送路径

#### Scenario: Known submission failure
- **WHEN** 提交返回确定失败
- **THEN** 保留正文、引用和附件，并显示原因及合法恢复入口

### Requirement: PCP-05 Additive capability negotiation and V1 preservation
可编辑提示词引用 SHALL 通过新增能力协商启用，显式声明正文投影语义；既有 V1 结构化引用 SHALL 保持原合同，不因发送失败或新 seam 缺失而静默转换。禁用新能力时 SHALL 保留新草稿与历史的可恢复性。

#### Scenario: Host lacks editable prompt capability
- **WHEN** 宿主仅提供既有 V1 输入接口
- **THEN** V1 和普通文本保持原行为，新模式显示不可用原因，不以 DOM 注入伪造支持

#### Scenario: Roll back after creating a new-mode draft
- **WHEN** 新能力被关闭而已有新模式草稿
- **THEN** 草稿不被丢弃或自动改解释，旧客户端明确提示兼容限制，历史仍读取冻结投影

### Requirement: PCP-06 Unified responsive and accessible interaction
引用、输入框、搜索与预览 SHALL 使用 Host 主题、统一 token 和原子组件，覆盖 loading、empty、error、stale、partial、disabled 和 unknown 状态。窄屏 SHALL 重排而不删除能力；所有主要动作 SHALL 支持键盘、触屏及 reduced motion。

#### Scenario: Narrow screen and long labels
- **WHEN** 容器为 360／560px 或开启 200% zoom 且引用名称很长
- **THEN** 主操作不被裁切，详情可切换查看，关闭预览后焦点返回触发项

#### Scenario: Theme and input modality change
- **WHEN** 用户切换浅色、深色、跟随系统或启用减少动画偏好
- **THEN** 自有引用与预览表面同步，状态含文字说明，唯一动作不依赖悬停，键盘焦点可见
