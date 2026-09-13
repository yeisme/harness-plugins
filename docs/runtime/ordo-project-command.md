# Ordo 项目指挥与会话 Agents

Agent Team 使用 `agents.hub` 用户工作区 Pane，首页列出本机用户明确注册的 Ordo 项目。选择项目后默认展示待处理事项，并可切换任务图、Agent、时间线和任务列表。项目选择与聊天选择独立；详情中的操作绑定明确项目、对象和快照版本。

## 打开

先在 Ordo 所在主机通过 `ordo project-ops register` 注册项目。注册命令和安全读取接口见 Ordo 的 `docs/runtime/project-ops.md`。DSH Host 的 `ORDO_BIN` 如有设置，必须指向真实可执行文件。

```bash
pnpm dsh:workbench -- --check
pnpm dsh:workbench -- --no-open --host 127.0.0.1 --port 40869
```

在 Pane 命令入口运行 `/agent-team`；原 `/ordo-project` 继续可用，也可从侧栏 Agent Team 打开。无需先选择聊天。宿主尚未注册 `agents.hub` 时，旧入口仍可打开绑定会话的 Subagent Monitor。

Team Pane 的原生会话分组只列出明确登记到该项目的 DSH 根会话；没有关联时不推断成员。每个会话的「子 Agent / Subagents」Tab 固定绑定其所在会话。树列表支持搜索、状态筛选和键盘展开；宽 Pane 的详情与列表顶部对齐，窄 Pane 通过返回按钮切换并恢复焦点。并排打开复用 Side Chat；缺少对应 Pane 能力时显示禁用原因。

本机用户范围指当前 Host 的用户级 Ordo 项目注册表，不代表多租户账号系统。Team 的事实仍按项目归 Ordo 所有；插件不把同名子会话转换成团队成员。

## 操作与恢复

- 任务依赖、执行分配和子会话父子树分别显示。未知用量不估算，事件窗口明确标注边界。
- 历史执行者可以选中查看；时间线按 owner 的任务与执行者关联过滤。图中搜索后点击任务会定位该节点，选择状态在视图间保留。
- 图上移动只修改布局。计划依赖和模型、预算修改通过结构化表单生成新 owner 版本。
- 项目选择、视图、选区、节点位置和安全计划草稿使用 Pane 的 opt-in restore 状态。恢复不提交动作、不复用旧确认；草稿版本过期时保留原稿并暂停提交。
- 跟进按子会话分别保存当前输入；发送失败保留输入，切换后迟到结果不改写另一对象的反馈。
- 关闭 Pane 只解除订阅，不停止运行。离线保留最后确认内容，暂停操作。未知回执可从 owner 账本对账。

## 验证分层

组件与浏览器测试使用明确标识的合成数据，不启动真实模型。跨 owner 测试运行真实 Ordo CLI，并通过应用服务创建两个隔离项目。

```bash
pnpm --filter @yeisme/dsh-ordo-agent-ops test
pnpm --filter @yeisme/dsh-client-ui-pane-subagent test
node scripts/run-project-ops-integration.mjs
node scripts/run-ui-visual-tests.mjs visual-ordo-project.spec.ts
openspec validate dsh-ordo-project-command-center-v1 --strict --no-interactive
```

证据保存在本仓 `temp/integration-test-runs/`。真实 DSH 模型运行、两次自动返工、独立验证、人工验收及三个业务场景的真实使用仍单独验收；模拟截图和协议测试不能关闭这些任务。当前能力与剩余任务以对应 OpenSpec 为准。
