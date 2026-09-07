## ADDED Requirements

### Requirement: Workbench SHALL send Gateway credentials only to exact loopback targets

Workbench SHALL 使用解析后的 hostname/IP 精确判断 loopback，并拒绝 userinfo、query、fragment 与 redirect。

#### Scenario: Host uses a loopback-looking prefix

- **WHEN** endpoint 是 `localhost.example.com` 或 `127.0.0.1.example.com`
- **THEN** Workbench SHALL 在发送 Bearer 前拒绝请求

#### Scenario: Loopback endpoint redirects

- **WHEN** 已验证 endpoint 返回 redirect
- **THEN** Workbench SHALL 不跟随 redirect 且不得向新 host 发送 Bearer
