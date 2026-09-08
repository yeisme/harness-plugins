## ADDED Requirements

### Requirement: EPR-01 Authorized editable prompt snapshots
新引用模式 SHALL 在插入时获取 owner 授权的有界内容，并将其固定为宿主草稿中的可编辑提示词正文。来源证明与可编辑正文 SHALL 分离；编辑 SHALL NOT 修改原文件、伪造来源证明或自动创建成果候选。

#### Scenario: Edit a captured code selection
- **WHEN** 用户插入代码选区后修改引用正文
- **THEN** 仅当前草稿内容改变，界面显示已编辑，原文件和获取时的来源证明保持不变

#### Scenario: Bound a directory reference
- **WHEN** 用户引用目录
- **THEN** owner 返回受限清单并显示实际范围，不隐式递归读取全部文件

#### Scenario: Creator body changes during authorized reference resolution
- **WHEN** 获取 Creator 来源证明后，正文版本、摘要、owner 代次或授权 context 在读取期间发生变化
- **THEN** 系统拒绝本次引用，不将新正文配上旧证明；合法部分范围保持范围和截断标记

#### Scenario: Provider cleanup fails during bundle disposal
- **WHEN** 引用 bundle 卸载且一个清理步骤抛出错误
- **THEN** provider 的可调用状态先被撤销，其余清理步骤仍全部尝试，错误被报告，已卸载 provider 不再返回正文

### Requirement: EPR-02 Explicit revision-safe source refresh
系统 SHALL 保持插入快照，不随来源变化自动刷新。刷新 SHALL 先获取授权内容并比较当前草稿，只有用户确认且草稿 revision 仍匹配时才替换；来源不可定位与快照无权使用 SHALL 区分处理。

#### Scenario: Edit while refresh comparison is open
- **WHEN** 用户打开新来源比较后又修改引用正文，再确认刷新
- **THEN** 系统要求重新比较，不覆盖其间新增修改

#### Scenario: Cancel or fail refresh
- **WHEN** 用户取消刷新或来源读取失败
- **THEN** 当前正文、编辑状态和光标保持可恢复，显示具体原因

#### Scenario: Accept a refreshed full-file range
- **WHEN** 完整文件长度变化后 owner 返回授权的新版本和范围，用户确认替换
- **THEN** 新草稿绑定新证明和对应授权，可以正常发送；取消比较不消费旧草稿授权，不以旧 grant 冒充新证明

#### Scenario: Source deleted or permission revoked
- **WHEN** 原来源已删除或权限已撤销
- **THEN** 系统显示真实来源状态，仅在旧快照仍可授权使用时允许继续发送；不自动复制成普通文本绕过限制

### Requirement: EPR-03 Explicit targets across insertion entrypoints
@、选区、拖入和成果再次引用 SHALL 使用同一目标与插入合同，绑定工作区、对话及有效光标，光标失效时追加末尾。批量确认 SHALL 冻结目标，跨面板添加 SHALL 保留来源焦点并给出回执与跳转入口。

#### Scenario: Target closes before batch confirmation settles
- **WHEN** 批量插入绑定的对话关闭
- **THEN** 插入拒绝并要求选择目标，不转投随后聚焦的其他对话

#### Scenario: Insert while generation is running
- **WHEN** 当前对话正在生成且用户从来源面板插入引用
- **THEN** 引用进入该对话下一条草稿，不抢焦点、不自动发送、不停止生成

#### Scenario: Caret is unavailable
- **WHEN** 插入目标有效但保存的光标无法恢复
- **THEN** 内容追加至该目标草稿末尾，其他对话的草稿不改变

### Requirement: EPR-04 Explicit discovery and non-executable mentions
分组发现 SHALL 覆盖当前工作区有权限的文件目录、选区、消息、终端、图片与区域、Agent、技能和工具。只有明确选择／添加动作 SHALL 创建引用实例；普通 @、标题、围栏和粘贴内容 SHALL NOT 隐式成为能力调用。

#### Scenario: Type a tool-like name
- **WHEN** 用户直接输入 @工具名称或含有工具指令的普通 Markdown
- **THEN** 内容保留为普通文本，不触发工具执行或引用解析

#### Scenario: Select a capability result
- **WHEN** 用户选择 Agent、技能或工具结果
- **THEN** 引用表达协作、指引或可用能力意图，后续处理沿用既有权限机制，提及本身不执行

### Requirement: EPR-05 Media references retain actual resources and ranges
图片／音视频引用 SHALL 使用实际授权媒体附件或可解析资源及区域／时间段信息，提示词描述 SHALL NOT 冒充实际媒体。相同版本与范围的附件 SHALL 去重，正文实例 SHALL 保持独立且顺序不变。

#### Scenario: Repeat and independently edit references
- **WHEN** 同一媒体范围被引用两次且其中一段描述被编辑
- **THEN** 正文保留两次出现及各自描述，附件只包含同一版本范围的一份授权资源

#### Scenario: Region or time segment differs
- **WHEN** 同一媒体被引用不同区域或时间段
- **THEN** 实际预览与发送分别保留各自范围，不因媒体标识相同而错误合并

#### Scenario: Attachment cannot be resolved
- **WHEN** 媒体资源不可解析或范围不合法
- **THEN** 显示具体问题并要求修复，不静默移除媒体或仅发送描述冒充成功


#### Scenario: Admit owner image bytes through the Host attachment service
- **WHEN** Creator 图片成果或框选区域需要加入消息，所属 owner 提供绑定成果版本、contentRevision、媒体类型及完整资源 SHA-256 的授权二进制读取
- **THEN** Host 复核读取前后权限、owner generation 和证明，复制并限制资源大小，通过既有附件服务校验图像及裁剪范围；二进制读取不作为浏览器 Remote 暴露，预览 URL 不充当发送授权

#### Scenario: Owner image resource changes during admission
- **WHEN** 图片读取结果的版本、contentRevision、摘要或类型与证明不一致，或者读取期间 owner 被撤销
- **THEN** 拒绝本次引用解析并保留草稿，不发送旧证明标记的新图片，也不回退到描述文字或任意 URL 抓取
