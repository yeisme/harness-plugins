## 执行与归属

workspace_mode=current-checkout。插件 owned_paths：ui-pane-workbench 的 unified-host、explorer/tree-ui、独立 explorer 样式及相关测试；ui-interaction-space 的 selection/layer；dsh-command-experience 的 client 入口和浏览器桥；ui-mcp-inspector 的 Tools 快照订阅与兼容测试；宿主 owned_paths：AppFrame/Workbench 的键盘交互、测试与增量补丁。共享读取现有 controller、view registry、文件 owner 和 MCP controller。禁止覆盖进行中的 search-adapter、client.ts 与其搜索测试。

## 能力账本

| 能力 | owner | 本轮验收 | 后续 |
|---|---|---|---|
| 选区工具条 | selection layer | 紧凑深色 token、focus、pin/More 保留 | 基于用户使用再调整主动作排序 |
| Explorer 样式 | plugin content | 无重复大标题/胶囊墙、紧凑行、独立滚动 | 更完整的目录右键菜单 |
| 目录树 | 现有 Explorer state/runtime | 键盘和鼠标共用懒加载，滚动更新窗口，异步结果不覆盖新选择 | owner watch/reconcile 广场景 |
| 文件打开 | file owner + pane | 单击预览、双击/Enter 固定、失败说明 | 跨刷新 opaque ref 重新解析 |
| MCP / pane 命令 | browser commandUi | 已安装 pane 可由真实客户端入口打开；缺失时不伪造成功 | 统一有参数命令路由 |
| Tools 活动 | ui-mcp-inspector | 订阅 chat 数据源，兼容索引节点的 legacy 投影与旧数组快照 | 继续使用宿主公开数据边界 |
| 快捷键 / 布局 | DSH ui-layout | Ctrl/Cmd+B、布局菜单/最大化入口与编辑区域保留 | 命名布局和项目模板继续用原预设 |

## UI Contract

- Surface classification: Explorer adopted；选区工具条 embed；快捷键 excluded。
- Surface kind: navigator / micro。
- First / second / third visual priority: Pane 标题与当前目录、内容树、上下文操作。
- Existing components reused: Surface、原生 Button/Input、现有 More/menu、宿主 pane header。
- Cards that earn existence: 无新增普通卡片；操作预检保留确认区。
- Primary scroll owner: Explorer tree；不会因固定 560px 高度在底部溢出。

### State Matrix
| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| Tree | 行内加载标记 | 清楚的空目录 | 行内错误与重试 | 展开与选择保持 | 不覆盖后来的选择 | owner 原权限判断 |
| File | 正在打开 | 无选中文件不显示假内容 | 可见错误原因 | 原 owner 预览/固定 | 保留旧版本检查 | 敏感文件继续显式授权 |
| Commands | 等待服务加载 | 未注册返回原因 | 不发送模型请求 | 打开真实 pane | HMR 后查询最新 service | 缺失能力不伪装已安装 |

### Responsive
<=420px 单行工具区与 More，树保留 44px 触控目标；421–720px 紧凑工具与树；>720px 仍以 Pane 容器而非整页宽度决定内容。使用 `docs/design/dsh-unified-panel-visual-system.md`。

### Accessibility
目录方向键/Enter/Space、明确 aria-label、隐藏行操作在 focus-within 时出现；触控不隐藏。快捷键忽略 composing、已处理事件和编辑目标，不抢占富文本加粗或终端 Ctrl+B。Modal/menu 的 Escape 和焦点返回复用原实现。

### Visual Exceptions
无新增例外。旧 chrome 样式不作为独立插件内容的隐式前提。

## 验证

focused unit 与组件测试先行；最终 typecheck/build、surface/plugin/visual gates。真实浏览器覆盖 Explorer 滚动及文件打开、MCP 菜单入口、侧栏快捷键与布局切换；不修改用户文件或发送模型请求。测试写入本项目 temp/integration-test-runs 的脱敏六件套。后续任务明确列出成熟度，不把计划当完成。
