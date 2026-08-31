## ADDED Requirements

### Requirement: Host SHALL load Team snapshot before events
Harness Host SHALL 在每个 tenant/workspace/principal/runtime generation 下先向 Ordo owner adapter加载 authoritative snapshot，再订阅与 snapshot stream/cursor 匹配的 events。Client MUST 不在 snapshot 前应用 delta。

#### Scenario: Hub opens after HMR
- **WHEN** client generation 更换或插件 HMR reload
- **THEN** Host SHALL dispose旧 subscription/cache/pending actions，绑定新 context并从新 snapshot开始

### Requirement: Host SHALL enforce cursor and context continuity
Host SHALL 检查 stream ref、next seq、context revision、installation/plugin digest、policy revision 与 runtime generation。duplicate event MAY 忽略；gap、expired cursor、context drift 或 schema mismatch SHALL 停止 delta、禁用 mutation并重新 snapshot。

#### Scenario: Event arrives for another workspace
- **WHEN** subscription 收到 workspace/context 不匹配的 event
- **THEN** Host MUST 丢弃 event、不得转发浏览器，并 SHALL 触发 typed context-drift/reload path

### Requirement: Host SHALL proxy actions without exposing credentials
Browser action SHALL 发送 safe action input 给 Host；Host SHALL 重新检查 context、surface control、permission、preview/approval、target revision、idempotency 与 installation policy，再调用 Ordo adapter。broker credential、CLI environment 与 raw owner payload MUST 不进入 browser。

#### Scenario: Browser replays an expired preview
- **WHEN** Client 提交 expired preview ref
- **THEN** Host/Ordo SHALL fail closed并返回 re-preview action，Client MUST 不自动重试 effect

### Requirement: Host SHALL close every Team collaboration lifecycle
plugin unload、view dispose、tenant/workspace/principal switch、runtime generation change、HMR 和 network/disconnect SHALL 清理 event streams、timers、backoff、pending requests、callbacks 与 safe caches。replacement generation MUST 从 snapshot开始。

#### Scenario: Workspace identity changes
- **WHEN** DSH Host 切换 workspace
- **THEN** 旧 Delivery selection、cursor、Room draft refs、pending dialogs 与 cached actions MUST 清除，任何晚到 result MUST 被 generation fence 丢弃

