# dsh-pane-search-sources Specification

## Purpose
TBD - created by archiving change dsh-pane-management-center-v1. Update Purpose after archive.
## Requirements
### Requirement: 默认搜索 SHALL 只使用本地安全索引
Pane 中心默认 SHALL 搜索当前 workspace 的已注册 Pane、已打开 Tab、标题、状态、owner、region、自定义分组和关闭历史。空查询 SHALL 保持分组 picker；有查询时排序 SHALL 为 exact、active/open、pinned、recent、available、history。默认路径 MUST NOT 读取对话正文或发起远端搜索。

#### Scenario: 输入普通标题
- **WHEN** 用户输入一个已打开 Tab 的完整标题且未启用对话范围
- **THEN** 该活动/已打开 Tab 排在可用 Pane与历史之前，对话 Host 调用次数为零

### Requirement: 搜索 SHALL 提供明确范围与状态筛选
用户 SHALL 可按当前/其他 workspace、来源、系统/自定义分组、Right/Bottom、owner、类型、pinned、running、dirty、orphaned 和 history 筛选。默认边界 SHALL 为当前 workspace；扩展到其他 workspace MUST 经过显式筛选并继续执行权限判断。

#### Scenario: 切换到所有工作区
- **WHEN** 用户显式选择其他工作区范围
- **THEN** 结果标明 workspace，未授权 workspace 不返回结果且不会暴露标题或数量

### Requirement: 对话正文搜索 SHALL 显式启用并可取消
只有用户点击“包含对话内容”或输入 `@conversation` 时，Pane 中心 SHALL 调用可选 `PaneConversationSearchHostV1`。请求 MUST 携带安全 workspace/session refs、query、cursor 和 limit；每页默认 20、单次查询最多 100，输入变化或 dialog 关闭 MUST Abort 旧请求。

#### Scenario: 用户快速修改查询
- **WHEN** 对话搜索请求尚未完成且用户输入新字符
- **THEN** 旧请求被取消，只有最新 generation 的结果可进入 UI

### Requirement: 对话搜索 capability 缺失 SHALL 诚实降级
Host capability 缺失、permission denied、partial、offline 或 contract mismatch 时，对话范围入口 SHALL 可见但禁用或显示对应错误与重试条件；客户端 MUST NOT 回退到扫描 DOM、日志、缓存文件或私有会话存储。

#### Scenario: 发布版 Host 无 conversation search
- **WHEN** 用户打开 Pane 中心且 Host 未提供搜索 capability
- **THEN** 本地 Pane/Tab/历史搜索正常工作，“包含对话内容”显示不可用原因且无网络或文件扫描

### Requirement: 搜索结果 SHALL 是短暂且脱敏的
远端搜索结果 SHALL 只包含 owner-authored title、bounded snippet、opaque session/message ref、timestamp 和状态；结果 MUST NOT 写入 Pane persistence、关闭历史、日志、telemetry 或 integration evidence。异常文案 MUST 使用稳定 reason，不回显 provider payload。

#### Scenario: 集成测试记录搜索失败
- **WHEN** conversation Host 返回 permission denied
- **THEN** UI 显示本地化 reason，integration evidence 只记录失败类别和断言结果，不含 query、snippet 或 provider payload

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
