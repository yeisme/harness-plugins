## ADDED Requirements

### Requirement: 严格无结果 SHALL 提供有界本地相近结果
普通本地 query 的严格子串结果为空时，Pane 中心 SHALL 对相同授权范围和 filter 后的本地候选计算 NFKC、大小写不敏感的双字符片段覆盖率。查询长度 MUST 至少为两个字符，候选覆盖率 MUST 不低于三分之一，最多 SHALL 展示三条独立标记为“你可能在找”的结果。严格结果存在、`@conversation` query、仅其他 workspace 范围或远端搜索 loading 时 MUST NOT 展示该推荐。

#### Scenario: 用户输错 Explorer
- **WHEN** 用户输入与 Explorer 共享足够双字符片段但没有严格子串命中的拼写
- **THEN** Explorer 可出现在最多三条相近结果中，排序稳定且不会调用 conversation/workspace Host

#### Scenario: 筛选排除相似候选
- **WHEN** 一个相似窗格不满足当前 source、group、region、owner、kind、status 或 pinned filter
- **THEN** 该窗格不出现在相近结果，客户端不会为了补足三条而越过筛选或权限边界

### Requirement: 远端搜索 SHALL 展示有界且可恢复的状态
Conversation 与 workspace search SHALL 在请求期间显示本地化 loading 状态；Host 返回 partial 时 SHALL 保留结果并显示不完整提示；offline/search_failed 类 transient failure SHALL 提供显式 retry；permission_denied、contract_mismatch 和 capability unavailable SHALL 只显示稳定原因，不提供误导性 retry。状态展示 MUST NOT 回显 raw provider payload。

#### Scenario: 对话 Host 返回 partial
- **WHEN** 已显式启用对话搜索且 Host 返回 partial 页面
- **THEN** 当前结果保持可用并显示结果可能不完整的本地化提示，分页与 Abort 合同保持不变

#### Scenario: 权限拒绝与离线错误
- **WHEN** 一次搜索返回 permission_denied，另一次返回 offline
- **THEN** permission_denied 只显示原因，offline 显示同一 query 的重试动作，两者都不泄露 query、snippet 或 provider payload 到 evidence
