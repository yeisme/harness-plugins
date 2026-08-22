## ADDED Requirements

### Requirement: Production terminal 必须使用 TerminalHostV2 interactive capability
终端 provider MUST 通过 capability-detected `TerminalHostV2` 或等价正式 DSH seam 打开和附着 terminal；production Web profile MUST NOT 实例化 placeholder host 或 fake console。

#### Scenario: V2 capability 可用
- **WHEN** provider 检测到兼容的 DSH interactive terminal service
- **THEN** New/Open/Attach actions 可用，terminal resource 由真实 DSH session 驱动

#### Scenario: V2 capability 缺失
- **WHEN** 当前 DSH 只提供旧行式 terminal API或 placeholder seams
- **THEN** Terminal Pane 显示 compatibility error与所需版本/capability，输入和新建动作 disabled，且不渲染伪输出

### Requirement: 一个 terminal resource 必须对应一个 canonical PTY
每个 `terminal:<opaque-id>` view MUST 连接同一 DSH terminal session；Pane move、split layout、maximize、inactive suspend 与 reattach MUST NOT 隐式 spawn 第二个 PTY。

#### Scenario: 移动 terminal 到 Right
- **WHEN** 用户把 Bottom terminal Tab 移到 Right
- **THEN** 同一 resourceKey、attachment cursor 与 PTY继续使用，旧 view host 先 suspend/dispose后新 host activate

#### Scenario: Split Terminal command
- **WHEN** 用户执行“Split Terminal”
- **THEN** provider 显式 spawn 新 terminal resource并把它放进新 group；原 terminal process 保持独立且不被克隆

### Requirement: xterm.js 必须渲染原始 VT 并支持核心 addons
Terminal Pane MUST 使用 `@xterm/xterm`，并支持 Fit、Search、WebLinks、Unicode11 与 Serialize addons；WebGL SHALL 作为 lazy enhancement且必须有 renderer fallback。

#### Scenario: Alternate screen TUI
- **WHEN** interactive profile 输出 alternate-buffer、cursor、color、mouse或bracketed-paste VT sequences
- **THEN** xterm 按终端语义渲染并把受支持输入写回 DSH，而不是把 escape sequences显示为普通文本

#### Scenario: WebGL 初始化失败
- **WHEN** WebGL addon 抛错、context lost或平台不支持
- **THEN** provider 卸载 WebGL 并继续使用默认 renderer，terminal session与输入不重启

### Requirement: Terminal output 不得进入 React 高频状态
PTY output MUST 通过 bounded write queue直接送入 xterm；React state SHALL 只保存 coarse connection、lease、exit与error facts。每个 output chunk MUST NOT 触发整个 Pane tree rerender。

#### Scenario: 高频输出
- **WHEN** PTY 在短时间内产生大量输出
- **THEN** frames 被批处理并顺序写入 xterm，UI保持响应，queue/backpressure达到上限时显示诚实 truncated/resync 状态

### Requirement: Terminal resize 必须来自真实可见尺寸
Terminal Pane MUST 使用 ResizeObserver与Fit addon计算 cols/rows，rAF 合并变化，仅在有效尺寸变化时调用 DSH resize；隐藏或零尺寸 view MUST NOT 发送无效 resize。

#### Scenario: 拖动 Pane splitter
- **WHEN** 用户连续拖动 splitter
- **THEN** xterm本地布局平滑更新，network resize被合并，pointerup后的最终 cols/rows必定发送到同一 PTY

#### Scenario: 恢复隐藏 terminal
- **WHEN** inactive/hidden terminal再次可见且尺寸稳定
- **THEN** provider执行一次 fit并发送最新 size，然后恢复 input focus；不沿用0×0或过期测量

### Requirement: Terminal input 必须遵守 observe/control lease
Terminal Pane MUST 在 attachment为 controller时才发送 raw input/resize/signal；observe或busy状态必须保持只读，并提供请求 control或显式 takeover入口。

#### Scenario: 普通请求 control 被占用
- **WHEN** DSH 返回 model send active或另一 attachment持有 control
- **THEN** Terminal Pane显示 Busy/Observe状态，不缓冲或稍后偷偷发送用户按键

#### Scenario: 用户显式接管
- **WHEN** 用户选择 Take Control并确认会中断当前 operation
- **THEN** provider调用 typed takeover，只有收到 granted receipt后才启用输入；拒绝/超时保持只读

### Requirement: Close、Detach 与 Kill 必须严格区分
关闭 terminal Tab MUST detach view而不终止 PTY；Kill/Trash MUST 是独立、带 target和确认的 owner action，并在 DSH receipt/exit后更新 view。

#### Scenario: 关闭 terminal Tab
- **WHEN** 用户点击 Tab close或执行 Close
- **THEN** xterm/attachment被detached并释放浏览器资源，DSH terminal仍可在列表中重新附着

#### Scenario: Kill terminal
- **WHEN** 用户确认 Kill目标terminal
- **THEN** provider调用DSH awaited kill，收到成功/exit后关闭或标记exited；失败时保留Tab并显示typed error

### Requirement: Terminal 必须支持 detach/reconnect 与有界 replay
Attachment MUST 记录 epoch/sequence并在网络恢复时请求delta replay；过期 cursor MUST 显示 truncated/resync状态而不是声称完整恢复。临时 reconnect不应重建 PTY或xterm view。

#### Scenario: 短暂断网后恢复
- **WHEN** transport断开后在replay窗口内重新连接
- **THEN** provider进入Reconnecting，重放缺失output并恢复live stream，已确认output不重复

#### Scenario: Browser refresh后terminal仍存活
- **WHEN** Pane persistence恢复terminal resource且DSH仍列出同一session
- **THEN** provider重新attach并恢复bounded output/status；若session不存在则显示Exited/Lost与Close/New action

### Requirement: Terminal profiles 必须由 DSH 枚举
New Terminal MUST 仅允许选择DSH返回的safe profile与可选opaque cwd ref；浏览器provider MUST NOT提交任意executable、argv、environment或absolute cwd。

#### Scenario: 打开默认interactive profile
- **WHEN** 用户点击New Terminal且DSH提供默认interactive profile
- **THEN** provider以当前Pane测量尺寸spawn session并打开Bottom utility view

#### Scenario: 无interactive profile
- **WHEN** DSH只返回不支持raw interaction/full TUI的agent profile
- **THEN** Quick Pick明确显示capability限制，不能把该profile伪装为完整VS Code式terminal

### Requirement: Terminal 查找、剪贴板、粘贴与链接必须安全可用
Terminal Pane SHALL 提供Find、Copy Selection、Paste、Select All、Clear Viewport和link activation。多行/控制字符paste MUST确认且不得自动追加Enter；file link MUST经过DSH resolver，URL MUST经过allowlist。

#### Scenario: 多行粘贴
- **WHEN** clipboard文本包含换行或风险控制字符
- **THEN** provider显示内容摘要与确认；取消不写入，确认只写原始文本且不自动提交命令

#### Scenario: 点击文件链接
- **WHEN** WebLinks/terminal matcher识别file-like文本
- **THEN** provider先请求DSH解析为opaque resource ref，再用Pane `openView()`打开；解析失败时显示安全错误

### Requirement: Terminal runtime state不得持久化到Pane envelope
Pane persistence MUST NOT保存terminal output、xterm serialized buffer、selection、find query、control lease、WebSocket token、absolute path或command history；只允许保存opaque resourceKey与bounded presentation metadata。

#### Scenario: 保存工作区
- **WHEN** terminal正在运行且Pane state持久化
- **THEN**持久化记录包含布局、Tab、safe title/icon/color与opaque terminal ref，不包含输出或连接凭证

### Requirement: Terminal view必须可访问且可恢复焦点
Terminal toolbar、status、find widget、profile picker和confirmation MUST有可访问名称与键盘路径；Pane move/maximize/reconnect后 SHALL 将焦点恢复到terminal或明确的恢复动作。

#### Scenario: 键盘进入terminal
- **WHEN** 用户从Tab按命令聚焦terminal
- **THEN** xterm textarea获得焦点并宣告connection/control状态；Esc等Workbench级操作按定义传回Pane而不被shell吞掉

### Requirement: Terminal集成必须提供真实PTY证据
实施 MUST 使用真实DSH local profile/node-pty完成integration与browser验证，覆盖raw input/output、resize、alternate buffer、detach/reconnect、control conflict、kill与dispose；evidence MUST按项目标准写入run目录并脱敏。

#### Scenario: 完整integration run
- **WHEN** 运行terminal integration entrypoint
- **THEN** run目录至少包含summary.json、command.txt、stdout.log、stderr.log、env.json与artifacts，并保留原始exit code和失败截图/trace
