# 会话工具工作区设计

## 1. 已确认决策与实施边界

workspace_mode=current-checkout。当前无子 Agent 授权，实施与验证由主线程执行。插件内容 owner 为 ui-mcp-inspector、dsh-tool-hub、dsh-mcp-inspector bundle；Pane 注册/命令对接涉及 ui-pane-workbench 和 dsh-command-experience。宿主标题、标签与导航修改在兼容 staging 内完成，按已有补丁链导出独立 upstream-prs 增量。已有搜索相关脏改动须保留，不为清理全仓检查而修改无关逻辑。

| 用户能力 | 归属 | 决策 / 验收 |
|---|---|---|
| 会话工具 Tab | conversation.view + Tools client | 每个会话独立，默认活动；可用工具次级入口 |
| 固定工具旁栏 | workspace owner + 相同 Tools 内容 | 每会话一个固定工具 Pane，跨会话可以同时打开 |
| Pane 标题管理会话 | ui-layout + sessions owner | 会话标签组、搜索、切换、固定、重新打开对话 |
| 调用诊断 | 会话日志 owner 的安全投影 | 只读脱敏详情和原消息定位；不执行重试 |
| 目录恢复 | toolHub + sessionToolCatalog | 真实空、部分、缺失、失败与恢复可辨认 |
| 全局管理 | toolHub + 已有安装/配置 owner | 全局启停继续 CAS；安装、连接和配置复用 owner 入口 |
| 正式验证 | harness-plugins 测试工具链 | Tools 全功能；全部已发现 bundle 加载和入口冒烟 |

## 2. 现状证据与待验证根因

- ToolsPane 在 pane.tsx 订阅 sessions.list.current；注册 descriptor 为 singleton:true。现有 PaneReference 已有 sessionId，不能把全局 current 当作持久绑定。
- 会话 chat 与 lifecycle snapshot 分离；继续使用公开 chat 目标及兼容投影，不再次假设 snapshot.nodes 是数组。
- 宿主已有 referenceTools.list({sessionId})，可读取对应 live/standing session scope 的工具。全局 toolHub.list() 不带 sessionId，不能代表该会话实际可用工具。
- resolveToolHubRemote 首次失败可返回 undefined，ToolsPaneSession 仅随 ctx 变化重新尝试；界面 canRefresh 又依赖 controller 存在。该路径存在不能恢复的缺口，但具体现场故障仍需复现，不能把静态分析写成已定位全部根因。
- 活动目前最多返回最近 200 条；计数可能覆盖更大数据集。列表没有调用详情定位，工具“详情”当前主要属于目录项。

## 3. 会话绑定、标题与存储

会话 Tools Tab 沿用 mcp-inspector 视图标识，sessionId 从会话作用域 owner props 获取，禁止内部订阅全局 current。固定旁栏由显式打开意图携带 sessionId；沿用 mcp-inspector pane kind，以 sessionId 区分实例，取消全局单例约束。对同一会话重复固定只聚焦已有工具 Pane，不新建副本。

标题以“会话名称 · 工具”显示工具旁栏，tooltip 补充项目与可区分的短会话标识；名称变化从 session owner 更新。对话 Pane 内使用会话标签组：菜单可搜索已有会话、聚焦/打开标签、固定当前预览、重新打开绑定会话。选择已打开会话聚焦其既有对话实例，不复制相同 conversation。会话删除/归档/批量生命周期管理不加入标题菜单。

“固定标签”仍是保留标签，不重新定义为“跟随焦点”。工具旁栏始终显式绑定，无跟随模式。切换或关闭 A 的对话标签不影响 A 的工具旁栏；A 删除或不可访问时保留标题并显示不可用，可选择其他会话或关闭旁栏，不回退到 B。工具旁栏标题显式切换 A→B 时仅更换该旁栏绑定，不重写 A/B 对话；B 已有工具旁栏时聚焦已有实例并关闭被替代的旧实例，保持每会话一份。

持久状态只扩展现有 workspace layout/reference，保存 sessionId 与标签固定状态；序列化与恢复都必须保留绑定。搜索、筛选、滚动与选中记录是按 sessionId 隔离的展示状态；Tab 与旁栏复用会话级 controller 并同步筛选/选择，不复制日志。一个视图关闭后只释放自己的引用，最后一个视图释放订阅；重新打开可恢复会话展示状态，失效选择清除。跨刷新至少恢复绑定和固定标签，不新增调用日志存储。

旧 mcp-inspector Pane 无 sessionId 时显示一次明确的会话选择入口，不静默绑定全局 current。保留旧命令/view kind 作为兼容入口，不同时渲染旧壳与新壳。

## 4. 目录与公开接口

- 会话可用工具读取现有 referenceTools.list({sessionId})；Skills 读取现有会话 scope 的安全能力目录，不能从 private arguments 推断身份。若宿主尚缺会话 Skills 安全投影，增加最小 session-addressed 查询 seam，只返回公开名称、描述、来源、可用性和缺失原因；无能力时必须标 partial。
- toolHub.list()/setEnabled 的签名、specVersion:1.0 和 generation CAS 保持兼容，全局启停只放全局管理入口；会话页显示生效状态与“管理全局工具”链接，不假装会话级开关。工具启用不等于已连接，更不等于任意会话可调用。
- 插件内部增加显式 openSessionTools({sessionId,presentation:'tab'|'pane'}) 打开意图。/mcp 在调用时解析来源会话一次并打开其 Tools Tab；全局无会话来源则进入全局管理或明确会话选择，不猜测绑定。
- 调用定位以 sessionId + owner 的 opaque message/call ref 为身份。复用会话 viewRequest/openView 聚焦合同；若 Chat 尚未消费对应焦点 identity，宿主补丁添加定位适配，不扫描整页 DOM 或用工具名/时间猜记录。
- 错误详情只采用 owner-authored 安全摘要：调用身份、来源、状态、时间、耗时、错误码/脱敏摘要及可定位引用。现有响应可以新增 optional 字段；不得把 arguments、原始 result、凭据、路径或 provider payload 直接转发给浏览器。摘要不可用时显示原因并保留原消息定位。

目录连接状态统一为 connecting/ready/partial/unavailable/error；仅在权威查询成功且覆盖完整时显示“完整”，成功且确实无项才显示空目录。不同 provider 的失败按来源展示，已取得的条目继续可见。重探测动作即使 controller 尚未创建也可用：重新解析/挂载 remote，再查询；并发刷新合并，旧请求在会话切换/卸载后不得覆盖新结果。监听服务晚到与重连，HMR 对称释放所有注册和订阅。历史缓存只显示带 stale 标记的最后成功结果，不冒充新鲜成功。

全局目录不能因根 scope 没有工具就声称所有会话无工具。读取已有 authoritative inventory，缺少可枚举 owner 时明确覆盖不完整；不能用调用历史合成“可用工具目录”。

## 5. UI Contract

- Surface classification: adopted（Tools 内容）；宿主标题 excluded。
- Surface kind: inspector；archetype: Diagnostics inspector。
- First / second / third visual priority: 当前会话与失败/运行中调用、调用列表与选择详情、可用工具和全局管理入口。
- Existing components reused: Surface、SurfaceContextBar、宿主 Button/Input/Menu/Dialog、conversation tabs 与 pane headers。
- Cards that earn existence: 无普通统计卡；全局 mutation 的原生确认弹窗仅在有影响时出现。
- Primary scroll owner: 主列表；宽布局详情有独立有界滚动，禁止再套整页滚动和固定 560px 容器。

首屏只保留一条紧凑工具栏，显示必要统计与状态；删除重复“工具/本会话调用”大标题、厚卡片套卡片、重复计数和常驻“详情”一级页签。默认活动列表，运行中单独置顶分区，完成记录按时间倒序；失败以文字和颜色突出，一键筛选失败。保留列表/时间线能力，次级切换不与主导航争夺视觉优先级。目录失败只在活动页显示紧凑提示，不挤掉调用记录。

选中活动行后显示调用详情；选中目录行后显示工具详情，两个选择类型明确区分。没有选择不显示巨大空详情卡。显示“最近 200 条 / 已知总数”的真实边界，提供会话原记录定位；本轮不新增独立全历史存储或假分页。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 会话目录 | 行内加载 | 权威成功后显示无可用能力 | 原因与可用重探测 | 按会话作用域显示 | 来源级说明与旧快照标记 | 权限/能力缺失明确说明 |
| 活动 | 保留旧记录并标加载 | 尚无调用 | 源不可用但不清空目录 | 列表/时间线与失败筛选 | 最近200条边界 | 不提供重试执行 |
| 调用详情 | 保留行选择 | 无选择不占位 | 无安全摘要时明确提示 | 脱敏详情及原消息定位 | 原记录失效后禁用定位 | 引用不可用说明原因 |
| 会话旁栏 | 标题保留绑定 | 旧布局要求选择会话 | 删除/不可访问显示原绑定 | 固定A不会跟随B | 重连后恢复A | 不隐式改绑定 |
| 全局启停 | 单行 pending | 无对象禁用 | CAS/存储失败保留旧状态 | owner 确认后更新 | 冲突重新读取 | 不支持开关的来源给原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 活动或详情单屏切换，返回恢复选中行；44px触控目标 | 默认紧凑列表，详情复用原生覆盖层并返回焦点 | 选中后列表/详情约60/40并排；无选择列表占满，不强制目录与活动双列 |

### Accessibility

- Keyboard path: Tab 遍历工具栏/行；Enter 选择调用；Escape 退出详情并返回原行；会话标签沿用宿主方向键导航。
- Focus owner/return: 原生弹层与会话 owner 管理；跨消息定位先激活正确会话和 Chat，再请求定位。
- Visible labels and accessible names: title 包含绑定会话；失败/运行中用文字，不仅用色点；截断标题保留 tooltip。
- Reduced motion and coarse pointer: 遵守 reduced-motion；触控保留全部操作入口，不依赖 hover。

### Visual Exceptions

无新增例外。不创建主题、全局 CSS reset、第二套 Pane geometry 或快捷键前缀。

### Cross-host Semantics

Canonical data/action/receipt owner 为 DSH session/tools/skills/config 服务；客户端只拥有展示与选择。只有用户能感知的缺失/恢复原因进入 UI，不把内部 codec、包加载栈等当产品首屏文案。

## 6. 交付与回滚

先目录安全投影和会话数据绑定，再 Tab/旁栏与标题 seam，最后整合样式和完整验收。插件协议门与宿主可选 canary 分开记录；本次本地预览目标另要求真实兼容宿主浏览器通过，不能用“官方未合入”掩盖本地体验未完成。

启用全部已发现 bundle 的本地配置并保留用户额外插件；不自动重置用户手工禁用的工具、不新增外部凭据或收费调用。工具启停测试在可丢弃 profile/storage 内跑真实 owner 路径；外部依赖用明确标记的 mock，不将它们计为真实连接成功。

按当前兼容基线导出增量补丁并完整重建验证；提交插件仓后更新根仓 submodule 指针，不推送远端。回滚仅移除本轮注册或还原对应提交/补丁，不删除会话、草稿、布局和配置；新旧版本均不应静默重绑定遗留工具 Pane。

## 7. 实施确认与兼容增量

目录现场根因已复现：已经挂载的 Gateway namespace 返回 transport envelope，旧分支把它直接当领域目录，并把 transport 成功内的领域失败误判为成功。统一解包和领域 codec 校验后恢复。首次挂载并发合并；插件卸载先登记清理，挂载晚到仍释放。

Skills.list 增加可选 includeModelInvocable 请求与 catalogComplete 响应，旧请求不变；缺少完整性信息的旧响应显示部分目录。会话导航与 Settings 导航通过宿主服务注入，保持 domain owner。

全插件实际检查另发现 client-modules 新版忽略子路径入口，影响 Pentest 和 Terminal。兼容补丁只接纳显式导出 `<subpath>/package.json` 的 Web seat，普通 Host 子路径继续排除。Terminal 增加 manifest alias，浏览器注册 ID 对齐现有 Host row。bundle 检查仅接受具有对应 Host 导出和 manifest alias 的同包子路径，仍拒绝任意 banner ID。

补丁重建只逐字比较本任务拥有的文件；其他并行任务修改的 staging 文件不纳入本任务导出。先前完整补丁链仍在干净 checkout 依次应用，并重放当前包验证幂等。
