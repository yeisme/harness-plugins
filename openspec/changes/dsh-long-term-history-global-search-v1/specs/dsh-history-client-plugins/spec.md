## ADDED Requirements

### Requirement: Web 提供独立全局历史入口
Web SHALL 保留侧栏快速搜索，并 SHALL 通过命令面板、`Cmd/Ctrl+G` 和 `/history` 打开同一个 global history dialog；`/resume` SHALL 打开 recent history/session picker，且这些命令不得创建 model turn。

#### Scenario: 从截图所示命令面板进入
- **WHEN** 用户打开通用 command menu 并选择 `Search history`
- **THEN** Web 打开全局历史 dialog，搜索 title、labels 与 past sessions，而不是把命令文字提交给模型

#### Scenario: 侧栏与全局搜索分工
- **WHEN** 用户在侧栏输入 query
- **THEN** 侧栏保持当前快速导航语义；只有 global dialog 提供 archived、filters、cursor 与 event deep link

### Requirement: Web 结果状态完整且可访问
Web SHALL 展示 title、labels、workspace、updated time、archived 状态、match kind、snippet 与 index state；键盘、pointer 与 assistive technology SHALL 能完成等价搜索、分页、恢复和关闭操作。

#### Scenario: 键盘打开历史命中
- **WHEN** 用户在结果列表中通过方向键选择一项并按 Enter
- **THEN** Web 执行 owner-authored resume/open action，成功后恢复 focus 并定位命中，失败时 dialog 保留 query 与 error

#### Scenario: 搜索离线
- **WHEN** connection 断开或 history capability disabled
- **THEN** dialog 显示 offline/disabled 原因和可执行诊断动作，不清空 query、不显示空结果伪装成功

### Requirement: Web 与 CLI 使用同一结果与 receipt 语义
Web 与 CLI SHALL 消费同一 `history.*` request/result、cursor、anchor、index state 与 mutation receipt；客户端 SHALL NOT 重排结果或乐观认定 label/archive/resume 成功。

#### Scenario: 两个入口观察标签修改
- **WHEN** Web 修改标签并收到 owner receipt，同时 CLI 读取同一 Session
- **THEN** 两端最终投影相同 revision 与 labels，CLI 不需要读取 Web local state

#### Scenario: 归档 response 丢失
- **WHEN** archive action 已发送但客户端在 receipt 前断线
- **THEN** 客户端显示 unknown/reconcile，重连后从 owner snapshot 确定状态，不自动重试或宣称成功

### Requirement: CLI 输出来自统一命令投影
CLI SHALL 提供 `dsh history search|show|tag|archive|unarchive|reindex|doctor`，并 SHALL 从一个 command projection 生成 human summary、`--agent`、`--json` 与长操作 `--events` 输出。

#### Scenario: JSON 搜索
- **WHEN** 用户运行 `dsh history search "oauth callback" --json`
- **THEN** stdout 只包含一个有效 JSON envelope，结果位于 `data`，日志/进度写入 stderr 或被抑制

#### Scenario: Agent 搜索
- **WHEN** 用户运行 `dsh history show <session-id> --agent`
- **THEN** stdout 包含稳定的 `spec_version`、`mode=agent`、`command`、`status` 与有界 fact/action/evidence keys，不包含 ANSI 或本地化段落

#### Scenario: Reindex event stream
- **WHEN** 用户运行 `dsh history reindex --events`
- **THEN** stdout 是按 seq 排序的 start/progress/end 或 error NDJSON，取消/失败返回非零退出码且不泄露正文或绝对路径

### Requirement: 客户端插件具有确定性故障降级
Web history plugin SHALL 处理 loading、ready、loading-more、opening-session、offline、disabled、reconcile-required、partial 与 error 状态，并 SHALL 在 renderer/plugin failure 时保留 generic fallback 和 owner facts。

#### Scenario: Web stale cursor
- **WHEN** Web 加载下一页收到 `HISTORY_CURSOR_STALE`
- **THEN** dialog 保留 query/filter，清除旧列表并从第一页重新请求，不拼接不同 generation 结果
