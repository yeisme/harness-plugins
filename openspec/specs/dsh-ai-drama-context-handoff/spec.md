# dsh-ai-drama-context-handoff Specification

## Purpose
Define version-fenced Drama context synchronization and safe, signed Workbench handoff payloads.
## Requirements
### Requirement: Drama context 必须版本化并在切换时重新同步

DramaContextV1 SHALL 包含 workspace/project/show/episode refs、可选 scene/shot refs、owner versions、contextRevision 和 freshness。context 切换、revision 漂移或 event gap SHALL 暂停 mutation并重新读取 snapshot。

#### Scenario: 用户切换 Episode

- **WHEN** current episode ref 或 contextRevision 变化
- **THEN** 插件 SHALL teardown 旧 subscription、清空 presentation cache 并读取新 snapshot
- **AND** 旧 descriptor SHALL 失效

### Requirement: Workbench handoff 只能携带安全 refs 和 presentation intent

Open in Workbench SHALL 只携带版本化 context/artifact/receipt refs、target surface、presentation intent、expiry 和 nonce。session token、domain payload、credential、private URL、raw prompt 和 provider payload MUST NOT 进入 handoff。

#### Scenario: Workbench 接收有效 handoff

- **WHEN** Workbench 验证 nonce、expiry、surface 和 context refs
- **THEN** Workbench SHALL 重新从 owner 获取 projection
- **AND** SHALL NOT 信任 DSH cached facts
