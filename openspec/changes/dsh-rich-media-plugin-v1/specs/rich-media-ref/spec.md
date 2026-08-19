## ADDED Requirements

### Requirement: MediaRef SHALL 是安全投影而非文件句柄
`MediaRefV1` SHALL 至少包含 owner、kind、opaque ref、version、mediaType、有界 title/summary 与 capabilities。ref MUST 是 opaque storage identifier，不得包含 raw filesystem path、凭据、bearer URL、provider payload 或无界正文。

#### Scenario: 浏览器收到媒体引用
- **WHEN** Host 向浏览器传递一个视频 MediaRefV1
- **THEN** ref SHALL 是不可解析为本地路径的 opaque id
- **AND** 浏览器 SHALL 只能通过 Host 授权的短时 URL 或 typed reader 获取媒体字节

### Requirement: MediaRef 校验 SHALL fail closed
`validateMediaRefV1` SHALL 拒绝非法 kind、unknown capability、含路径分隔符的 ref、控制字符、超长 title/summary、非正 width/height 或非负 size/duration。unknown required 字段 MUST fail closed；optional 字段缺失 MAY 降级。

#### Scenario: 插件传入危险 ref
- **WHEN** 媒体插件提交 `ref: '/home/user/secret.png'`
- **THEN** 校验 SHALL 返回 typed failure
- **AND** 客户端 SHALL NOT 使用该 ref 构造 URL

### Requirement: MediaCapability SHALL 限定已知集合
`MediaCapability` SHALL 限定为 `play`、`download`、`extract_text`、`open`、`preview`。插件不得声明任意能力字符串；未知能力 MUST 被拒绝。

#### Scenario: 插件声明可执行能力
- **WHEN** 插件在 capabilities 中声明 `execute`
- **THEN** 校验 SHALL 拒绝该 MediaRef
- **AND** 平台 SHALL NOT 在客户端暴露该能力对应的动作
