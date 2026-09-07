## ADDED Requirements

### Requirement: frontend-static MAY enable historyFallback without taking the webserver fallback seat
Vendored `frontend-static` SHALL 增加配置开关 `historyFallback`，默认关闭。开启后，该插件继续占用既有唯一 fallback 席位，MUST NOT 再注册第二条 webserver fallback。Yeisme web profile 可通过 `cordis.patch.yml` 打开开关；未打补丁的上游 bundle SHALL 保持今日语义。

#### Scenario: Default remains locked
- **WHEN** `historyFallback` 未设置或为 false
- **THEN** 对不存在且非 index 的路径 SHALL 继续返回空 404
- **AND** 既有 405/403 语义 SHALL 不变

#### Scenario: Profile enables the switch
- **WHEN** Yeisme web profile patch 将 `historyFallback` 设为 true
- **THEN** 符合判定矩阵的 GET/HEAD SHALL 返回渲染后的 index
- **AND** MUST NOT 修改 named-route 注册表席位数量

### Requirement: historyFallback SHALL serve SPA index only for navigable HTML routes
当 `historyFallback` 为 true，请求满足全部条件时 SHALL 走既有 `renderIndex` + `tapIndex` 管线：方法为 GET 或 HEAD；目标不是现有静态文件；路径无文件扩展名，或 `Accept` 含 `text/html`。

#### Scenario: Deep-link GET without extension
- **WHEN** GET `/s/abc123` 且该路径不是现有文件，`historyFallback` 为 true
- **THEN** 响应 SHALL 为渲染后的 index
- **AND** 状态 SHALL 为成功 HTML 文档而非空 404

#### Scenario: HEAD matches GET
- **WHEN** HEAD `/s/abc123` 满足同一判定
- **THEN** 响应 SHALL 与 GET 使用同一 index 管线
- **AND** MUST NOT 写入会话或执行副作用

#### Scenario: Accept HTML with extensionless path
- **WHEN** GET `/s/abc123` 的 `Accept` 含 `text/html`
- **THEN** 即使实现同时检查 Accept，结果 SHALL 仍为 index

### Requirement: Non-navigation requests SHALL keep locked static semantics
`historyFallback` MUST NOT 放宽下列锁定语义：非 GET/HEAD → 405；越界路径 → 403；带扩展名且不是现有文件的目标 → 原 404/octet-stream 行为。

#### Scenario: POST is still 405
- **WHEN** POST `/s/abc123`
- **THEN** 响应 SHALL 为 405
- **AND** MUST NOT 返回 index

#### Scenario: Path traversal is still 403
- **WHEN** 请求试图读出 dist root 之外
- **THEN** 响应 SHALL 为 403
- **AND** MUST NOT 返回 index

#### Scenario: Missing file with extension stays 404
- **WHEN** GET `/s/missing.js` 或其它带扩展名的不存在路径
- **THEN** 响应 SHALL 保持原 404/octet-stream 语义
- **AND** MUST NOT 返回 SPA index

### Requirement: Upstream change SHALL live in staging patch until merged
本仓库 MUST 在 `upstream-prs/frontend-static-history-fallback/` 保存 `changes.patch`、`new-files/`、`apply.sh` 与 README。插件完成门是判定矩阵与 apply-check，MUST NOT 把官方合入写成 SHALL。

#### Scenario: Clean checkout apply
- **WHEN** 对干净上游 checkout 执行 `apply.sh`
- **THEN** patch 与新文件 SHALL 幂等应用
- **AND** 第二次执行 SHALL 拒绝重复写入或明确 no-op

#### Scenario: Plugin ships before upstream merge
- **WHEN** 上游尚未合入 historyFallback
- **THEN** 本仓库仍可用 staging/profile patch 打开开关
- **AND** 未打补丁的纯上游 profile SHALL 继续依赖 `?s=` 别名
