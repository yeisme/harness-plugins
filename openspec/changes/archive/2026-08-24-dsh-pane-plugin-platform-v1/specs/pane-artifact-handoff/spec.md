## ADDED Requirements

### Requirement: ArtifactRef SHALL 只包含安全版本化引用
`ArtifactRefV1` SHALL 包含 owner、kind、opaque ref、version、media type、安全 title/summary、evidence refs 与 capabilities。Validator MUST 拒绝 credential、raw prompt、provider payload、absolute path、arbitrary URL/function 与超过预算的正文。

#### Scenario: 文件 artifact 带绝对路径
- **WHEN** 插件提交包含 `/home/user/private/file.txt` 的 absolute path 字段
- **THEN** Validator SHALL 返回 typed unsafe-field error
- **AND** Registry SHALL NOT 将该 artifact 暴露给浏览器或 drag payload

### Requirement: ArtifactIntent SHALL 使用有限动作词汇
`ArtifactIntentV1` SHALL 只允许 open、compare、attach_context、transform、handoff、link，并包含 source artifact、目标 owner/pane、context revision 与 idempotency key。Pointer、keyboard、menu 与 command palette SHALL 产生相同 intent shape。

#### Scenario: 使用键盘把图片附加到笔记
- **WHEN** 用户通过命令执行 Eikona image → Pinax note handoff
- **THEN** SDK SHALL 生成与 drag 相同的 typed intent
- **AND** SHALL NOT 在客户端直接创建 Pinax relation

### Requirement: Target owner SHALL 重新 admission
SDK shape validation MUST NOT 被解释为 mutation authorization。目标 owner SHALL 重新检查 principal、context、source/target version、permission、cost、rights、idempotency 与 contract digest，并返回 preview、approval requirement、rejection 或 receipt。

#### Scenario: Target revision 漂移
- **WHEN** handoff preview 后目标 owner revision 已变化
- **THEN** owner SHALL 拒绝旧 intent 或要求 reconcile
- **AND** Client SHALL NOT 乐观显示 canonical relation 已创建

